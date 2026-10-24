"""Co-install the full invoice app and run its original HTTP checks on WMS sites.

Opt-in only, owned fresh sites only. Native/browser WMS cases execute with the
invoice hooks installed; original Accounting checks then use the very same DB.
This does not certify Marketplace or hosted/provider acceptance.
"""

import json
import os
from pathlib import Path
import secrets
import subprocess
import sys


def prepare(config):
    import frappe
    from frappe.installer import install_app
    from fixtures import seed

    sites = Path(config["sites"]).resolve()
    assert sites.parent.parent.name.startswith("surooh-new-native-")
    root = sites.parent.parent / "accounting-checks"
    root.mkdir(mode=0o700)
    (root / ".synthetic-only").touch()
    (root / "bench").symlink_to(sites.parent, target_is_directory=True)
    (root / "run").mkdir()
    (root / "logs").mkdir()
    run_id = "r" + secrets.token_hex(4)
    config["shared_root"] = str(root)
    config["shared_run_id"] = run_id
    for letter, company in [("a", "TEST-A"), ("b", "TEST-B")]:
        site = f"wms-native-{letter}.invalid"
        cfg = sites / site / "site_config.json"
        data = json.loads(cfg.read_text())
        assert data["db_name"].startswith("surooh_fresh_")
        assert data["surooh_lab_company"] == company
        data.update(surooh_shared_test_profile="wms-accounting-v1",
                    surooh_invoice_workbench=True, surooh_invoice_company=company,
                    surooh_invoice_test_writer="writer@example.invalid",
                    surooh_invoice_test_reviewer="reviewer@example.invalid")
        cfg.write_text(json.dumps(data))
        cfg.chmod(0o600)
        frappe.destroy()
        frappe.init(site)
        frappe.connect()
        frappe.set_user("Administrator")
        frappe.flags.mute_emails = True
        for dt, field, disabled in [("Notification", "enabled", 0),
                ("Webhook", "enabled", 0), ("Auto Email Report", "enabled", 0),
                ("Server Script", "disabled", 1), ("Workflow", "is_active", 0)]:
            for name in frappe.get_all(dt, filters={field: 1-disabled}, pluck="name"):
                frappe.db.set_value(dt, name, field, disabled)
        frappe.db.commit()
        install_app("surooh_invoice_workbench")
        credentials = {key: secrets.token_urlsafe(30) for key in ("writer", "reviewer")}
        seed(company, credentials)
        # The original templates currently assume TA; the shared B site remains
        # independently scoped, while full HTTP functional checks use TEST-A.
        if letter == "a":
            private = root / "run" / f"credentials-{run_id}.json"
            private.write_text(json.dumps(credentials))
            private.chmod(0o600)
        assert set(frappe.get_installed_apps()) == {
            "frappe", "erpnext", "surooh_accounting",
            "surooh_native_guard", "surooh_invoice_workbench",
        }
        frappe.clear_cache()
        frappe.db.commit()
        frappe.destroy()
    print("SHARED_WORKBENCH_INSTALLED_ON_BOTH_FRESH_WMS_SITES", flush=True)


def run(config):
    root = Path(config["shared_root"])
    run_id = config["shared_run_id"]
    scripts = Path(config["accounting_root"]) / "validation/invoice_workbench/local_testing"
    env = {**os.environ, "SUROOH_INVOICE_LAB_ROOT": str(root),
           "INVOICE_LAB_RUN_ID": run_id, "INVOICE_LAB_EVIDENCE_ID": run_id,
           "INVOICE_LAB_SITE": "wms-native-a.invalid"}
    results = []
    out = Path(config["evidence"])
    try:
        for name in ["http_checks.py", "receipt_checks.py", "purchase_checks.py",
                     "quote_checks.py", "bank_checks.py", "credit_checks.py",
                     "supplier_payment_checks.py", "reversal_checks.py",
                     "document_reversal_checks.py", "bank_reversal_checks.py",
                     "delivery_checks.py", "report_checks.py"]:
            p = subprocess.run([sys.executable, str(scripts / name)], env=env,
                               capture_output=True, text=True, timeout=360)
            # Original scripts log document IDs/assertions, never credentials.
            log = out / ("shared-" + name.removesuffix(".py") + ".log")
            log.write_text(p.stdout + p.stderr)
            results.append({"suite": name, "exit_code": p.returncode,
                            "status": "PASS" if p.returncode == 0 else "FAIL",
                            "log": log.name})
            print("SHARED", name, results[-1]["status"], flush=True)
        for p in (root / "logs").glob("*-results-*.json"):
            (out / ("shared-" + p.name)).write_bytes(p.read_bytes())
    finally:
        (out / "shared-accounting-results.json").write_text(json.dumps({
            "tier": "original_accounting_http_suites_on_coinstalled_WMS_database",
            "site": "wms-native-a.invalid", "suites": results,
            "marketplace_acceptance": "NOT_RUN", "hosted_acceptance": "NOT_RUN",
        }, indent=2) + "\n")
    if len(results) != 12 or any(x["exit_code"] for x in results):
        raise RuntimeError("Shared Accounting acceptance failed; see retained suite logs")
