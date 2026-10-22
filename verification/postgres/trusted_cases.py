"""Live synthetic HTTP/SQL tests of the candidate boundary; no mocked HTTP/JWT/DB results."""

import http.client
from concurrent.futures import ThreadPoolExecutor
import threading
import json
import secrets
import signal
import socket
import subprocess
import sys
import time
import uuid

import jwt
import psycopg

ISSUER = "surooh-synthetic-issuer"
AUDIENCE = "surooh-wms-candidate"


def run_trusted_cases(ctx):
    root, out, temp, report = (ctx[k] for k in ["ROOT", "out", "temp", "report"])
    connect, session, scenario, stock, race = (
        ctx[k] for k in ["connect", "session", "scenario", "stock", "race"]
    )
    ids, orgs = ctx["ids"], ctx["orgs"]
    key = secrets.token_urlsafe(48)
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    audit = temp / "http-audit.jsonl"
    config = {
        "port": port,
        "pool_size": 1,
        "jwt_key": key,
        "audit_file": str(audit),
        "database": dict(
            ctx["connections"],
            dbname=ctx["db"],
            user="trusted_wms_http",
            password=ctx["roles"]["trusted_wms_http"],
        ),
    }
    cp = temp / "http-private.json"
    cp.write_text(json.dumps(config))
    cp.chmod(0o600)
    proc = None
    log = None

    def request(token, method="GET", path="/products", body=None, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=20)
        try:
            hs = {"Content-Type": "application/json", **(headers or {})}
            if token is not None:
                hs["Authorization"] = "Bearer " + token
            c.request(
                method,
                path,
                body=json.dumps(body).encode() if body is not None else None,
                headers=hs,
            )
            r = c.getresponse()
            return r.status, json.loads(r.read())
        finally:
            c.close()

    def start():
        nonlocal proc, log
        log = (out / "trusted-http.log").open("ab")
        env = {
            k: v for k, v in ctx["env"].items() if k not in ["LD_PRELOAD", "PGPASSWORD"]
        }
        env["WMS_TEST_ISOLATED"] = "true"
        argv = [
            sys.executable,
            str(root / "candidate/trusted_boundary/http_server.py"),
            "--config",
            str(cp),
        ]
        proc = subprocess.Popen(argv, env=env, stdout=log, stderr=subprocess.STDOUT)
        report["commands"].append(
            {
                "argv": argv,
                "cwd": str(root),
                "pid": proc.pid,
                "purpose": "owned synthetic HTTP service; private config not exported",
            }
        )
        until = time.monotonic() + 10
        while time.monotonic() < until:
            if proc.poll() is not None:
                raise RuntimeError("HTTP service startup failed")
            try:
                if request(None, path="/health")[0] == 200:
                    return
            except OSError:
                pass
            time.sleep(0.03)
        raise RuntimeError("HTTP readiness timeout")

    def stop(crash=False):
        if proc and proc.poll() is None:
            proc.send_signal(signal.SIGKILL if crash else signal.SIGTERM)
            proc.wait(timeout=10)
        if proc:
            for c in report["commands"]:
                if c.get("pid") == proc.pid:
                    c["exit_code"] = proc.returncode
        if log:
            log.close()

    def token(label="a_admin", company="A", **overrides):
        now = int(time.time())
        payload = {
            "iss": ISSUER,
            "aud": AUDIENCE,
            "sub": str(ids[label]),
            "company_id": str(orgs[company]),
            "source": "fixture-manual",
            "scope": "orders:write",
            "jti": uuid.uuid4().hex,
            "iat": now,
            "nbf": now - 1,
            "exp": now + 300,
            **overrides,
        }
        return jwt.encode(payload, key, algorithm="HS256")

    def payload(x, request_id, **changes):
        return {
            "company_id": str(orgs["A"]),
            "source": "fixture-manual",
            "request_id": request_id,
            "channel_id": None,
            "warehouse_id": str(x["wh"]),
            "lines": [{"product_id": str(x["p"]), "quantity": 1}],
            **changes,
        }

    def assert_status(expected, *args, **kwargs):
        result = request(*args, **kwargs)
        assert result[0] == expected, result
        return result[1]

    def case(name, fn):
        row = {"id": name}
        try:
            row.update(status="PASS", evidence=fn())
        except Exception as e:
            row.update(status="FAIL", error=type(e).__name__ + ": " + str(e))
        report["trusted_cases"].append(row)
        print(name, row["status"], row.get("error", ""), flush=True)

    def audit_rows():
        return (
            [json.loads(x) for x in audit.read_text().splitlines()]
            if audit.exists()
            else []
        )

    try:
        start()
        a = scenario("A", stock=50, parts=(1, 1))
        b = scenario("B", stock=50, parts=(1, 1))

        def signed_reads():
            ra = assert_status(200, token())
            rb = assert_status(200, token("b_admin", "B"))
            assert str(a["p"]) in ra["products"] and str(b["p"]) not in ra["products"]
            assert str(b["p"]) in rb["products"] and str(a["p"]) not in rb["products"]
            return {
                "company_A_visible": True,
                "company_B_visible": True,
                "cross_company_rows": 0,
            }

        case("H01_signed_JWT_company_RLS", signed_reads)

        def invalid_tokens():
            valid = token()
            header, body, sig = valid.split(".")
            claims = jwt.decode(valid, options={"verify_signature": False})
            claims["sub"] = str(ids["b_admin"])
            forged = jwt.encode(
                claims, "incorrect-test-key-with-at-least-32-bytes", algorithm="HS256"
            )
            for t in [
                None,
                forged,
                token(exp=int(time.time()) - 1),
                token(aud="wrong"),
                token(iss="wrong"),
                token(nbf=int(time.time()) + 100),
                jwt.encode(claims, key, algorithm="HS384"),
                jwt.encode(claims, None, algorithm="none"),
            ]:
                assert_status(401, t)
            return {"real_HTTP_rejections": 8, "algorithm_allowlist": "HS256 only"}

        case("H02_invalid_expired_forged_and_wrong_algorithm_JWT", invalid_tokens)

        def revoked():
            jti = uuid.uuid4().hex
            t = token(jti=jti)
            assert_status(200, t)
            with connect() as c:
                c.execute(
                    "insert into surooh_boundary.revoked_tokens values(%s,%s)",
                    (ISSUER, jti),
                )
            assert_status(401, t)
            stop()
            start()
            assert_status(401, t)
            return {"revocation_persisted_across_process_restart": True}

        case("H03_revoked_JWT_persistent_rejection", revoked)

        def identity_spoof():
            got = assert_status(
                200,
                token(),
                headers={
                    "X-Company-Id": str(orgs["B"]),
                    "X-User-Id": str(ids["b_admin"]),
                },
            )
            assert str(b["p"]) not in got["products"]
            assert_status(403, token(company="B"))
            bad = payload(a, "SPOOF", company_id=str(orgs["B"]))
            assert_status(403, token(), "POST", "/orders", bad)
            assert_status(404, token(), path="/products?company_id=" + str(orgs["B"]))
            return {
                "unsigned_identity_overrides": "ignored or rejected",
                "signed_cross_membership": "denied",
            }

        case("H04_subject_company_and_header_spoof_denials", identity_spoof)

        def viewer_and_no_member():
            assert_status(200, token("a_viewer", role="admin"))
            assert_status(
                403,
                token("a_viewer", role="admin"),
                "POST",
                "/orders",
                payload(a, "VIEWER"),
            )
            assert_status(403, token("outsider"))
            return {"JWT_role_does_not_grant_DB_role": True, "non_member_denied": True}

        case("H05_role_claim_escalation_and_non_member_denial", viewer_and_no_member)

        def source_policy():
            assert_status(
                400,
                token(source="fixture-bol"),
                "POST",
                "/orders",
                payload(a, "BOL-NULL", source="fixture-bol"),
            )
            assert_status(
                403,
                token(),
                "POST",
                "/orders",
                payload(a, "SRC-SPOOF", source="fixture-other"),
            )
            assert_status(
                403,
                token(source="unknown-source"),
                "POST",
                "/orders",
                payload(a, "UNKNOWN", source="unknown-source"),
            )
            result = assert_status(
                200,
                token(source="fixture-bol"),
                "POST",
                "/orders",
                payload(
                    a, "BOL-OK", source="fixture-bol", channel_id=str(a["channel"])
                ),
            )
            return {
                "external_channel_required": True,
                "unknown_or_mismatched_source_denied": True,
                "valid_result": result,
            }

        case("H06_trusted_source_and_null_channel_policy", source_policy)

        def sql_concurrency():
            x = scenario(stock=10, parts=(1, 1))
            ref = "CONCURRENT"

            def call(c):
                return c.execute(
                    "select surooh_boundary.submit_order(%s,'fixture-manual',%s,%s::jsonb,null,%s,null)",
                    (
                        orgs["A"],
                        ref,
                        json.dumps([{"product_id": str(x["p"]), "quantity": 1}]),
                        x["wh"],
                    ),
                ).fetchone()[0]

            rs = race([("a_admin", call), ("a_warehouse", call)])
            assert all(r["status"] == "OK" for r in rs), rs
            with connect() as c:
                orders = c.execute(
                    "select count(*) from orders where warehouse_id=%s", (x["wh"],)
                ).fetchone()[0]
                commands = c.execute(
                    "select count(*) from surooh_boundary.commands where company_id=%s and source_id='fixture-manual' and request_id=%s",
                    (orgs["A"], ref),
                ).fetchone()[0]
                reservations = c.execute(
                    "select count(distinct order_id) from order_reservations where warehouse_id=%s",
                    (x["wh"],),
                ).fetchone()[0]
            assert (orders, commands, reservations) == (1, 1, 1)
            assert sorted(r for _, p, r in stock(x)) == [1, 1]
            return {
                "independent_backends": rs,
                "orders": orders,
                "commands": commands,
                "reservation_orders": reservations,
                "stock": stock(x),
            }

        case("H07_two_PostgreSQL_connections_exactly_one_effect", sql_concurrency)

        x = scenario(stock=30, parts=(1, 1))
        body = payload(x, "LOST-RESPONSE")
        t = token()

        def lost_response():
            raw = json.dumps(body).encode()
            s = socket.create_connection(("127.0.0.1", port))
            s.sendall(
                (
                    f"POST /orders HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {t}\r\nContent-Type: application/json\r\nContent-Length: {len(raw)}\r\nConnection: close\r\n\r\n"
                ).encode()
                + raw
            )
            s.shutdown(socket.SHUT_WR)
            s.close()
            until = time.monotonic() + 10
            while time.monotonic() < until:
                with connect() as c:
                    row = c.execute(
                        "select result from surooh_boundary.commands where company_id=%s and source_id='fixture-manual' and request_id='LOST-RESPONSE'",
                        (orgs["A"],),
                    ).fetchone()
                if row and row[0]:
                    break
                time.sleep(0.03)
            else:
                raise AssertionError("Lost response did not commit")
            got = assert_status(200, t, "POST", "/orders", body)
            assert got == row[0]
            return {
                "previous_result_returned": got,
                "reservation_effects_per_component": [r for _, p, r in stock(x)],
            }

        case("H08_lost_HTTP_response_returns_durable_result", lost_response)

        def process_restart():
            first = assert_status(200, t, "POST", "/orders", body)
            before = stock(x)
            old = proc.pid
            stop(crash=True)
            start()
            after = assert_status(200, t, "POST", "/orders", body)
            assert first == after and before == stock(x) and old != proc.pid
            return {
                "prior_process": old,
                "new_process": proc.pid,
                "same_result": after,
                "stock_unchanged": True,
            }

        case("H09_killed_HTTP_process_and_replay", process_restart)

        def conflict():
            before = stock(x)
            changed = {**body, "lines": [{"product_id": str(x["p"]), "quantity": 2}]}
            assert_status(409, t, "POST", "/orders", changed)
            assert stock(x) == before
            return {"changed_payload_status": 409, "no_second_effect": True}

        case("H10_payload_hash_conflict_no_write", conflict)

        def key_scope():
            xa = scenario(stock=30, parts=(1, 1))
            xb = scenario("B", stock=30, parts=(1, 1))
            request_id = "SCOPED-KEY"
            first = assert_status(
                200,
                token(),
                "POST",
                "/orders",
                payload(xa, request_id, channel_id=str(xa["channel"])),
            )
            other = assert_status(
                200,
                token(source="fixture-other"),
                "POST",
                "/orders",
                payload(
                    xa,
                    request_id,
                    source="fixture-other",
                    channel_id=str(xa["channel"]),
                ),
            )
            foreign = assert_status(
                200,
                token("b_admin", "B"),
                "POST",
                "/orders",
                payload(xb, request_id, company_id=str(orgs["B"])),
            )
            assert len({first["order_id"], other["order_id"], foreign["order_id"]}) == 3
            return {"company_and_source_scoped_results": [first, other, foreign]}

        case("H11_company_source_request_key_scope", key_scope)

        def pool_reset():
            start_index = len(audit_rows())
            for _ in range(3):
                assert_status(200, token())
                assert_status(403, token(), "POST", "/orders", payload(b, "FOREIGN"))
                b_result = assert_status(200, token("b_admin", "B"))
                assert str(a["p"]) not in b_result["products"]
            rows = audit_rows()[start_index:]
            assert (
                len(rows) == 9
                and len({r["pid"] for r in rows}) == 1
                and all(r["reset_clean"] for r in rows)
            ), rows
            return {
                "reused_backend_pid": rows[0]["pid"],
                "alternating_requests": len(rows),
                "resets_verified_after_success_and_failure": True,
            }

        case("H12_single_connection_pool_no_identity_bleed", pool_reset)

        def revocation_at_execution():
            tok = token("a_warehouse")
            request_body = payload(a, "MEMBER-REVOKE")
            assert_status(200, tok, "POST", "/orders", request_body)
            with connect() as c:
                c.execute(
                    "delete from organization_members where organization_id=%s and user_id=%s",
                    (orgs["A"], ids["a_warehouse"]),
                )
            try:
                assert_status(403, tok, "POST", "/orders", request_body)
            finally:
                with connect() as c:
                    c.execute(
                        "insert into organization_members(organization_id,user_id,role) values(%s,%s,'warehouse')",
                        (orgs["A"], ids["a_warehouse"]),
                    )
            return {"old_token_cannot_replay_after_membership_revocation": True}

        case("H13_DB_membership_rechecked_on_replay", revocation_at_execution)

        def raw_rpc_denial():
            with session("a_admin") as c:
                try:
                    c.execute(
                        "select public.place_order(%s::jsonb,%s,'RAW-BYPASS',null,%s)",
                        (
                            json.dumps([{"product_id": str(a["p"]), "quantity": 1}]),
                            a["channel"],
                            a["wh"],
                        ),
                    )
                    raise AssertionError("Raw place_order exposed")
                except psycopg.Error as e:
                    assert e.sqlstate == "42501"
            for path in ["/sql", "/rpc/place_order", "/rpc/_apply_stock", "/config"]:
                assert_status(404, token(), "POST", path, {})
            return {"raw_write_RPC_and_arbitrary_HTTP_SQL": "denied"}

        case("H14_untrusted_raw_RPC_and_SQL_routes_denied", raw_rpc_denial)

        def sql_identity():
            with session("a_viewer") as c:
                c.execute(
                    "select set_config('request.jwt.claim.sub',%s,false),set_config('request.jwt.claims',%s,false)",
                    (
                        str(ids["b_admin"]),
                        json.dumps({"sub": str(ids["b_admin"]), "role": "admin"}),
                    ),
                )
                assert c.execute("select auth.uid()").fetchone()[0] == ids["a_viewer"]
                for query in [
                    "SET ROLE trusted_wms_http",
                    "SET SESSION AUTHORIZATION trusted_wms_http",
                    "select * from surooh_boundary.login_principals",
                    "select * from surooh_boundary.commands",
                ]:
                    try:
                        c.execute(query)
                        raise AssertionError("Forbidden direct SQL privilege: " + query)
                    except psycopg.Error as e:
                        assert e.sqlstate == "42501"
            return {
                "identity_bound_to_session_user": True,
                "protected_map_and_service_credential_boundary": True,
            }

        case("H15_direct_SQL_identity_cannot_be_replaced_by_claims", sql_identity)

        def source_grant_revoke():
            tok = token()
            bdy = payload(a, "SOURCE-REVOKE")
            assert_status(200, tok, "POST", "/orders", bdy)
            with connect() as c:
                c.execute(
                    "delete from surooh_boundary.source_grants where company_id=%s and source_id='fixture-manual' and subject=%s",
                    (orgs["A"], ids["a_admin"]),
                )
            try:
                assert_status(403, tok, "POST", "/orders", bdy)
            finally:
                with connect() as c:
                    c.execute(
                        "insert into surooh_boundary.source_grants values(%s,'fixture-manual',%s)",
                        (orgs["A"], ids["a_admin"]),
                    )
            return {"revoked_source_grant_blocks_cached_result": True}

        case("H16_source_grant_revocation", source_grant_revoke)

        def concurrent_http():
            x = scenario(stock=10, parts=(1, 1))
            stop()
            config["pool_size"] = 2
            cp.write_text(json.dumps(config))
            start()
            barrier = threading.Barrier(2)
            start_index = len(audit_rows())
            command = payload(x, "HTTP-RACE")
            tok = token()

            def run(_):
                barrier.wait(timeout=5)
                return request(tok, "POST", "/orders", command)

            with ThreadPoolExecutor(max_workers=2) as executor:
                responses = list(executor.map(run, range(2)))
            assert (
                all(r[0] == 200 for r in responses)
                and responses[0][1] == responses[1][1]
            ), responses
            rows = audit_rows()[start_index:]
            assert len({r["pid"] for r in rows}) == 2, rows
            with connect() as c:
                count = c.execute(
                    "select count(*) from orders where warehouse_id=%s", (x["wh"],)
                ).fetchone()[0]
                assert count == 1
            assert sorted(r for _, p, r in stock(x)) == [1, 1]
            return {
                "HTTP_responses": responses,
                "independent_HTTP_SQL_backend_pids": sorted({r["pid"] for r in rows}),
                "orders": count,
                "one_effect_per_component": True,
            }

        case("H17_concurrent_HTTP_requests_two_native_connections", concurrent_http)

        def multiple_memberships():
            subject = uuid.uuid4()
            with connect() as c:
                c.execute(
                    "insert into auth.users values(%s,%s)",
                    (subject, "jwt-only@example.invalid"),
                )
                for company in orgs.values():
                    c.execute(
                        "insert into organization_members(organization_id,user_id,role) values(%s,%s,'admin')",
                        (company, subject),
                    )
                    c.execute(
                        "insert into surooh_boundary.source_grants values(%s,'fixture-manual',%s)",
                        (company, subject),
                    )
                assert (
                    c.execute(
                        "select count(*) from surooh_boundary.login_principals where subject=%s",
                        (subject,),
                    ).fetchone()[0]
                    == 0
                )
            first = assert_status(200, token(sub=str(subject)))
            second = assert_status(200, token(company="B", sub=str(subject)))
            assert (
                str(a["p"]) in first["products"]
                and str(b["p"]) not in first["products"]
            )
            assert (
                str(b["p"]) in second["products"]
                and str(a["p"]) not in second["products"]
            )
            assert_status(
                403,
                token(sub=str(subject)),
                "POST",
                "/orders",
                payload(b, "DUAL-MEMBER-FOREIGN"),
            )
            return {
                "JWT_only_subject_has_no_SQL_login_mapping": True,
                "token_company_narrows_multi_company_membership": True,
            }

        case("H18_multi_company_JWT_only_subject_scope", multiple_memberships)

    finally:
        stop()
        if audit.exists():
            (out / "trusted-http-audit.json").write_text(
                json.dumps(audit_rows(), indent=2) + "\n"
            )
        report["http_service_cleanup"] = {
            "stopped": proc is None or proc.poll() is not None,
            "private_config_exported": False,
            "binding": "127.0.0.1",
            "pool_size": config["pool_size"],
        }
