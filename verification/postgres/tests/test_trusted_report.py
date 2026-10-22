"""Checker regressions only; not native DB evidence."""

import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "check_trusted", Path(__file__).parents[1] / "check_trusted.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class TrustedReportTests(unittest.TestCase):
    def setUp(self):
        self.report = {
            "cases": [
                {"id": f"D{i:02d}_fixture", "status": "PASS"} for i in range(1, 22)
            ],
            "trusted_cases": [
                {"id": f"H{i:02d}_fixture", "status": "PASS"} for i in range(1, 19)
            ],
            "migrations": [{"status": "PASS"} for _ in range(23)],
            "source_dirty_tracked": False,
            "trusted_http_jwt_proven": True,
            "cleanup": {"server_stopped": True, "private_cluster_removed": True},
            "http_service_cleanup": {"stopped": True},
        }

    def test_complete_only_recommends_review(self):
        self.assertEqual(m.validate(self.report), 18)

    def test_missing_case(self):
        self.report["trusted_cases"].pop()
        with self.assertRaises(ValueError):
            m.validate(self.report)

    def test_duplicate_case(self):
        self.report["trusted_cases"][-1] = copy.deepcopy(
            self.report["trusted_cases"][0]
        )
        with self.assertRaises(ValueError):
            m.validate(self.report)

    def test_failed_case(self):
        self.report["cases"][0]["status"] = "FAIL"
        with self.assertRaises(ValueError):
            m.validate(self.report)

    def test_dirty_source(self):
        self.report["source_dirty_tracked"] = True
        with self.assertRaises(ValueError):
            m.validate(self.report)

    def test_cleanup_or_http_missing(self):
        for field in ["cleanup", "http_service_cleanup", "trusted_http_jwt_proven"]:
            report = copy.deepcopy(self.report)
            report.pop(field)
            with self.assertRaises(ValueError):
                m.validate(report)


if __name__ == "__main__":
    unittest.main()
