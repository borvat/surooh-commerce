"""Independent fail-closed evidence review gate; never marks a phase complete."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def evaluate(report, plan, base, phase, expected_sha):
    errors = []
    base = Path(base).resolve()
    source = report.get("source", {})
    if (
        not re.fullmatch("[0-9a-f]{40}", expected_sha or "")
        or source.get("commit_sha") != expected_sha
    ):
        errors.append("stale or invalid commit SHA")
    if source.get("dirty_tracked") or report.get("source_after", {}).get(
        "dirty_tracked"
    ):
        errors.append("tracked source changed during verification")
    if report.get("source_after", {}).get("commit_sha") != expected_sha:
        errors.append("source changed during verification")
    if report.get("component") != plan.get("component"):
        errors.append("component mismatch")
    canonical = (ROOT / "verification/plan.json").read_bytes()
    if report.get("plan_sha256") != hashlib.sha256(canonical).hexdigest():
        errors.append("verification plan changed")
    required = plan.get("required_tests_by_scope", {}).get(phase)
    if not required:
        errors.append("unknown or empty scope")
    rows = report.get("tests", [])
    mapping = {r.get("id"): r for r in rows}
    if len(mapping) != len(rows):
        errors.append("duplicate test IDs")
    specs = {x["id"]: x for x in plan["tests"]}
    for test_id in required or []:
        row = mapping.get(test_id, {})
        if (
            row.get("status") != "PASS"
            or row.get("exit_code") != 0
            or not row.get("command")
        ):
            errors.append("required test not executed successfully: " + test_id)
        minimum = specs.get(test_id, {}).get("min_executed_tests", 0)
        if minimum and (
            not isinstance(row.get("executed_test_count"), int)
            or row["executed_test_count"] < minimum
        ):
            errors.append("no positive executed test count: " + test_id)
        if row.get("tier") != specs.get(test_id, {}).get("tier"):
            errors.append("test tier mismatch: " + test_id)
    for row in rows:
        if row.get("status") == "PASS" and (
            row.get("exit_code") != 0 or not row.get("command")
        ):
            errors.append("unexecuted/failing test cannot be PASS")
        if row.get("command") and not row.get("log"):
            errors.append("executed test has no log: " + str(row.get("id")))
        if row.get("log"):
            p = (base / row["log"]).resolve()
            if (
                not p.is_relative_to(base)
                or not p.is_file()
                or hashlib.sha256(p.read_bytes()).hexdigest() != row.get("log_sha256")
            ):
                errors.append("missing/tampered/outside log: " + str(row.get("id")))
    for artifact in report.get("artifacts", []):
        p = (base / artifact.get("path", "")).resolve()
        if (
            not p.is_relative_to(base)
            or not p.is_file()
            or hashlib.sha256(p.read_bytes()).hexdigest() != artifact.get("sha256")
        ):
            errors.append("missing/tampered/outside artifact")
    if not report.get("artifacts"):
        errors.append("no build/native artifacts captured")
    for key in ["codex_start_authorized", "phase_completion_authorized"]:
        if report.get(key) is not False:
            errors.append("evidence cannot authorize execution/completion")
    return {
        "status": "BLOCKED" if errors else "READY_FOR_HUMAN_EVIDENCE_REVIEW",
        "errors": errors,
        "scope": phase,
        "tested_commit": expected_sha,
        "hosted_ci": "BLOCKED",
        "phase_complete": False,
        "codex_start_authorized": False,
        "merge_authorized": False,
        "deploy_authorized": False,
        "human_review_required": True,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--report", type=Path, required=True)
    p.add_argument("--phase", required=True)
    p.add_argument("--expected-sha", required=True)
    a = p.parse_args()
    plan = json.loads((ROOT / "verification/plan.json").read_text())
    report = json.loads(a.report.read_text())
    result = evaluate(report, plan, a.report.parent, a.phase, a.expected_sha)
    print(json.dumps(result, indent=2))
    return 2 if result["status"] == "BLOCKED" else 0


if __name__ == "__main__":
    sys.exit(main())
