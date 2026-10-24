"""Harness plumbing tests only. Child fixtures are NOT native/browser acceptance."""

import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from browser_config import add_arguments, browser_input, configure_environment, run_browser


class BrowserHarnessTests(unittest.TestCase):
    def test_cli_reaches_private_browser_input(self):
        parser = argparse.ArgumentParser()
        add_arguments(parser)
        args = parser.parse_args(["--browser-executable", "/tmp/browser path", "--playwright-module", "/tmp/module path"])
        env = {"SUROOH_BUN": "/tmp/bun", "SUROOH_WMS_ROOT": "/tmp/wms"}
        configure_environment(args, env)
        self.assertEqual(browser_input("synthetic-session", env), {
            "token": "synthetic-session", "bun": "/tmp/bun", "wmsRoot": "/tmp/wms",
            "executable": "/tmp/browser path", "playwright": "/tmp/module path",
        })

    def test_ambient_browser_settings_are_not_inherited(self):
        parser = argparse.ArgumentParser()
        add_arguments(parser)
        env = {"SUROOH_BROWSER_EXECUTABLE": "ambient", "SUROOH_PLAYWRIGHT_MODULE": "ambient", "SUROOH_BROWSER_NODE": "ambient"}
        configure_environment(parser.parse_args([]), env)
        self.assertEqual(env, {})

    def test_explicit_node_is_forwarded_without_changing_application_bun(self):
        parser = argparse.ArgumentParser()
        add_arguments(parser)
        env = {"SUROOH_BUN": "/tmp/bun", "SUROOH_WMS_ROOT": "/tmp/wms"}
        configure_environment(parser.parse_args(["--browser-node", sys.executable]), env)
        config = browser_input("synthetic-session", env)
        self.assertEqual(config["node"], str(Path(sys.executable).resolve()))
        self.assertEqual(config["bun"], "/tmp/bun")

    def test_explicit_browser_runtime_is_used_for_real_child_process(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            script = root / "verification/native_integration/browser-cycle.mjs"
            script.parent.mkdir(parents=True)
            script.write_text('import json\nprint(json.dumps({"id":"B01_rendered_existing_React_full_native_cycle","status":"PASS","phase_complete":False,"codex_start_authorized":False}))')
            row = run_browser({"node": sys.executable, "bun": str(root / "absent-bun"), "wmsRoot": str(root), "token": "fixture-secret"}, root / "log")
            self.assertEqual(row["status"], "PASS")
            self.assertEqual(row["exit_code"], 0)

    def fixture(self, source, timeout=5):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            script = root / "verification/native_integration/browser-cycle.mjs"
            script.parent.mkdir(parents=True)
            script.write_text(source)
            config = {"bun": sys.executable, "wmsRoot": str(root), "token": "fixture-secret"}
            output = root / "browser.log"
            row = run_browser(config, output, timeout=timeout)
            return row, output.read_text()

    def test_malformed_child_output_fails_and_redacts(self):
        row, log = self.fixture('print("fixture-secret invalid-json")')
        self.assertEqual(row["status"], "FAIL")
        self.assertNotIn("fixture-secret", log)
        self.assertIn("[REDACTED]", log)

    def test_inconsistent_pass_exit_fails(self):
        row, _ = self.fixture('import json\nprint(json.dumps({"id":"B01_rendered_existing_React_full_native_cycle","status":"PASS","phase_complete":False,"codex_start_authorized":False}))\nraise SystemExit(2)')
        self.assertEqual(row["status"], "FAIL")

    def test_blocked_child_is_never_pass(self):
        row, _ = self.fixture('import json\nprint(json.dumps({"id":"B01_rendered_existing_React_full_native_cycle","status":"BLOCKED","phase_complete":False,"codex_start_authorized":False}))\nraise SystemExit(2)')
        self.assertEqual(row["status"], "BLOCKED")
        self.assertEqual(row["exit_code"], 2)

    def test_timeout_preserved_as_failure(self):
        row, log = self.fixture('import time\nprint("fixture-secret", flush=True)\ntime.sleep(30)', timeout=0.2)
        self.assertEqual(row["status"], "FAIL")
        self.assertIsNone(row["exit_code"])
        self.assertNotIn("fixture-secret", log)

    def test_missing_runner_is_blocked(self):
        with tempfile.TemporaryDirectory() as root:
            row = run_browser({"bun": root + "/absent", "wmsRoot": root, "token": "fixture-secret"}, Path(root) / "log")
            self.assertEqual(row["status"], "BLOCKED")

    def test_real_js_harness_missing_browser_is_blocked(self):
        script = Path(__file__).with_name("browser-cycle.mjs")
        process = subprocess.run(["node", str(script)], input=json.dumps({"token": "fixture-secret"}), text=True, capture_output=True)
        row = json.loads(process.stdout)
        self.assertEqual(process.returncode, 2)
        self.assertEqual(row["status"], "BLOCKED")
        self.assertEqual(row["scenarios"], [])


if __name__ == "__main__":
    unittest.main()
