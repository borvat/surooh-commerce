"""Local synthetic verification with exact Git inputs and redacted evidence; no deployment."""

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
G0 = "HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def redact(text):
    text = re.sub(r"(?i)(authorization\s*[:=]\s*)[^\r\n]+", r"\1[REDACTED]", text)
    text = re.sub(
        r"(?i)((?:api_secret|db_password|encryption_key|access_token|refresh_token)\s*[:=]\s*)[^,\s]+",
        r"\1[REDACTED]",
        text,
    )
    return re.sub(
        r"(postgres(?:ql)?|mysql|mariadb)://[^/@\s]+:[^/@\s]+@",
        r"\1://[REDACTED]@",
        text,
    )


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def snapshot():
    return {
        "commit_sha": git("rev-parse", "HEAD"),
        "tree_sha": git("rev-parse", "HEAD^{tree}"),
        "dirty_tracked": bool(git("status", "--porcelain", "--untracked-files=no")),
    }


def execute(test_id, tier, argv, output, env, timeout=600, blocked_codes=()):
    start = time.monotonic()
    row = {
        "id": test_id,
        "tier": tier,
        "command": [str(x) for x in argv],
        "cwd": str(ROOT),
        "timeout_seconds": timeout,
    }
    raw = b""
    try:
        proc = subprocess.Popen(
            row["command"],
            cwd=ROOT,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        try:
            raw, _ = proc.communicate(timeout=timeout)
            code = proc.returncode
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                raw, _ = proc.communicate(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                raw, _ = proc.communicate()
            code = 124
        status = (
            "PASS" if code == 0 else ("BLOCKED" if code in blocked_codes else "FAIL")
        )
    except OSError as exc:
        raw = (type(exc).__name__ + ": " + str(exc)).encode()
        code = 127
        status = "BLOCKED"
    log = redact(raw.decode(errors="replace")).encode()
    path = output / "logs" / (test_id + ".log")
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(log)
    row.update(
        status=status,
        exit_code=code,
        duration_seconds=round(time.monotonic() - start, 3),
        log=str(path.relative_to(output)),
        log_sha256=sha256(log),
        raw_output_sha256=sha256(raw),
    )
    return row


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=["accounting", "wms"], required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--tools-python", default=sys.executable)
    parser.add_argument("--bun", default="bun")
    parser.add_argument("--lab-root", type=Path)
    parser.add_argument("--accounting-report", type=Path)
    parser.add_argument("--expected-sha")
    parser.add_argument("--accounting-expected-sha")
    parser.add_argument("--postgres-bin", type=Path)
    parser.add_argument("--db-python", type=Path)
    parser.add_argument("--allow-uid-compat", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.is_relative_to(ROOT):
        parser.error("Evidence must be outside the source checkout")
    if output.exists():
        parser.error("Use a new evidence directory; prior runs are immutable")
    output.mkdir(parents=True)
    (output / "artifacts").mkdir()
    home = output / "private-runtime-home"
    home.mkdir(mode=0o700)
    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": str(home),
        "TMPDIR": "/tmp",
        "LANG": "C.UTF-8",
        "TZ": "UTC",
        "NO_COLOR": "1",
        "PYTHONUNBUFFERED": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
        "BOL_WRITE_ENABLED": "false",
        "WMS_TEST_ISOLATED": "true",
        "WMS_TEST_DATABASE_URL": "postgresql://fixture:fixture@127.0.0.1:15432/wms_test_alternative",
        "VITE_SUPABASE_URL": "http://127.0.0.1:15432",
        "VITE_SUPABASE_PUBLISHABLE_KEY": "SYNTHETIC-PUBLISHABLE-NOT-A-REAL-KEY",
    }
    bun_binary = (
        shutil.which(args.bun) if not Path(args.bun).is_absolute() else args.bun
    )
    if bun_binary:
        env["PATH"] = str(Path(bun_binary).resolve().parent) + os.pathsep + env["PATH"]
    source = snapshot()
    if source["dirty_tracked"] or (
        args.expected_sha and args.expected_sha != source["commit_sha"]
    ):
        parser.error("Clean exact reviewed Git commit required")
    plan = json.loads((ROOT / "verification/plan.json").read_text())
    if plan["component"] != args.profile:
        parser.error("Profile does not match repository")
    report = {
        "schema_version": 1,
        "component": args.profile,
        "source": source,
        "started_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "environment": {
            "platform": platform.platform(),
            "python": sys.version.split()[0],
            "uid": os.getuid(),
            "env_policy": "allowlisted variables only; no inherited provider/DB/OAuth credentials",
        },
        "g0": G0,
        "codex_start_authorized": False,
        "phase_completion_authorized": False,
        "plan_sha256": sha256((ROOT / "verification/plan.json").read_bytes()),
        "tests": [],
        "open_gate_policy": "G1-G6 remain independently required; local evidence is not hosted CI or production approval",
    }
    for name, argv in [
        ("node", ["node", "--version"]),
        ("bun", [args.bun, "--version"]),
        ("tools_python", [args.tools_python, "--version"]),
    ]:
        try:
            v = subprocess.run(
                argv,
                env=env,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                timeout=15,
            )
            report["environment"][name] = {
                "version": redact(v.stdout.strip()),
                "exit_code": v.returncode,
            }
        except OSError:
            report["environment"][name] = {"version": "UNAVAILABLE", "exit_code": 127}
    for name in [
        "bun.lock",
        "pyproject.toml",
        "verification/tool-versions.json",
        "contracts/shared-core-authority.json",
    ]:
        p = ROOT / name
        if p.exists():
            report.setdefault("input_hashes", {})[name] = sha256(p.read_bytes())
    replacements = {
        "{python}": sys.executable,
        "{tools_python}": args.tools_python,
        "{bun}": args.bun,
        "{artifact_dir}": str(output / "artifacts"),
    }
    for test in plan["tests"]:
        row = {"id": test["id"], "tier": test["tier"]}
        command = test.get("command")
        if test.get("postgres"):
            if args.postgres_bin is None or args.db_python is None:
                row.update(
                    status="BLOCKED",
                    exit_code=None,
                    command=None,
                    reason="Explicit pinned local PostgreSQL/Python runtime required",
                )
            else:
                command = [
                    "node",
                    "scripts/wms/db-check.mjs",
                    "--postgres-bin",
                    str(args.postgres_bin.resolve()),
                    "--db-python",
                    str(args.db_python.absolute()),
                    "--artifact-dir",
                    str(output / "artifacts/postgres"),
                ]
                if args.allow_uid_compat:
                    command.append("--allow-uid-compat")
        elif test.get("native"):
            if args.lab_root is None:
                row.update(
                    status="BLOCKED",
                    exit_code=None,
                    command=None,
                    reason="Explicit prepared synthetic-only lab root required",
                )
            else:
                command = [
                    sys.executable,
                    "verification/native_driver.py",
                    "--lab-root",
                    str(args.lab_root.resolve()),
                    "--output",
                    str(output / "artifacts/native"),
                    "--suite",
                    test["native"],
                ]
        elif test.get("linked_accounting"):
            if args.accounting_report is None or args.accounting_expected_sha is None:
                row.update(
                    status="BLOCKED",
                    exit_code=None,
                    command=None,
                    reason="Pinned Accounting native report required; not a separate WMS engine execution",
                )
            else:
                command = [
                    sys.executable,
                    "verification/link_native.py",
                    "--report",
                    str(args.accounting_report.resolve()),
                    "--output",
                    str(output / "artifacts/accounting-native-link.json"),
                    "--expected-sha",
                    args.accounting_expected_sha,
                ]
        if command:
            argv = [replacements.get(x, x) for x in command]
            row = execute(
                test["id"],
                test["tier"],
                argv,
                output,
                env,
                test.get("timeout", 600),
                test.get("blocked_exit_codes", []),
            )
        elif "status" not in row:
            row.update(
                status="BLOCKED", exit_code=None, command=None, reason=test["reason"]
            )
        if test.get("min_executed_tests") and row.get("log"):
            log_text = (output / row["log"]).read_text()
            count = None
            for pattern in [
                r"Ran (\d+) tests?",
                r"(?:#\s*tests|ℹ\s*tests)\s+(\d+)",
                r"(\d+) pass",
            ]:
                match = re.search(pattern, log_text)
                if match:
                    count = int(match.group(1))
                    break
            row["executed_test_count"] = count
            if row["status"] == "PASS" and (
                count is None or count < test["min_executed_tests"]
            ):
                row["status"] = "FAIL"
                row["validation_failure"] = (
                    "No positive executed test count; exit0 alone is insufficient"
                )
        report["tests"].append(row)
        print(row["id"], row["status"], row["exit_code"], flush=True)
        (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    report["source_after"] = snapshot()
    if report["source_after"]["dirty_tracked"]:
        patch = subprocess.check_output(["git", "diff", "--binary"], cwd=ROOT)
        (output / "artifacts/tracked-source.patch").write_text(
            redact(patch.decode(errors="replace"))
        )
    if args.profile == "wms":
        build_files = []
        for name in ["dist", ".output", "dist-ssr"]:
            folder = ROOT / name
            if folder.exists():
                for path in sorted(folder.rglob("*")):
                    if path.is_file() and not path.is_symlink():
                        build_files.append(
                            {
                                "path": str(path.relative_to(ROOT)),
                                "bytes": path.stat().st_size,
                                "sha256": sha256(path.read_bytes()),
                            }
                        )
        (output / "artifacts/build-output-manifest.json").write_text(
            json.dumps(build_files, indent=2) + "\n"
        )
    packages_code = "import importlib.metadata as m,json;print(json.dumps({k:m.version(k) for k in ['ruff','build','flit_core','packaging','pyproject_hooks']}))"
    try:
        versions = subprocess.run(
            [args.tools_python, "-c", packages_code],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=20,
        )
        report["environment"]["tools_distributions"] = (
            json.loads(versions.stdout)
            if versions.returncode == 0
            else {"error": redact(versions.stdout), "exit_code": versions.returncode}
        )
    except OSError as exc:
        report["environment"]["tools_distributions"] = {"error": str(exc)}
    report["tracked_diff"] = git("diff", "--stat")
    report["finished_at_utc"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    report["summary"] = {
        s: sum(t["status"] == s for t in report["tests"])
        for s in ["PASS", "FAIL", "BLOCKED"]
    }
    artifacts = []
    for p in sorted((output / "artifacts").rglob("*")):
        if p.is_file() and not p.is_symlink():
            artifacts.append(
                {"path": str(p.relative_to(output)), "sha256": sha256(p.read_bytes())}
            )
    report["artifacts"] = artifacts
    report["evidence_review"] = {
        "decision": None,
        "reviewer": None,
        "review_reference": None,
    }
    (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    # Do not archive tool HOME caches or generated credentials.
    shutil.rmtree(home)
    print(json.dumps(report["summary"]))
    return (
        1 if report["summary"]["FAIL"] else (2 if report["summary"]["BLOCKED"] else 0)
    )


if __name__ == "__main__":
    raise SystemExit(main())
