"""Review-only exact-pair gate. UI/OS failures never inherit native successes."""

import argparse
import hashlib
import json
from pathlib import Path
import sys


def evaluate(base, wms_sha, accounting_sha):
    base = Path(base)
    report = json.loads((base / "bootstrap-results.json").read_text())
    errors = []
    if (
        report.get("source_sha") != wms_sha
        or report.get("accounting_sha") != accounting_sha
    ):
        errors.append("exact source pair mismatch")
    if report.get("dirty_tracked") or report.get("accounting_dirty"):
        errors.append("dirty source")
    if (
        not report.get("fresh_database")
        or report.get("seed_restore_used")
        or report.get("upstream_patched")
        or not report.get("fresh_two_sites_installed")
    ):
        errors.append("fresh unpatched two-site execution not proven")
    after = report.get("source_after", {})
    if after != {
        "wms_sha": wms_sha,
        "accounting_sha": accounting_sha,
        "wms_dirty": False,
        "accounting_dirty": False,
    }:
        errors.append("source changed or not checked after execution")
    commands = report.get("commands", [])
    shutdown = {
        row.get("name"): row.get("exit_code")
        for row in report.get("service_shutdown", [])
    }
    if not commands:
        errors.append("bootstrap/native commands missing")
    for row in commands:
        if row.get("kind") == "owned service":
            name = Path(row.get("log", "")).stem
            if not name or shutdown.get(name) != 0:
                errors.append("owned service shutdown did not succeed: " + name)
        elif row.get("exit_code") != 0:
            errors.append("bootstrap/native command did not succeed")
    for name, digest in {
        **report.get("log_hashes", {}),
        **report.get("artifact_hashes", {}),
    }.items():
        path = (base / name).resolve()
        if (
            not path.is_relative_to(base.resolve())
            or not path.is_file()
            or hashlib.sha256(path.read_bytes()).hexdigest() != digest
        ):
            errors.append("missing/tampered evidence: " + name)
    if "native-tests.json" not in report.get("artifact_hashes", {}) or not report.get(
        "log_hashes"
    ):
        errors.append("native case/log hashes missing")
    rows = json.loads((base / "native-tests.json").read_text())["cases"]
    ids = [row["id"].split("_")[0] for row in rows]
    required = (
        {f"N{x:02d}" for x in range(1, 19)}
        | {"N01b", "N05a"}
        | {f"A{x:02d}" for x in range(1, 10)}
        | {f"O{x:02d}" for x in range(1, 10)}
        | {f"S{x:02d}" for x in range(1, 4)}
        | {f"P{x:02d}" for x in range(1, 7)}
    )
    if len(ids) != len(set(ids)) or set(ids) != required | {"B01"}:
        errors.append("missing/duplicate/unknown native cases")
    mapping = {row["id"].split("_")[0]: row for row in rows}
    if any(mapping.get(key, {}).get("status") != "PASS" for key in required):
        errors.append("required native regression/atomic case not PASS")
    ui = (
        "READY_FOR_HUMAN_EVIDENCE_REVIEW"
        if not errors and mapping.get("B01", {}).get("status") == "PASS"
        else "BLOCKED"
    )
    return {
        "native_atomic_candidate": "BLOCKED"
        if errors
        else "READY_FOR_HUMAN_EVIDENCE_REVIEW",
        "errors": errors,
        "rendered_UI_cycle": ui,
        "operational_service_isolation": "BLOCKED",
        "hosted_CI": "BLOCKED",
        "PREPARATION": "BLOCKED",
        "P01": "BLOCKED",
        "phase_complete": False,
        "codex_start_authorized": False,
        "merge_authorized": False,
        "deploy_authorized": False,
        "human_review_required": True,
        "wms_sha": wms_sha,
        "accounting_sha": accounting_sha,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-dir", required=True, type=Path)
    parser.add_argument("--wms-sha", required=True)
    parser.add_argument("--accounting-sha", required=True)
    args = parser.parse_args()
    result = evaluate(args.artifact_dir, args.wms_sha, args.accounting_sha)
    print(json.dumps(result, indent=2))
    return 0 if result["rendered_UI_cycle"] != "BLOCKED" and not result["errors"] else 2


if __name__ == "__main__":
    sys.exit(main())
