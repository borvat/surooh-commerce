"""Real disposable PostgreSQL acceptance of unchanged legacy migrations; never production."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import datetime
import hashlib
import json
import os
from pathlib import Path
import secrets
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urlparse
import uuid

import psycopg
from psycopg import sql

ROOT = Path(__file__).resolve().parents[2]


def HASH(data):
    return hashlib.sha256(data).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--postgres-bin", type=Path, required=True)
    ap.add_argument("--artifact-dir", type=Path, required=True)
    ap.add_argument("--allow-uid-compat", action="store_true")
    a = ap.parse_args()
    target = urlparse(os.environ.get("WMS_TEST_DATABASE_URL", ""))
    if (
        os.environ.get("WMS_TEST_ISOLATED") != "true"
        or target.scheme not in ["postgres", "postgresql"]
        or target.hostname != "127.0.0.1"
        or target.query
        or target.fragment
        or not re.fullmatch(r"/wms_test_[a-z0-9_]+", target.path)
        or not target.port
    ):
        ap.error("Explicit loopback disposable test target required")
    out = a.artifact_dir.resolve()
    if out.is_relative_to(ROOT) or out.exists():
        ap.error("New external evidence directory required")
    out.mkdir(parents=True)
    binaries = a.postgres_bin.resolve()
    pins = json.loads((ROOT / "verification/postgres/runtime-pins.json").read_text())
    if psycopg.__version__ != pins["psycopg_version"]:
        ap.error("Pinned psycopg version required")
    for name in ["postgres", "initdb", "pg_ctl", "pg_dump", "pg_restore"]:
        p = binaries / name
        if not p.is_file():
            ap.error("Missing pinned PostgreSQL binary: " + name)
        if HASH(p.read_bytes()) != pins["binaries"][name]:
            ap.error("Runtime binary hash mismatch: " + name)
        p.chmod(p.stat().st_mode | 0o100)
    report = {
        "source_sha": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "source_dirty_tracked": bool(
            subprocess.check_output(
                ["git", "status", "--porcelain", "--untracked-files=no"],
                cwd=ROOT,
                text=True,
            ).strip()
        ),
        "driver_sha256": HASH(Path(__file__).read_bytes()),
        "expected_case_count": 21,
        "started_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "engine": "real standalone PostgreSQL processes and independent TCP sessions",
        "psycopg": psycopg.__version__,
        "libpq_version": psycopg.pq.version(),
        "runtime_pins_sha256": HASH(
            (ROOT / "verification/postgres/runtime-pins.json").read_bytes()
        ),
        "compatibility_sha256": HASH(
            (ROOT / "verification/postgres/compatibility.sql").read_bytes()
        ),
        "migrations": [],
        "cases": [],
        "commands": [],
        "runtime_binary_hashes": {
            n: HASH((binaries / n).read_bytes())
            for n in ["postgres", "initdb", "pg_ctl", "pg_dump", "pg_restore"]
        },
        "host_isolation_proven": False,
        "http_postgrest_jwt_proven": False,
        "codex_start_authorized": False,
        "production_authority_changed": False,
    }
    temp = Path(tempfile.mkdtemp(prefix="wms-pg-synthetic-"))
    temp.chmod(0o700)
    env = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": str(temp),
        "LANG": "C.UTF-8",
        "TZ": "UTC",
    }
    owner_password = secrets.token_urlsafe(24)
    pw = temp / "owner-password"
    pw.write_text(owner_password)
    pw.chmod(0o600)
    cluster = temp / "cluster"
    proc = None
    log_handle = None
    db = target.path[1:]
    roles = {}
    ids = {}
    orgs = {"A": uuid.uuid4(), "B": uuid.uuid4()}
    connections = {"host": "127.0.0.1", "port": target.port, "connect_timeout": 5}
    stop_ok = False

    def save():
        (out / "database-results.json").write_text(
            json.dumps(report, indent=2, default=str) + "\n"
        )

    def command(argv, logname):
        started = time.monotonic()
        p = subprocess.run(
            [str(x) for x in argv],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=60,
        )
        text = p.stdout.replace(owner_password.encode(), b"[REDACTED]")
        (out / logname).write_bytes(text)
        report["commands"].append(
            {
                "argv": [str(x).replace(str(pw), "[PRIVATE_PWFILE]") for x in argv],
                "cwd": str(ROOT),
                "exit_code": p.returncode,
                "log": logname,
                "log_sha256": HASH(text),
                "duration_seconds": round(time.monotonic() - started, 3),
            }
        )
        if p.returncode:
            raise RuntimeError(logname + " exited " + str(p.returncode))

    def connect(user="fixture_owner", database=db):
        password = owner_password if user == "fixture_owner" else roles[user]
        return psycopg.connect(
            **connections,
            dbname=database,
            user=user,
            password=password,
            autocommit=True,
            options="-c statement_timeout=15000 -c lock_timeout=10000",
        )

    def session(label):
        c = connect("fixture_" + label)
        claim = str(ids[label]) if label not in ["missing", "anon"] else ""
        c.execute(
            "select set_config('request.jwt.claim.sub',%s,false),set_config('request.jwt.claims',%s,false)",
            (claim, json.dumps({"sub": claim, "email": "fixture@example.invalid"})),
        )
        return c

    def start():
        nonlocal proc, log_handle
        log_handle = (out / "postgres.log").open("ab")
        argv = [
            str(binaries / "postgres"),
            "-D",
            str(cluster),
            "-h",
            "127.0.0.1",
            "-p",
            str(target.port),
            "-k",
            "",
            "-c",
            "shared_buffers=16MB",
            "-c",
            "max_connections=25",
            "-c",
            "fsync=on",
            "-c",
            "synchronous_commit=on",
        ]
        proc = subprocess.Popen(
            argv, env=env, stdout=log_handle, stderr=subprocess.STDOUT
        )
        report["commands"].append(
            {
                "argv": argv,
                "cwd": str(ROOT),
                "purpose": "owned ephemeral server start",
                "pid": proc.pid,
            }
        )
        until = time.monotonic() + 15
        while time.monotonic() < until:
            if proc.poll() is not None:
                raise RuntimeError("PostgreSQL exited at startup")
            try:
                with connect(database="postgres") as c:
                    report["server_version"] = c.execute("select version()").fetchone()[
                        0
                    ]
                return
            except psycopg.OperationalError:
                time.sleep(0.05)
        raise RuntimeError("PostgreSQL readiness timeout")

    def stop():
        nonlocal proc, log_handle
        if proc is not None and proc.poll() is None:
            proc.send_signal(signal.SIGINT)
            try:
                proc.wait(timeout=20)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
                raise RuntimeError("Server required kill")
        if proc is not None:
            for row in report["commands"]:
                if row.get("pid") == proc.pid:
                    row["exit_code"] = proc.returncode
        if log_handle:
            log_handle.close()

    def case(name, fn):
        row = {
            "id": name,
            "started_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        try:
            row["evidence"] = fn()
            row["status"] = "PASS"
        except Exception as e:
            row["status"] = "FAIL"
            row["error"] = type(e).__name__ + ": " + str(e)
        report["cases"].append(row)
        save()
        print(name, row["status"], row.get("error", ""), flush=True)

    def deny(c, query, params=()):
        try:
            c.execute("BEGIN")
            try:
                cur = c.execute(query, params)
                result = cur.fetchall() if cur.description else []
                # Invisible UPDATE/DELETE/SELECT is a denial even without SQL error.
                if cur.rowcount == 0:
                    return {"denied": "zero_rows"}
                raise AssertionError("Unauthorized operation succeeded: " + str(result))
            except psycopg.Error as e:
                if e.sqlstate in ["42501", "P0001"]:
                    return {"denied": e.sqlstate, "message": str(e).splitlines()[0]}
                raise
        finally:
            c.execute("ROLLBACK")

    def scenario(org="A", stock=20, parts=(2, 1)):
        x = {k: uuid.uuid4() for k in ["wh", "c1", "c2", "p", "p2", "channel"]}
        suffix = uuid.uuid4().hex[:12]
        with connect() as c:
            c.execute(
                "insert into public.warehouses(id,code,name,is_default,organization_id) values(%s,%s,%s,false,%s)",
                (x["wh"], "FIXTURE-WH-" + suffix, "Synthetic warehouse", orgs[org]),
            )
            for i in [1, 2]:
                c.execute(
                    "insert into public.components(id,sku,name,organization_id) values(%s,%s,%s,%s)",
                    (
                        x["c" + str(i)],
                        f"FIXTURE-C{i}-" + suffix,
                        "Synthetic component",
                        orgs[org],
                    ),
                )
                c.execute(
                    "insert into public.component_stock(component_id,warehouse_id,physical_qty,reserved_qty) values(%s,%s,%s,0)",
                    (x["c" + str(i)], x["wh"], stock),
                )
            for p in ["p", "p2"]:
                c.execute(
                    "insert into public.products(id,sku,name,product_type,organization_id) values(%s,%s,'Synthetic bundle','BUNDLE',%s)",
                    (x[p], f"FIXTURE-{p}-" + suffix, orgs[org]),
                )
                for i, q in enumerate(parts, 1):
                    c.execute(
                        "insert into public.bom_lines(product_id,component_id,quantity_required) values(%s,%s,%s)",
                        (x[p], x["c" + str(i)], q),
                    )
            c.execute(
                "insert into public.sales_channels(id,code,name,organization_id) values(%s,%s,%s,%s)",
                (x["channel"], "FIXTURE-CH-" + suffix, "Synthetic channel", orgs[org]),
            )
        return x

    def stock(x):
        with connect() as c:
            return c.execute(
                "select component_id::text,physical_qty,reserved_qty from component_stock where warehouse_id=%s order by component_id",
                (x["wh"],),
            ).fetchall()

    def place(c, x, reference, product="p"):
        return c.execute(
            "select public.place_order(%s::jsonb,%s,%s,null,%s)",
            (
                json.dumps([{"product_id": str(x[product]), "quantity": 1}]),
                x["channel"],
                reference,
                x["wh"],
            ),
        ).fetchone()[0]

    def race(actions):
        b = threading.Barrier(len(actions))
        result = []

        def worker(item):
            label, fn = item
            with session(label) as c:
                pid = c.execute("select pg_backend_pid()").fetchone()[0]
                b.wait(timeout=10)
                try:
                    return {"pid": pid, "status": "OK", "value": str(fn(c))}
                except psycopg.Error as e:
                    return {
                        "pid": pid,
                        "status": "ERROR",
                        "sqlstate": e.sqlstate,
                        "error": str(e).splitlines()[0],
                    }

        with ThreadPoolExecutor(max_workers=len(actions)) as pool:
            result = list(pool.map(worker, actions))
        assert len(set(v["pid"] for v in result)) == len(result)
        return result

    try:
        if os.geteuid() == 0:
            if not a.allow_uid_compat:
                raise RuntimeError(
                    "BLOCKED: non-root OS identity unavailable; explicit synthetic UID compatibility opt-in required"
                )
            command(
                [
                    "gcc",
                    "-shared",
                    "-fPIC",
                    ROOT / "verification/postgres/uid_compat.c",
                    "-o",
                    temp / "uid_compat.so",
                    "-ldl",
                ],
                "uid-compat-build.log",
            )
            env["LD_PRELOAD"] = str(temp / "uid_compat.so")
            report["uid_compat"] = {
                "actual_uid": os.getuid(),
                "observed_uid": 1,
                "source_sha256": HASH(
                    (ROOT / "verification/postgres/uid_compat.c").read_bytes()
                ),
                "library_sha256": HASH((temp / "uid_compat.so").read_bytes()),
                "scope": "child processes only; libc UID/stat observations; NOT OS or filesystem isolation",
            }
        command(
            [
                binaries / "initdb",
                "-D",
                cluster,
                "-U",
                "fixture_owner",
                "--no-locale",
                "--encoding=UTF8",
                "--auth=scram-sha-256",
                "--pwfile",
                pw,
            ],
            "initdb.log",
        )
        start()
        with connect(database="postgres") as c:
            c.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db)))
        with connect() as c:
            c.execute((ROOT / "verification/postgres/compatibility.sql").read_text())
            for path in sorted((ROOT / "supabase/migrations").glob("*.sql")):
                row = {"file": path.name, "sha256": HASH(path.read_bytes())}
                try:
                    with c.transaction():
                        c.execute(path.read_text())
                    row["status"] = "PASS"
                except Exception as e:
                    row.update(
                        status="FAIL",
                        error=str(e),
                        sqlstate=getattr(e, "sqlstate", None),
                    )
                    report["migrations"].append(row)
                    save()
                    raise
                report["migrations"].append(row)
                save()
            for org, oid in orgs.items():
                c.execute(
                    "insert into organizations(id,name,slug) values(%s,%s,%s)",
                    (oid, "SYNTHETIC " + org, "fixture-" + org.lower()),
                )
            for label in [
                "a_admin",
                "a_warehouse",
                "a_viewer",
                "b_admin",
                "b_warehouse",
                "b_viewer",
                "outsider",
                "missing",
                "anon",
            ]:
                uid = uuid.uuid4()
                ids[label] = uid
                name = "fixture_" + label
                password = secrets.token_urlsafe(24)
                roles[name] = password
                c.execute(
                    sql.SQL(
                        "CREATE ROLE {} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD {}"
                    ).format(sql.Identifier(name), sql.Literal(password))
                )
                c.execute(
                    sql.SQL("GRANT {} TO {}").format(
                        sql.Identifier("anon" if label == "anon" else "authenticated"),
                        sql.Identifier(name),
                    )
                )
                c.execute(
                    "insert into auth.users(id,email) values(%s,%s)",
                    (uid, label + "@example.invalid"),
                )
                c.execute(
                    "insert into profiles(id,email) values(%s,%s)",
                    (uid, label + "@example.invalid"),
                )
                if label[0] in ["a", "b"] and "_" in label:
                    c.execute(
                        "insert into organization_members(organization_id,user_id,role) values(%s,%s,%s)",
                        (orgs[label[0].upper()], uid, label.split("_")[1]),
                    )
            report["rls_catalog"] = [
                dict(zip(["table", "enabled", "forced"], r))
                for r in c.execute(
                    "select relname,relrowsecurity,relforcerowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' order by relname"
                )
            ]
            report["definer_catalog"] = [
                dict(
                    zip(
                        [
                            "signature",
                            "config",
                            "authenticated_execute",
                            "anon_execute",
                        ],
                        r,
                    )
                )
                for r in c.execute(
                    "select p.oid::regprocedure::text,p.proconfig,has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('anon',p.oid,'EXECUTE') from pg_proc p join pg_namespace n on n.oid=pronamespace where n.nspname='public' and prosecdef order by 1"
                )
            ]
        case(
            "D01_all_original_migrations",
            lambda: {
                "applied": len(report["migrations"]),
                "historical_files_modified": False,
            },
        )

        def roles_case():
            rows = []
            for label in ids:
                with session(label) as c:
                    row = c.execute(
                        "select current_user,session_user,r.rolsuper,r.rolbypassrls,current_setting('row_security'),auth.uid()::text,pg_backend_pid() from pg_roles r where rolname=current_user"
                    ).fetchone()
                    assert (
                        row[0] == row[1] == "fixture_" + label
                        and not row[2]
                        and not row[3]
                        and row[4] == "on"
                    )
                    rows.append(row)
                    deny(c, "SET ROLE fixture_owner")
                    deny(c, "SET ROLE service_role")
            return rows

        case("D02_real_restricted_login_roles", roles_case)
        A = scenario("A")
        B = scenario("B")

        def select_case():
            rows = []
            for label in ids:
                with session(label) as c:
                    try:
                        visible = [
                            str(r[0])
                            for r in c.execute(
                                "select id from products where id=any(%s)",
                                ([A["p"], B["p"]],),
                            )
                        ]
                    except psycopg.errors.InsufficientPrivilege:
                        assert label == "anon"
                        visible = []
                    expected = (
                        [str(A["p"])]
                        if label.startswith("a_")
                        else [str(B["p"])]
                        if label.startswith("b_")
                        else []
                    )
                    assert sorted(visible) == sorted(expected), (
                        label,
                        visible,
                        expected,
                    )
                    rows.append({"label": label, "visible": visible})
            return rows

        case("D03_company_user_select_isolation", select_case)

        def crud_case():
            result = []
            for label in ids:
                with session(label) as c:
                    foreign = B if label.startswith("a_") else A
                    oid = orgs["B"] if label.startswith("a_") else orgs["A"]
                    result.extend(
                        [
                            deny(
                                c, "select * from products where id=%s", (foreign["p"],)
                            ),
                            deny(
                                c,
                                "update products set name='UNAUTHORIZED' where id=%s",
                                (foreign["p"],),
                            ),
                            deny(
                                c,
                                "delete from bom_lines where product_id=%s",
                                (foreign["p"],),
                            ),
                            deny(
                                c,
                                "insert into products(sku,name,organization_id) values(%s,'UNAUTHORIZED',%s)",
                                ("BAD-" + uuid.uuid4().hex, oid),
                            ),
                        ]
                    )
            with session("a_admin") as c:
                c.execute("BEGIN")
                c.execute(
                    "insert into products(sku,name,product_type,organization_id) values(%s,'Allowed','BUNDLE',%s) returning id",
                    ("GOOD-" + uuid.uuid4().hex, orgs["A"]),
                )
                p = c.execute(
                    "select id from products where sku like %s", ("GOOD-%",)
                ).fetchone()[0]
                assert (
                    c.execute(
                        "update products set name='Allowed update' where id=%s returning id",
                        (p,),
                    ).fetchone()[0]
                    == p
                )
                c.execute(
                    "select set_product_bom(%s,%s::jsonb)",
                    (
                        p,
                        json.dumps(
                            [{"component_id": str(A["c1"]), "quantity_required": 1}]
                        ),
                    ),
                )
                decision = c.execute(
                    "insert into product_review_decisions(organization_id,kind,product_ids,decision) values(%s,'same',%s,'confirmed') returning id",
                    (orgs["A"], [p]),
                ).fetchone()[0]
                assert (
                    c.execute(
                        "update product_review_decisions set decision='rejected' where id=%s returning id",
                        (decision,),
                    ).fetchone()[0]
                    == decision
                )
                assert (
                    c.execute(
                        "delete from product_review_decisions where id=%s returning id",
                        (decision,),
                    ).fetchone()[0]
                    == decision
                )
                c.execute("ROLLBACK")
            for label in ["a_viewer", "a_warehouse", "outsider", "missing", "anon"]:
                with session(label) as c:
                    result.append(
                        deny(
                            c,
                            "update products set name='UNAUTHORIZED' where id=%s",
                            (A["p"],),
                        )
                    )
            with connect() as c:
                assert (
                    c.execute(
                        "select count(*) from products where name='UNAUTHORIZED'"
                    ).fetchone()[0]
                    == 0
                )
            return {
                "denied_operations": len(result),
                "own_admin_crud": "PASS; disposable transaction rolled back",
                "denials": result,
            }

        case("D04_direct_CRUD_matrix", crud_case)

        def rpc_case():
            result = []
            for label in [
                "a_admin",
                "a_warehouse",
                "a_viewer",
                "outsider",
                "missing",
            ]:
                with session(label) as c:
                    result.append(
                        deny(
                            c,
                            "select public.post_stock_movement(%s,'receipt',1,'fixture','fixture',%s)",
                            (B["c1"], B["wh"]),
                        )
                    )
                    result.append(
                        deny(
                            c,
                            "select public.place_order(%s::jsonb,%s,'bad-cross-company',null,%s)",
                            (
                                json.dumps(
                                    [{"product_id": str(B["p"]), "quantity": 1}]
                                ),
                                B["channel"],
                                B["wh"],
                            ),
                        )
                    )
                    result.append(
                        deny(
                            c,
                            "select public._apply_stock(%s,%s,'receipt',100,0,'bad',null,null,null)",
                            (B["c1"], B["wh"]),
                        )
                    )
                    assert (
                        c.execute(
                            "select has_org_role(%s,array['admin','warehouse']::app_role[])",
                            (orgs["B"],),
                        ).fetchone()[0]
                        is False
                    )
            for label in ["a_viewer", "outsider", "missing", "anon"]:
                with session(label) as c:
                    result.append(
                        deny(
                            c,
                            "select public.place_order(%s::jsonb,%s,'viewer',null,%s)",
                            (
                                json.dumps(
                                    [{"product_id": str(A["p"]), "quantity": 1}]
                                ),
                                A["channel"],
                                A["wh"],
                            ),
                        )
                    )
            return result

        case("D05_definer_RPC_and_helper_bypass_denial", rpc_case)

        def credential_case():
            result = []
            for label in ids:
                with session(label) as c:
                    result.append(deny(c, "select * from channel_credentials"))
            return result

        case("D06_browser_roles_cannot_read_credentials", credential_case)

        def reserve_case():
            x = scenario(stock=3, parts=(2, 1))
            results = race(
                [
                    ("a_admin", lambda c: place(c, x, "RACE-A")),
                    ("a_warehouse", lambda c: place(c, x, "RACE-B", "p2")),
                ]
            )
            assert sum(r["status"] == "OK" for r in results) == 1, results
            rows = stock(x)
            assert sorted((p, r) for _, p, r in rows) == [(3, 1), (3, 2)], rows
            return {
                "connections": results,
                "stock": rows,
                "atomic_loser": "no partial reservation",
            }

        case("D07_shared_bundle_concurrent_shortage", reserve_case)

        def shortage():
            x = scenario(stock=1, parts=(2, 1))
            before = stock(x)
            with session("a_admin") as c:
                try:
                    place(c, x, "SHORTAGE")
                    raise AssertionError("Expected shortage")
                except psycopg.Error as e:
                    assert e.sqlstate == "P0001"
            assert stock(x) == before
            with connect() as c:
                assert (
                    c.execute(
                        "select count(*) from orders where warehouse_id=%s", (x["wh"],)
                    ).fetchone()[0]
                    == 0
                )
            return {"stock": before, "rolled_back_order": True}

        case("D08_whole_bundle_atomic_rollback", shortage)

        def terminal_race():
            x = scenario()
            with session("a_admin") as c:
                order = place(c, x, "TERMINAL-RACE")
            results = race(
                [
                    (
                        "a_admin",
                        lambda c: c.execute(
                            "select fulfill_order(%s)", (order,)
                        ).fetchone(),
                    ),
                    (
                        "a_warehouse",
                        lambda c: c.execute(
                            "select cancel_order(%s)", (order,)
                        ).fetchone(),
                    ),
                ]
            )
            assert sum(r["status"] == "OK" for r in results) == 1, results
            with connect() as c:
                status = c.execute(
                    "select status from orders where id=%s", (order,)
                ).fetchone()[0]
            rows = stock(x)
            assert all(r == 0 for _, p, r in rows), rows
            assert sorted(p for _, p, r in rows) == (
                [18, 19] if status == "fulfilled" else [20, 20]
            ), (status, rows)
            with session("a_admin") as c:
                for fn in ["fulfill_order", "cancel_order"]:
                    try:
                        c.execute(
                            sql.SQL("select {}(%s)").format(sql.Identifier(fn)),
                            (order,),
                        )
                        raise AssertionError("terminal replay succeeded")
                    except psycopg.Error as e:
                        assert e.sqlstate == "P0001"
            return {
                "order": str(order),
                "status": status,
                "connections": results,
                "stock": rows,
                "terminal_replays": "rejected without duplicate effect",
            }

        case("D09_cancel_ship_race_and_replay", terminal_race)

        def failure_retry():
            x = scenario()
            before = stock(x)
            c = session("a_warehouse")
            c.execute("BEGIN")
            order = place(c, x, "FAILURE-RETRY")
            pid = c.execute("select pg_backend_pid()").fetchone()[0]
            with connect() as owner:
                assert owner.execute(
                    "select pg_terminate_backend(%s)", (pid,)
                ).fetchone()[0]
            c.close()
            assert stock(x) == before
            with connect() as owner:
                assert (
                    owner.execute(
                        "select count(*) from orders where id=%s", (order,)
                    ).fetchone()[0]
                    == 0
                )
            with session("a_warehouse") as retry:
                committed = place(retry, x, "FAILURE-RETRY")
            assert sorted(r for _, p, r in stock(x)) == [1, 2]
            report["restart_fixture"] = {
                "warehouse": str(x["wh"]),
                "order": str(committed),
                "stock": stock(x),
            }
            return {
                "terminated_backend_pid": pid,
                "uncommitted_order_absent": True,
                "successful_retry": str(committed),
            }

        case("D10_terminated_transaction_rollback_and_retry", failure_retry)

        def idempotency():
            x = scenario(stock=50, parts=(1, 1))
            results = race(
                [
                    ("a_admin", lambda c: place(c, x, "SAME-EXTERNAL")),
                    ("a_warehouse", lambda c: place(c, x, "SAME-EXTERNAL")),
                ]
            )
            with connect() as c:
                count = c.execute(
                    "select count(*) from orders where warehouse_id=%s and external_ref='SAME-EXTERNAL'",
                    (x["wh"],),
                ).fetchone()[0]
            report["duplicate_external_observation"] = {
                "connections": results,
                "orders": count,
                "stock": stock(x),
            }
            assert count == 1, (
                "External request replay created "
                + str(count)
                + " orders: "
                + json.dumps(results)
            )
            return report["duplicate_external_observation"]

        case("D11_external_idempotency_required", idempotency)

        def revocation():
            x = scenario()
            with session("a_warehouse") as c:
                order = place(c, x, "REVOKE")
            with connect() as c:
                c.execute(
                    "delete from organization_members where organization_id=%s and user_id=%s",
                    (orgs["A"], ids["a_warehouse"]),
                )
            try:
                with session("a_warehouse") as c:
                    denied = deny(c, "select fulfill_order(%s)", (order,))
                    visible = c.execute(
                        "select count(*) from orders where id=%s", (order,)
                    ).fetchone()[0]
                    assert visible == 0
                return {"denial": denied, "visible_after_revoke": visible}
            finally:
                with connect() as c:
                    c.execute(
                        "insert into organization_members(organization_id,user_id,role) values(%s,%s,'warehouse')",
                        (orgs["A"], ids["a_warehouse"]),
                    )

        case("D12_execution_time_membership_revocation", revocation)

        def views_case():
            result = []
            with session("a_viewer") as c:
                for (name,) in c.execute(
                    "select table_name from information_schema.views where table_schema='public'"
                ).fetchall():
                    try:
                        rows = c.execute(
                            sql.SQL("select row_to_json(v)::text from {} v").format(
                                sql.Identifier(name)
                            )
                        ).fetchall()
                        for row in rows:
                            assert (
                                str(orgs["B"]) not in row[0]
                                and str(B["c1"]) not in row[0]
                                and str(B["p"]) not in row[0]
                            ), (name, row)
                        result.append({"view": name, "rows": len(rows)})
                    except psycopg.errors.InsufficientPrivilege:
                        result.append({"view": name, "access": "denied"})
            return result

        case("D13_view_and_report_isolation", views_case)

        def shadow():
            with session("a_viewer") as c:
                c.execute(
                    "CREATE TEMP TABLE organization_members(organization_id uuid,user_id uuid,role public.app_role)"
                )
                c.execute(
                    "insert into organization_members values(%s,%s,'admin')",
                    (orgs["B"], ids["a_viewer"]),
                )
                result = c.execute(
                    "select public.has_org_role(%s,array['admin']::public.app_role[])",
                    (orgs["B"],),
                ).fetchone()[0]
                assert result is False, "Temporary table shadow granted foreign admin"
                return {"foreign_admin": result}

        case("D14_temp_schema_shadow_resistance", shadow)

        def jwt_boundary():
            with session("a_viewer") as c:
                c.execute(
                    "select set_config('request.jwt.claim.sub',%s,false)",
                    (str(ids["b_admin"]),),
                )
                leaked = c.execute(
                    "select count(*) from products where id=%s", (B["p"],)
                ).fetchone()[0]
                report["claim_spoof_observation"] = {
                    "restricted_login": "fixture_a_viewer",
                    "forged_subject": "fixture_b_admin",
                    "foreign_visible": leaked,
                    "boundary": "custom request claims are trusted API inputs, not authentication for arbitrary SQL clients",
                }
                assert leaked == 0, (
                    "Direct SQL client can replace trusted auth claim and see foreign rows; PostgREST/JWT boundary unproved"
                )
                return report["claim_spoof_observation"]

        case("D15_direct_SQL_claim_spoof_boundary", jwt_boundary)

        def restart():
            expected = report["restart_fixture"]
            stop()
            start()
            with connect() as c:
                status = c.execute(
                    "select status from orders where id=%s", (expected["order"],)
                ).fetchone()[0]
                assert status == "placed"
                rows = c.execute(
                    "select component_id::text,physical_qty,reserved_qty from component_stock where warehouse_id=%s order by component_id",
                    (expected["warehouse"],),
                ).fetchall()
                assert [list(r) for r in rows] == [list(r) for r in expected["stock"]]
            return {
                "persisted_order_status": status,
                "stock": rows,
                "recovery": "fsync enabled clean fast-stop/restart; not power-loss or off-host restore",
            }

        case("D16_restart_durability_reconnect", restart)

        def table_reads():
            result = []
            foreign = [str(v) for v in B.values()] + [str(orgs["B"])]
            with session("a_viewer") as c:
                names = c.execute(
                    "select tablename from pg_tables where schemaname='public' order by tablename"
                ).fetchall()
                for (name,) in names:
                    try:
                        rows = c.execute(
                            sql.SQL("select row_to_json(t)::text from {} t").format(
                                sql.Identifier(name)
                            )
                        ).fetchall()
                        for row in rows:
                            assert not any(value in row[0] for value in foreign), (
                                name,
                                row[0],
                            )
                        result.append(
                            {
                                "table": name,
                                "rows": len(rows),
                                "foreign_fixture_rows": 0,
                            }
                        )
                    except psycopg.errors.InsufficientPrivilege:
                        result.append({"table": name, "access": "denied"})
            return result

        case("D17_all_public_table_read_surfaces", table_reads)

        def null_channel_replay():
            x = scenario(stock=50, parts=(1, 1))

            def run(c):
                return c.execute(
                    "select place_order(%s::jsonb,null,'NULL-CHANNEL-REPLAY',null,%s)",
                    (json.dumps([{"product_id": str(x["p"]), "quantity": 1}]), x["wh"]),
                ).fetchone()[0]

            results = race([("a_admin", run), ("a_warehouse", run)])
            with connect() as c:
                count = c.execute(
                    "select count(*) from orders where warehouse_id=%s and external_ref='NULL-CHANNEL-REPLAY'",
                    (x["wh"],),
                ).fetchone()[0]
            report["null_channel_replay_observation"] = {
                "connections": results,
                "orders": count,
                "stock": stock(x),
            }
            assert count == 1, (
                "Nullable channel bypassed external-ref uniqueness; "
                + str(count)
                + " durable orders"
            )
            return report["null_channel_replay_observation"]

        case("D18_null_channel_external_replay", null_channel_replay)

        def sequential_terminal():
            result = []
            for fn in ["fulfill_order", "cancel_order"]:
                x = scenario()
                with session("a_warehouse") as c:
                    order = place(c, x, fn)
                    c.execute(
                        sql.SQL("select {}(%s)").format(sql.Identifier(fn)), (order,)
                    )
                rows = stock(x)
                assert sorted((p, r) for _, p, r in rows) == (
                    [(18, 0), (19, 0)] if fn == "fulfill_order" else [(20, 0), (20, 0)]
                )
                result.append({"operation": fn, "stock": rows})
            return result

        case("D19_separate_ship_and_cancel_lifecycles", sequential_terminal)

        def backup_restore():
            restore_db = "wms_test_restore_" + uuid.uuid4().hex[:10]

            def fingerprint(c):
                rows = []
                for (table,) in c.execute(
                    "select tablename from pg_tables where schemaname in ('public','auth') order by schemaname,tablename"
                ).fetchall():
                    schema = "auth" if table == "users" else "public"
                    data = c.execute(
                        sql.SQL(
                            "select row_to_json(t)::text from {}.{} t order by row_to_json(t)::text"
                        ).format(sql.Identifier(schema), sql.Identifier(table))
                    ).fetchall()
                    rows.append(
                        {
                            "table": schema + "." + table,
                            "count": len(data),
                            "sha256": HASH(json.dumps(data).encode()),
                        }
                    )
                return rows

            with connect() as c:
                before = fingerprint(c)
            dump = temp / "private.dump"
            env["PGPASSWORD"] = owner_password
            try:
                command(
                    [
                        binaries / "pg_dump",
                        "-h",
                        "127.0.0.1",
                        "-p",
                        target.port,
                        "-U",
                        "fixture_owner",
                        "-d",
                        db,
                        "-Fc",
                        "-f",
                        dump,
                    ],
                    "pg-dump.log",
                )
                with connect(database="postgres") as c:
                    c.execute(
                        sql.SQL("CREATE DATABASE {}").format(sql.Identifier(restore_db))
                    )
                command(
                    [
                        binaries / "pg_restore",
                        "-h",
                        "127.0.0.1",
                        "-p",
                        target.port,
                        "-U",
                        "fixture_owner",
                        "-d",
                        restore_db,
                        "--exit-on-error",
                        "--no-owner",
                        dump,
                    ],
                    "pg-restore.log",
                )
                with connect(database=restore_db) as c:
                    after = fingerprint(c)
                assert before == after, "Restored relation fingerprints differ"
                with connect("fixture_a_viewer", database=restore_db) as c:
                    c.execute(
                        "select set_config('request.jwt.claim.sub',%s,false)",
                        (str(ids["a_viewer"]),),
                    )
                    assert (
                        c.execute(
                            "select count(*) from products where id=%s", (B["p"],)
                        ).fetchone()[0]
                        == 0
                    )
                    assert (
                        c.execute(
                            "select count(*) from products where id=%s", (A["p"],)
                        ).fetchone()[0]
                        == 1
                    )
                report["backup_restore_fingerprints"] = before
                return {
                    "matching_relations": len(before),
                    "restored_role_RLS": "foreign denied; own visible",
                    "private_dump_exported": False,
                    "scope": "same isolated cluster, separate restored DB; not off-host/key/SLA recovery",
                }
            finally:
                env.pop("PGPASSWORD", None)
                with connect(database="postgres") as c:
                    c.execute(
                        sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(
                            sql.Identifier(restore_db)
                        )
                    )

        case("D20_real_dump_restore_and_RLS_recheck", backup_restore)

        def anonymous_boundary():
            result = []
            with session("anon") as c:
                result.append(deny(c, "SET ROLE authenticated"))
                result.append(deny(c, "select * from products"))
                result.append(deny(c, "select bootstrap_user()"))
                result.append(
                    deny(
                        c,
                        "select place_order(%s::jsonb,%s,'anon',null,%s)",
                        (
                            json.dumps([{"product_id": str(A["p"]), "quantity": 1}]),
                            A["channel"],
                            A["wh"],
                        ),
                    )
                )
            return result

        case("D21_anonymous_role_denials", anonymous_boundary)

    except Exception as e:
        report["fatal"] = {
            "error": str(e),
            "type": type(e).__name__,
            "sqlstate": getattr(e, "sqlstate", None),
        }
        print("FATAL", str(e), flush=True)
    finally:
        try:
            stop()
            stop_ok = True
        except Exception as e:
            report["cleanup_error"] = str(e)
        shutil.rmtree(temp, ignore_errors=True)
        report["cleanup"] = {
            "server_stopped": stop_ok,
            "private_cluster_removed": not temp.exists(),
        }
        report["finished_at_utc"] = datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat()
        report["summary"] = {
            s: sum(r["status"] == s for r in report["cases"]) for s in ["PASS", "FAIL"]
        }
        report["unexecuted_requirements"] = [
            "HTTP/PostgREST JWT validation",
            "separate real OS identities/mounts",
            "native ERPNext integration",
            "real background-worker transport",
            "fresh full ERPNext bootstrap",
            "off-host backup/key custody and crash/power-loss durability",
        ]
        report["unexecuted_case_ids"] = [
            "D" + str(i).zfill(2)
            for i in range(1, 22)
            if not any(
                row["id"].startswith("D" + str(i).zfill(2) + "_")
                for row in report["cases"]
            )
        ]
        log = out / "postgres.log"
        if log.exists():
            data = log.read_text()
            for value in [owner_password, *roles.values()]:
                data = data.replace(value, "[REDACTED]")
            log.write_text(data)
        save()
    count = len(report["cases"])
    print(f"Ran {count} tests")
    print(json.dumps(report["summary"]))
    return (
        1
        if report.get("fatal")
        or report["summary"]["FAIL"]
        or not stop_ok
        or temp.exists()
        or report["unexecuted_case_ids"]
        else 0
    )


if __name__ == "__main__":
    sys.exit(main())
