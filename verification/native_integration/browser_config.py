"""Explicit test-runner browser settings; never discover credentials or download tools."""

import os
import json
import subprocess
import signal
from pathlib import Path


def add_arguments(parser):
    parser.add_argument("--browser-executable", type=Path)
    parser.add_argument("--playwright-module", type=Path)


def configure_environment(args, env):
    # Only CLI values enter the sanitized child environment, not ambient overrides.
    for argument, key in [
        ("browser_executable", "SUROOH_BROWSER_EXECUTABLE"),
        ("playwright_module", "SUROOH_PLAYWRIGHT_MODULE"),
    ]:
        env.pop(key, None)
        value = getattr(args, argument)
        if value is not None:
            env[key] = str(value.resolve())


def browser_input(token, env=None):
    env = os.environ if env is None else env
    result = {"token": token, "bun": env["SUROOH_BUN"], "wmsRoot": env["SUROOH_WMS_ROOT"]}
    for key, target in [
        ("SUROOH_BROWSER_EXECUTABLE", "executable"),
        ("SUROOH_PLAYWRIGHT_MODULE", "playwright"),
    ]:
        if key in env:
            result[target] = env[key]
    return result


def run_browser(config, output, timeout=480):
    """Keep failed/timeout/malformed browser evidence visible and redact the session."""
    config = {**config, "artifactDir": str(output.parent.resolve())}
    row = {
        "id": "B01_rendered_existing_React_full_native_cycle",
        "status": "FAIL",
        "phase_complete": False,
        "codex_start_authorized": False,
    }
    process = None
    try:
        process = subprocess.Popen(
            [config["bun"], str(Path(config["wmsRoot"]) / "verification/native_integration/browser-cycle.mjs")],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, start_new_session=True,
        )
        stdout, stderr = process.communicate(json.dumps(config), timeout=timeout)
        log = stdout + stderr
        row["exit_code"] = process.returncode
        try:
            parsed = json.loads(stdout.strip().splitlines()[-1])
            expected = {"PASS": 0, "FAIL": 1, "BLOCKED": 2}
            if (parsed.get("id") != row["id"]
                or parsed.get("status") not in expected
                or expected[parsed["status"]] != process.returncode
                or parsed.get("phase_complete") is not False
                or parsed.get("codex_start_authorized") is not False):
                raise ValueError("Browser status/exit/gate mismatch")
            row.update(parsed)
            row["exit_code"] = process.returncode
        except (ValueError, IndexError, AttributeError, TypeError) as error:
            row["reason"] = "Invalid browser result: " + str(error)
    except subprocess.TimeoutExpired as error:
        def decoded(value):
            return value.decode(errors="replace") if isinstance(value, bytes) else value or ""
        log = decoded(error.stdout) + decoded(error.stderr)
        row.update(reason="Browser timed out; acceptance not established", exit_code=None)
    except OSError as error:
        log = str(error)
        row.update(status="BLOCKED", reason="Browser runner unavailable: " + str(error), exit_code=None)
    finally:
        if process is not None:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.communicate()
    token = config["token"]
    output.write_text(log.replace(token, "[REDACTED]") if token else log)
    serialized = json.dumps(row)
    return json.loads(serialized.replace(token, "[REDACTED]") if token else serialized)
