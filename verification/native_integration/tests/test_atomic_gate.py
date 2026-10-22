"""Evidence validator regressions, not native-engine test evidence."""

import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

module = Path(__file__).resolve().parents[1] / "atomic_gate.py"
spec = importlib.util.spec_from_file_location("atomic_gate", module)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class EvidenceGate(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.w, self.a = "1" * 40, "2" * 40
        ids = (
            [f"N{x:02d}" for x in range(1, 19)]
            + ["N01b", "N05a"]
            + [f"A{x:02d}" for x in range(1, 10)]
        )
        self.rows = [{"id": i + "_unit_fixture", "status": "PASS"} for i in ids] + [
            {"id": "B01_unit_fixture", "status": "BLOCKED"}
        ]
        (self.root / "native.log").write_text("unit fixture, no engine executed\n")
        self.report = dict(
            source_sha=self.w,
            accounting_sha=self.a,
            dirty_tracked=False,
            accounting_dirty=False,
            fresh_database=True,
            fresh_two_sites_installed=True,
            seed_restore_used=False,
            upstream_patched=False,
            commands=[{"exit_code": 0}],
            log_hashes={
                "native.log": hashlib.sha256(
                    (self.root / "native.log").read_bytes()
                ).hexdigest()
            },
            source_after={
                "wms_sha": self.w,
                "accounting_sha": self.a,
                "wms_dirty": False,
                "accounting_dirty": False,
            },
        )
        self.write()

    def write(self):
        (self.root / "native-tests.json").write_text(json.dumps({"cases": self.rows}))
        self.report["artifact_hashes"] = {
            "native-tests.json": hashlib.sha256(
                (self.root / "native-tests.json").read_bytes()
            ).hexdigest()
        }
        (self.root / "bootstrap-results.json").write_text(json.dumps(self.report))

    def evaluate(self):
        return gate.evaluate(self.root, self.w, self.a)

    def test_native_success_never_grants_UI_or_phase_approval(self):
        result = self.evaluate()
        self.assertEqual(
            result["native_atomic_candidate"], "READY_FOR_HUMAN_EVIDENCE_REVIEW"
        )
        for key in ["rendered_UI_cycle", "PREPARATION", "P01"]:
            self.assertEqual(result[key], "BLOCKED")
        self.assertFalse(result["codex_start_authorized"])

    def test_stale_pair_rejected(self):
        self.report["accounting_sha"] = "3" * 40
        self.write()
        self.assertEqual(self.evaluate()["native_atomic_candidate"], "BLOCKED")

    def test_tampered_native_artifact_rejected(self):
        (self.root / "native-tests.json").write_text(json.dumps({"cases": []}))
        self.assertEqual(self.evaluate()["native_atomic_candidate"], "BLOCKED")

    def test_missing_case_rejected_even_with_fresh_hash(self):
        self.rows.pop(0)
        self.write()
        self.assertEqual(self.evaluate()["native_atomic_candidate"], "BLOCKED")

    def test_dirty_after_rejected(self):
        self.report["source_after"]["wms_dirty"] = True
        self.write()
        self.assertEqual(self.evaluate()["native_atomic_candidate"], "BLOCKED")
