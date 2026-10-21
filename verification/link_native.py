"""Verify and link a real Accounting native run; never a second WMS engine run."""

import argparse
import hashlib
import json
from pathlib import Path


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--report", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--expected-sha", required=True)
    a = p.parse_args()
    report = json.loads(a.report.read_text())
    base = a.report.parent.resolve()
    assert (
        report["component"] == "accounting"
        and not report["source"]["dirty_tracked"]
        and not report["source_after"]["dirty_tracked"]
    )
    assert report["source"]["commit_sha"] == report["source_after"]["commit_sha"]
    tests = {t["id"]: t for t in report["tests"]}
    for key in ["native_mitigation", "native_isolation"]:
        t = tests[key]
        assert t["status"] == "PASS" and t["exit_code"] == 0
        f = (base / t["log"]).resolve()
        assert (
            f.is_relative_to(base)
            and hashlib.sha256(f.read_bytes()).hexdigest() == t["log_sha256"]
        )
    copied = []
    for item in report["artifacts"]:
        f = (base / item["path"]).resolve()
        assert (
            f.is_relative_to(base)
            and hashlib.sha256(f.read_bytes()).hexdigest() == item["sha256"]
        )
        if f.name in ["native-results.json", "isolation-results.json", "runtime.json"]:
            target = a.output.parent / ("linked-" + f.name)
            target.write_bytes(f.read_bytes())
            copied.append({"path": target.name, "sha256": item["sha256"]})
    assert any(x["path"] == "linked-native-results.json" for x in copied) and any(
        x["path"] == "linked-isolation-results.json" for x in copied
    )
    a.output.write_text(
        json.dumps(
            {
                "scope": "linked Accounting synthetic native evidence; not WMS UI/end-to-end acceptance",
                "accounting_source": report["source"],
                "accounting_report_sha256": hashlib.sha256(
                    a.report.read_bytes()
                ).hexdigest(),
                "linked_artifacts": copied,
                "production_acceptance": False,
            },
            indent=2,
        )
        + "\n"
    )
    print("VERIFIED native source and artifacts; full WMS integration remains blocked")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
