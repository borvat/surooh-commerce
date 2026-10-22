"""New isolated native site probe. Never replays seeded sites or changes upstream code."""

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
import traceback

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runtime-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--accounting-root", type=Path, required=True)
    parser.add_argument("--bun", type=Path, required=True)
    args = parser.parse_args()
    lab, out = args.runtime_root.resolve(), args.output.resolve()
    accounting = args.accounting_root.resolve()
    if not (accounting / "surooh_accounting/native_lab/api.py").is_file():
        parser.error("Explicit Accounting native candidate source required")
    if not (lab / ".synthetic-only").is_file():
        parser.error("Marked synthetic runtime required")
    if out.exists():
        parser.error("Fresh evidence directory required")
    out.mkdir(parents=True)
    report = {
        "source_sha": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip(),
        "dirty_tracked": bool(
            subprocess.check_output(
                ["git", "status", "--porcelain"], cwd=ROOT, text=True
            ).strip()
        ),
        "started_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "os_identity_isolation": "BLOCKED",
        "commands": [],
        "source_archives": {},
        "accounting_sha": subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=accounting, text=True
        ).strip(),
        "accounting_dirty": bool(
            subprocess.check_output(
                ["git", "status", "--porcelain"], cwd=accounting, text=True
            ).strip()
        ),
        "fresh_database": True,
        "seed_restore_used": False,
        "upstream_patched": False,
        "status": "BLOCKED",
        "phase_complete": False,
        "codex_start_authorized": False,
        "merge_authorized": False,
        "deploy_authorized": False,
    }
    procs = []
    work = None
    password = secrets.token_urlsafe(30)
    env = {k: v for k, v in os.environ.items() if k in ["PATH", "LANG", "LC_ALL", "TZ"]}
    env["PATH"] = (
        str(lab / "src/mariadb-11.8.9-linux-systemd-x86_64/bin")
        + ":"
        + env.get("PATH", "/usr/bin:/bin")
    )
    env["LD_LIBRARY_PATH"] = str(lab / "native/usr/lib/x86_64-linux-gnu")
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["WMS_TEST_ISOLATED"] = "true"
    env["SUROOH_NATIVE_INTEGRATION"] = "true"
    env["PYTHONPATH"] = (
        str(accounting / "validation/native_guard") + os.pathsep + str(accounting)
    )
    env["SUROOH_WMS_ROOT"] = str(ROOT)
    env["SUROOH_BUN"] = str(args.bun.absolute())
    env["LC_ALL"] = "C.UTF-8"
    private_values = [password]

    def safe(data):
        for v in private_values:
            data = data.replace(v, "[REDACTED]")
        return data

    def command(argv, name, cwd=None, timeout=600):
        result = subprocess.run(
            [str(x) for x in argv],
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout,
        )
        data = safe(result.stdout)
        (out / (name + ".log")).write_text(data)
        report["commands"].append(
            {
                "command": [str(x) for x in argv],
                "cwd": str(cwd or ROOT),
                "exit_code": result.returncode,
                "log": name + ".log",
                "sha256": hashlib.sha256(data.encode()).hexdigest(),
            }
        )
        if result.returncode:
            raise RuntimeError(name + " failed; see preserved log")
        return result

    try:
        for archive, folder in [
            ("frappe.tar.gz", "frappe-16.52.0"),
            ("erpnext.tar.gz", "erpnext-16.52.0"),
        ]:
            p = lab / "src" / archive
            report["source_archives"][archive] = hashlib.sha256(
                p.read_bytes()
            ).hexdigest()
            count = 0
            with tarfile.open(p) as tar:
                for m in tar:
                    if not m.isfile():
                        continue
                    parts = Path(m.name).parts[1:]
                    f = lab / "src" / folder / Path(*parts)
                    if (
                        not f.is_file()
                        or hashlib.sha256(f.read_bytes()).digest()
                        != hashlib.sha256(tar.extractfile(m).read()).digest()
                    ):
                        raise RuntimeError(
                            "Upstream differs from archive: "
                            + str(Path(folder) / Path(*parts))
                        )
                    count += 1
            report["source_archives"][folder + "_files_verified"] = count
        free = shutil.disk_usage(ROOT).free
        report["free_bytes_before"] = free
        if free < 300_000_000:
            raise RuntimeError("Less than300MB free; fresh schema cannot safely fit")
        for port in [14306, 17379]:
            with socket.socket() as s:
                s.bind(("127.0.0.1", port))
        work = Path(tempfile.mkdtemp(prefix="surooh-new-native-", dir=out.parent))
        work.chmod(0o700)
        bench = work / "bench"
        sites = bench / "sites"
        sites.mkdir(parents=True)
        (bench / "logs").mkdir()
        (bench / "config").mkdir()
        (bench / "apps").mkdir()
        for app in ["frappe", "erpnext"]:
            (bench / "apps" / app).symlink_to(
                lab / "src" / (app + "-16.52.0"), target_is_directory=True
            )
        (bench / "apps/surooh_accounting").symlink_to(
            accounting, target_is_directory=True
        )
        (bench / "apps/surooh_native_guard").symlink_to(
            accounting / "validation/native_guard", target_is_directory=True
        )
        (sites / "apps.txt").write_text(
            "frappe\nerpnext\nsurooh_accounting\nsurooh_native_guard\n"
        )
        common = {
            "redis_cache": "redis://127.0.0.1:17379/0",
            "redis_queue": "redis://127.0.0.1:17379/1",
            "redis_socketio": "redis://127.0.0.1:17379/2",
            "db_host": "127.0.0.1",
            "db_port": 14306,
            "developer_mode": 0,
            "maintenance_mode": 1,
            "pause_scheduler": 1,
            "server_script_enabled": False,
        }
        (sites / "common_site_config.json").write_text(json.dumps(common))
        env["FRAPPE_BENCH_ROOT"] = str(bench)
        env["HOME"] = str(work / "home")
        Path(env["HOME"]).mkdir()
        maria = lab / "src/mariadb-11.8.9-linux-systemd-x86_64"
        data = work / "database"
        command(
            [
                maria / "scripts/mariadb-install-db",
                "--no-defaults",
                "--basedir=" + str(maria),
                "--datadir=" + str(data),
                "--auth-root-authentication-method=normal",
                "--skip-test-db",
            ],
            "database-init",
            ROOT,
        )
        init = work / "private-init.sql"
        init.write_text(
            "ALTER USER 'root'@'localhost' IDENTIFIED BY '" + password + "';\n"
        )
        init.chmod(0o600)
        starts = [
            (
                "mariadb",
                [
                    maria / "bin/mariadbd",
                    "--no-defaults",
                    "--user=root",
                    "--basedir=" + str(maria),
                    "--datadir=" + str(data),
                    "--socket=",
                    "--pid-file=" + str(work / "maria.pid"),
                    "--bind-address=127.0.0.1",
                    "--port=14306",
                    "--skip-log-bin",
                    "--character-set-server=utf8mb4",
                    "--collation-server=utf8mb4_unicode_ci",
                    "--innodb-buffer-pool-size=64M",
                    "--innodb-log-file-size=16M",
                    "--init-file=" + str(init),
                ],
            ),
            (
                "redis",
                [
                    lab / "native/usr/bin/redis-server",
                    "--bind",
                    "127.0.0.1",
                    "--port",
                    "17379",
                    "--save",
                    "",
                    "--appendonly",
                    "no",
                ],
            ),
        ]
        for name, argv in starts:
            handle = (out / (name + ".log")).open("w")
            proc = subprocess.Popen(
                [str(x) for x in argv], env=env, stdout=handle, stderr=subprocess.STDOUT
            )
            procs.append((proc, handle, name))
            report["commands"].append(
                {
                    "command": [str(x) for x in argv],
                    "pid": proc.pid,
                    "kind": "owned service",
                    "log": name + ".log",
                }
            )
        for port in [14306, 17379]:
            for _ in range(80):
                try:
                    with socket.create_connection(("127.0.0.1", port), timeout=0.3):
                        break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("Fresh service failed startup: " + str(port))
        private = work / "private-bootstrap.json"
        private.write_text(
            json.dumps(
                {"password": password, "sites": str(sites), "evidence": str(out)}
            )
        )
        private.chmod(0o600)
        command(
            [
                lab / "erpnext-venv/bin/python",
                "-c",
                "import sys,json,importlib.metadata as m,frappe,erpnext,surooh_accounting,jwt;print(json.dumps({'python':sys.version,'frappe':frappe.__version__,'erpnext':erpnext.__version__,'pyjwt':jwt.__version__,'app_source':surooh_accounting.__file__,'packages':{x:m.version(x) for x in ['rq','redis','PyMySQL','Werkzeug']}}))",
            ],
            "native-runtime",
            sites,
        )
        report["native_runtime"] = json.loads((out / "native-runtime.log").read_text())
        command(
            [
                lab / "erpnext-venv/bin/python",
                ROOT / "verification/native_integration/install_site.py",
                "--config",
                private,
            ],
            "site-install",
            sites,
            timeout=900,
        )
        native = json.loads((out / "native-tests.json").read_text())
        report["native_summary"] = {
            state: sum(x["status"] == state for x in native["cases"])
            for state in ["PASS", "FAIL", "BLOCKED"]
        }
        report["status"] = (
            "PARTIAL_NATIVE_EXECUTED"
            if report["native_summary"]["BLOCKED"]
            else "NATIVE_CANDIDATE_EXECUTED"
        )
        report["phase_complete"] = False
        report["codex_start_authorized"] = False
        report["fresh_two_sites_installed"] = True
        report["installed_site"] = "wms-native-a.invalid"
    except Exception as error:
        report["blocker"] = safe(str(error))
        report["traceback"] = safe(traceback.format_exc())
        print("BLOCKED", report["blocker"], flush=True)
    finally:
        for proc, handle, name in reversed(procs):
            proc.terminate()
            try:
                code = proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                proc.kill()
                code = proc.wait(timeout=5)
            handle.close()
            report.setdefault("service_shutdown", []).append(
                {"name": name, "exit_code": code}
            )
            p = out / (name + ".log")
            p.write_text(safe(p.read_text(errors="replace")))
        if work:
            shutil.rmtree(work)
        report["private_runtime_removed"] = work is None or not work.exists()
        install_log = out / "site-install.log"
        report["fresh_install_succeeded"] = (
            install_log.is_file()
            and "FRESH_SITE_INSTALLED_NO_COMPANIES"
            in install_log.read_text(errors="replace")
        )
        report["finished_at_utc"] = datetime.datetime.now(
            datetime.timezone.utc
        ).isoformat()
        for p in out.glob("*.log"):
            report.setdefault("log_hashes", {})[p.name] = hashlib.sha256(
                p.read_bytes()
            ).hexdigest()
        report["source_after"] = {
            "wms_sha": subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
            ).strip(),
            "accounting_sha": subprocess.check_output(
                ["git", "rev-parse", "HEAD"], cwd=accounting, text=True
            ).strip(),
            "wms_dirty": bool(
                subprocess.check_output(
                    ["git", "status", "--porcelain"], cwd=ROOT, text=True
                ).strip()
            ),
            "accounting_dirty": bool(
                subprocess.check_output(
                    ["git", "status", "--porcelain"], cwd=accounting, text=True
                ).strip()
            ),
        }
        for name in ["native-tests.json"]:
            p = out / name
            if p.is_file():
                report.setdefault("artifact_hashes", {})[name] = hashlib.sha256(
                    p.read_bytes()
                ).hexdigest()
        (out / "bootstrap-results.json").write_text(json.dumps(report, indent=2) + "\n")
    print(report["status"], flush=True)
    return 0 if report["status"] == "NATIVE_CANDIDATE_EXECUTED" else 2


if __name__ == "__main__":
    sys.exit(main())
