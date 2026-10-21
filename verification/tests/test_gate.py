"""Gate-security tests only; synthetic fixture records are not native financial tests."""

import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import gate


class IndependentGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        (self.base / "verification").mkdir()
        self.old_root = gate.ROOT
        gate.ROOT = self.base
        self.plan = {
            "component": "synthetic-gate-unit",
            "required_tests_by_scope": {"PREPARATION": ["native_case"]},
            "tests": [{"id": "native_case", "tier": "native_database"}],
        }
        raw = json.dumps(self.plan).encode()
        (self.base / "verification/plan.json").write_bytes(raw)
        (self.base / "test.log").write_text("synthetic gate unit fixture\n")
        (self.base / "artifact.json").write_text("{}")
        self.sha = "a" * 40
        self.report = {
            "component": "synthetic-gate-unit",
            "plan_sha256": hashlib.sha256(raw).hexdigest(),
            "source": {"commit_sha": self.sha, "dirty_tracked": False},
            "source_after": {"commit_sha": self.sha, "dirty_tracked": False},
            "tests": [
                {
                    "id": "native_case",
                    "tier": "native_database",
                    "status": "PASS",
                    "exit_code": 0,
                    "command": ["synthetic-gate-unit"],
                    "log": "test.log",
                    "log_sha256": hashlib.sha256(
                        (self.base / "test.log").read_bytes()
                    ).hexdigest(),
                }
            ],
            "artifacts": [
                {"path": "artifact.json", "sha256": hashlib.sha256(b"{}").hexdigest()}
            ],
            "codex_start_authorized": False,
            "phase_completion_authorized": False,
        }

    def tearDown(self):
        gate.ROOT = self.old_root
        self.temp.cleanup()

    def result(self, phase="PREPARATION", sha=None):
        return gate.evaluate(self.report, self.plan, self.base, phase, sha or self.sha)

    def test_complete_evidence_only_recommends_review(self):
        r = self.result()
        self.assertEqual(r["status"], "READY_FOR_HUMAN_EVIDENCE_REVIEW")
        self.assertFalse(r["phase_complete"])
        self.assertFalse(r["codex_start_authorized"])

    def test_stale_sha_blocks(self):
        self.assertEqual(self.result(sha="b" * 40)["status"], "BLOCKED")

    def test_missing_required_test_blocks(self):
        self.report["tests"] = []
        self.assertEqual(self.result()["status"], "BLOCKED")

    def test_failed_or_skipped_test_cannot_complete(self):
        for state in ["FAIL", "BLOCKED", "SKIP"]:
            self.report["tests"][0]["status"] = state
            self.assertEqual(self.result()["status"], "BLOCKED")

    def test_fake_pass_without_command_blocks(self):
        self.report["tests"][0]["command"] = None
        self.assertEqual(self.result()["status"], "BLOCKED")

    def test_reference_is_not_native_evidence(self):
        self.report["tests"][0]["tier"] = "reference"
        self.assertEqual(self.result()["status"], "BLOCKED")

    def test_missing_log_blocks(self):
        self.report["tests"][0]["log"] = None
        self.assertEqual(self.result()["status"], "BLOCKED")

    def test_zero_executed_count_blocks(self):
        self.plan["tests"][0]["min_executed_tests"] = 1
        self.report["tests"][0]["executed_test_count"] = 0
        self.assertEqual(self.result()["status"], "BLOCKED")

    def test_tampered_log_blocks(self):
        (self.base / "test.log").write_text("tampered")
        self.assertEqual(self.result()["status"], "BLOCKED")

    def test_outside_log_blocks(self):
        self.report["tests"][0]["log"] = "../outside.log"
        self.assertEqual(self.result()["status"], "BLOCKED")

    def test_changed_source_blocks(self):
        self.report["source_after"]["dirty_tracked"] = True
        self.assertEqual(self.result()["status"], "BLOCKED")

    def test_unknown_phase_blocks(self):
        self.assertEqual(self.result(phase="MISSING")["status"], "BLOCKED")

    def test_manifest_cannot_authorize_execution(self):
        self.report["codex_start_authorized"] = True
        self.assertEqual(self.result()["status"], "BLOCKED")

    def test_changed_plan_blocks(self):
        self.report["plan_sha256"] = "0" * 64
        self.assertEqual(self.result()["status"], "BLOCKED")


if __name__ == "__main__":
    unittest.main()
