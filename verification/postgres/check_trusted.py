"""Fail-closed completeness check; the outer verifier binds SHA, logs and artifacts."""

import argparse
import json
from pathlib import Path


def validate(report):
    for key, prefix, count in [("cases", "D", 21), ("trusted_cases", "H", 18)]:
        rows = report.get(key, [])
        expected = {f"{prefix}{i:02d}" for i in range(1, count + 1)}
        if len(rows) != count or {x["id"].split("_")[0] for x in rows} != expected:
            raise ValueError(f"{key}: missing, duplicate or unknown cases")
        if any(x.get("status") != "PASS" for x in rows):
            raise ValueError(f"{key}: non-PASS result")
    if report.get("fatal") or report.get("source_dirty_tracked") is not False:
        raise ValueError("Fatal error or dirty source")
    if len(report.get("migrations", [])) != 23 or any(
        x["status"] != "PASS" for x in report["migrations"]
    ):
        raise ValueError("Historical migration coverage incomplete")
    if report.get("trusted_http_jwt_proven") is not True:
        raise ValueError("Real candidate HTTP not proven")
    if report.get("cleanup") != {
        "server_stopped": True,
        "private_cluster_removed": True,
    }:
        raise ValueError("Database cleanup incomplete")
    if report.get("http_service_cleanup", {}).get("stopped") is not True:
        raise ValueError("HTTP cleanup incomplete")
    return 18


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        count = validate(
            json.loads(
                (args.artifact_dir / "postgres/database-results.json").read_text()
            )
        )
    except (ValueError, KeyError, OSError, TypeError) as error:
        print(f"BLOCKED: {error}")
        return 1
    print(f"Ran {count} tests")
    print(
        "Candidate HTTP evidence complete. No deployed integration or phase approval implied."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
