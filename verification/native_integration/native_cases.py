"""Real native documents, WMS service calls, HTTP and RQ; synthetic data only."""

import hashlib
import http.client
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
import traceback

from browser_config import browser_input, run_browser


def run(config):
    import frappe
    import jwt

    site = "wms-native-a.invalid"
    out = Path(config["evidence"])
    rows = []
    process = None
    key = secrets.token_urlsafe(40)
    actor = "operator@example.invalid"
    tokens = []
    ctx = {}

    def save():
        text = json.dumps(
            {
                "cases": rows,
                "site": site,
                "full_rendered_UI_proven": any(
                    x["id"].startswith("B01_") and x["status"] == "PASS" for x in rows
                ),
                "os_isolation_proven": False,
                "fresh_site": True,
            },
            indent=2,
            default=str,
        )
        for token in tokens:
            text = text.replace(token, "[REDACTED]")
        (out / "native-tests.json").write_text(text + "\n")

    def case(name, fn):
        try:
            detail = fn()
            row = {"id": name, "status": "PASS", "evidence": detail}
        except Exception:
            row = {"id": name, "status": "FAIL", "error": traceback.format_exc()}
        rows.append(row)
        save()
        print(name, row["status"], flush=True)

    def owner():
        frappe.destroy()
        frappe.init(site)
        frappe.connect()
        frappe.set_user("Administrator")

    def token(**override):
        now = int(time.time())
        claims = dict(
            sub=actor,
            company_id="TEST-A",
            source="lab-manual",
            jti=secrets.token_hex(12),
            iat=now,
            nbf=now - 1,
            exp=now + 600,
            iss="surooh-synthetic-issuer",
            aud="surooh-native-lab",
        )
        claims.update(override)
        result = jwt.encode(claims, key, algorithm="HS256")
        tokens.append(result)
        return result

    def request(method, path, body=None, tok=None, native_auth=None, site_name=site):
        c = http.client.HTTPConnection("127.0.0.1", 18080, timeout=60)
        headers = {"Content-Type": "application/json", "X-Frappe-Site-Name": site_name}
        if tok:
            headers["X-Surooh-Synthetic-JWT"] = tok
        if native_auth:
            headers["Authorization"] = "token " + native_auth
        c.request(method, path, json.dumps(body) if body is not None else None, headers)
        r = c.getresponse()
        data = r.read()
        c.close()
        try:
            data = json.loads(data)
        except ValueError:
            data = {"non_json_status": r.status}
        return r.status, data

    def call(op, payload, request_id, tok=None, **override):
        env = dict(
            company="TEST-A",
            source="lab-manual",
            request_id=request_id,
            operation=op,
            payload=payload,
        )
        env.update(override)
        status, data = request(
            "POST",
            "/api/method/surooh_accounting.native_lab.api.command",
            {"envelope": env},
            tok or token(),
        )
        if status != 200:
            raise AssertionError((status, data))
        return data["message"]

    def wms(op, **values):
        data = dict(operation=op, token=token(), **values)
        p = subprocess.run(
            [
                os.environ["SUROOH_BUN"],
                str(
                    Path(os.environ["SUROOH_WMS_ROOT"])
                    / "verification/native_integration/wms-probe.ts"
                ),
            ],
            input=json.dumps(data),
            text=True,
            capture_output=True,
            timeout=90,
            cwd=os.environ["SUROOH_WMS_ROOT"],
        )
        if p.returncode:
            raise AssertionError((p.returncode, p.stderr, p.stdout))
        return json.loads(p.stdout.strip().splitlines()[-1])

    def bins():
        owner()
        return {
            x.item_code: (
                float(x.actual_qty),
                float(x.reserved_stock),
                float(x.stock_value),
            )
            for x in frappe.get_all(
                "Bin",
                filters={"warehouse": ctx["warehouse"]},
                fields=["item_code", "actual_qty", "reserved_stock", "stock_value"],
            )
        }

    def command_doctypes():
        for name, fields in [
            (
                "Surooh Native Command",
                [
                    ("company", "Data"),
                    ("source", "Data"),
                    ("request_id", "Data"),
                    ("payload_hash", "Data"),
                    ("actor", "Data"),
                    ("result", "Long Text"),
                ],
            ),
            ("Surooh Lab Revocation", []),
        ]:
            frappe.get_doc(
                dict(
                    doctype="DocType",
                    name=name,
                    module="Surooh Accounting",
                    custom=1,
                    autoname="hash",
                    fields=[dict(fieldname=f, fieldtype=t, label=f) for f, t in fields],
                    permissions=[
                        dict(role="System Manager", read=1, write=1, create=1, delete=1)
                    ],
                )
            ).insert()

    def setup():
        owner()
        frappe.flags.mute_emails = True
        from erpnext.setup.setup_wizard.operations.install_fixtures import (
            get_preset_records,
            add_uom_data,
        )
        from frappe.desk.page.setup_wizard.setup_wizard import make_records

        presets = []
        for record in get_preset_records("Netherlands"):
            meta = frappe.get_meta(record["doctype"])
            autoname = meta.autoname or ""
            name = record.get("name") or (
                record.get(autoname[6:]) if autoname.startswith("field:") else None
            )
            if name and frappe.db.exists(record["doctype"], name):
                continue
            presets.append(record)
        make_records(presets)
        add_uom_data()
        frappe.get_doc(
            dict(
                doctype="Fiscal Year",
                year="TEST-2026",
                year_start_date="2026-01-01",
                year_end_date="2026-12-31",
            )
        ).insert()
        co = frappe.get_doc(
            dict(
                doctype="Company",
                company_name="TEST-A",
                abbr="TA",
                country="Netherlands",
                default_currency="EUR",
                create_chart_of_accounts_based_on="Standard Template",
                chart_of_accounts="Standard",
                enable_perpetual_inventory=1,
            )
        ).insert()
        wh = frappe.db.get_value(
            "Warehouse", {"company": "TEST-A", "is_group": 0}, "name"
        )
        ctx["warehouse"] = wh
        frappe.defaults.set_global_default("company", "TEST-A")
        frappe.defaults.set_global_default("currency", "EUR")
        frappe.db.set_single_value("System Settings", "setup_complete", 1)
        frappe.db.set_single_value("Stock Settings", "enable_stock_reservation", 1)
        frappe.db.set_single_value("Stock Settings", "auto_reserve_stock", 0)
        frappe.db.set_single_value("Stock Settings", "allow_partial_reservation", 0)
        frappe.get_doc(
            dict(
                doctype="Customer Group",
                customer_group_name="TEST-CUSTOMERS",
                parent_customer_group="All Customer Groups",
                is_group=0,
            )
        ).insert()
        frappe.get_doc(
            dict(
                doctype="Item Group",
                item_group_name="TEST-ITEMS",
                parent_item_group="All Item Groups",
                is_group=0,
            )
        ).insert()
        frappe.get_doc(
            dict(
                doctype="Customer",
                customer_name="TEST-CUSTOMER",
                customer_type="Company",
                customer_group="TEST-CUSTOMERS",
                territory="All Territories",
            )
        ).insert()
        frappe.get_doc(
            dict(
                doctype="Price List",
                price_list_name="TEST-EUR",
                selling=1,
                currency="EUR",
                enabled=1,
            )
        ).insert()
        for code, stock in [("TEST-C1", 1), ("TEST-C2", 1), ("TEST-KIT", 0)]:
            frappe.get_doc(
                dict(
                    doctype="Item",
                    item_code=code,
                    item_name=code,
                    item_group="TEST-ITEMS",
                    stock_uom="Nos",
                    is_stock_item=stock,
                    barcodes=([{"barcode": "SYNTHETIC-C1"}, {"barcode": "TEST-C2"}] if code == "TEST-C1" else [{"barcode": "SYNTHETIC-C2"}] if code == "TEST-C2" else []),
                )
            ).insert()
        frappe.get_doc(
            dict(
                doctype="Product Bundle",
                new_item_code="TEST-KIT",
                items=[
                    dict(item_code="TEST-C1", qty=1),
                    dict(item_code="TEST-C2", qty=2),
                ],
            )
        ).insert()
        frappe.get_doc(
            dict(doctype="Role", role_name="Surooh Lab Operator", desk_access=0)
        ).insert()
        frappe.get_doc(
            dict(
                doctype="User",
                email=actor,
                first_name="TEST-OPERATOR",
                user_type="System User",
                send_welcome_email=0,
                roles=[{"role": "Surooh Lab Operator"}],
            )
        ).insert()
        manager = frappe.get_doc(
            dict(
                doctype="User",
                email="native-manager@example.invalid",
                first_name="TEST-MANAGER",
                send_welcome_email=0,
                roles=[{"role": "Stock Manager"}],
            )
        ).insert()
        api_key = secrets.token_hex(8)
        api_secret = secrets.token_urlsafe(24)
        manager.api_key = api_key
        manager.api_secret = api_secret
        manager.save()
        ctx["native_auth"] = api_key + ":" + api_secret
        tokens.extend([api_key, api_secret, ctx["native_auth"]])
        folder = Path(site) / "private/files"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "native-canary.txt").write_text("SYNTHETIC_PRIVATE_CANARY")
        command_doctypes()
        cfg = Path(site) / "site_config.json"
        data = json.loads(cfg.read_text())
        data.update(
            surooh_native_lab=True,
            surooh_lab_jwt_key=key,
            surooh_lab_company="TEST-A",
            surooh_lab_warehouse=wh,
            maintenance_mode=0,
        )
        cfg.write_text(json.dumps(data))
        cfg.chmod(0o600)
        common = Path("common_site_config.json")
        data = json.loads(common.read_text())
        data["maintenance_mode"] = 0
        common.write_text(json.dumps(data))
        frappe.db.commit()
        frappe.destroy()
        return {
            "native_items": 3,
            "Product_Bundle": "TEST-KIT",
            "company": "TEST-A",
            "warehouse": wh,
            "independent_site_DB": True,
            "perpetual_inventory": bool(co.enable_perpetual_inventory),
        }

    key_b = secrets.token_urlsafe(40)

    def setup_b():
        frappe.destroy()
        frappe.init("wms-native-b.invalid")
        frappe.connect()
        frappe.set_user("Administrator")
        frappe.flags.mute_emails = True
        from erpnext.setup.setup_wizard.operations.install_fixtures import (
            get_preset_records,
            add_uom_data,
        )
        from frappe.desk.page.setup_wizard.setup_wizard import make_records

        presets = []
        for record in get_preset_records("Netherlands"):
            meta = frappe.get_meta(record["doctype"])
            autoname = meta.autoname or ""
            name = record.get("name") or (
                record.get(autoname[6:]) if autoname.startswith("field:") else None
            )
            if name and frappe.db.exists(record["doctype"], name):
                continue
            presets.append(record)
        make_records(presets)
        add_uom_data()
        co = frappe.get_doc(
            dict(
                doctype="Company",
                company_name="TEST-B",
                abbr="TB",
                country="Netherlands",
                default_currency="EUR",
                create_chart_of_accounts_based_on="Standard Template",
                chart_of_accounts="Standard",
                enable_perpetual_inventory=1,
            )
        ).insert()
        wh = frappe.db.get_value(
            "Warehouse", {"company": "TEST-B", "is_group": 0}, "name"
        )
        frappe.get_doc(
            dict(doctype="Role", role_name="Surooh Lab Operator", desk_access=0)
        ).insert()
        frappe.get_doc(
            dict(
                doctype="User",
                email="operator-b@example.invalid",
                first_name="TEST-B-OPERATOR",
                send_welcome_email=0,
                roles=[{"role": "Surooh Lab Operator"}],
            )
        ).insert()
        command_doctypes()
        from frappe.utils.password import get_encryption_key

        get_encryption_key()
        cfg = Path("wms-native-b.invalid/site_config.json")
        data = json.loads(cfg.read_text())
        data.update(
            surooh_native_lab=True,
            surooh_lab_jwt_key=key_b,
            surooh_lab_company=co.name,
            surooh_lab_warehouse=wh,
            maintenance_mode=0,
        )
        cfg.write_text(json.dumps(data))
        cfg.chmod(0o600)
        frappe.db.commit()
        frappe.destroy()
        return {"site": "wms-native-b.invalid", "independent_company": "TEST-B"}

    case("N01_native_company_items_bundle_and_app_setup", setup)
    if rows[-1]["status"] != "PASS":
        raise RuntimeError("Native setup failed")
    case("N01b_second_native_site_company_and_credentials", setup_b)
    if rows[-1]["status"] != "PASS":
        raise RuntimeError("Second native setup failed")
    try:
        log = (out / "frappe-http.log").open("w")
        process = subprocess.Popen(
            [sys.executable, str(Path(__file__).with_name("serve.py"))],
            stdout=log,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
        )
        for _ in range(100):
            try:
                with socket.create_connection(("127.0.0.1", 18080), timeout=0.2):
                    break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError("Frappe WSGI startup failed")

        def receive():
            result = call(
                "receive",
                {
                    "items": [
                        {"item": "TEST-C1", "qty": 10, "rate": 10},
                        {"item": "TEST-C2", "qty": 10, "rate": 20},
                    ]
                },
                "RECEIVE-1",
            )
            b = bins()
            assert b["TEST-C1"] == (10, 0, 100) and b["TEST-C2"] == (10, 0, 200), b
            ctx["receipt"] = result
            return {"native_voucher": result, "bins": b}

        case("N02_HTTP_native_receipt_quantity_and_valuation", receive)

        def order():
            result = wms("order", request="ORDER-1")
            ctx["order"] = result["order_id"]
            b = bins()
            assert b["TEST-C1"] == (10, 1, 100) and b["TEST-C2"] == (10, 2, 200), b
            return {"WMS_placeOrder_to_real_Frappe": result, "bins": b}

        case("N03_existing_WMS_order_service_bundle_reservations_and_replay", order)

        def conflict():
            owner()
            before = frappe.db.count("Sales Order")
            beforebins = bins()
            status, data = request(
                "POST",
                "/api/method/surooh_accounting.native_lab.api.command",
                {
                    "envelope": dict(
                        company="TEST-A",
                        source="lab-manual",
                        request_id="ORDER-1",
                        operation="order",
                        payload={"lines": [{"product_id": "TEST-KIT", "quantity": 2}]},
                    )
                },
                token(),
            )
            assert status != 200 and "Idempotency payload conflict" in json.dumps(
                data
            ), (status, data)
            owner()
            assert frappe.db.count("Sales Order") == before and bins() == beforebins
            return {"HTTP_status": status, "stock_unchanged": True}

        case("N04_native_durable_payload_conflict", conflict)

        def pick():
            result = call("pick", {"order_id": ctx["order"]}, "PICK-1")
            replay = call("pick", {"order_id": ctx["order"]}, "PICK-1")
            assert replay == result
            state = bins()
            assert state["TEST-C1"][1] == 1 and state["TEST-C2"][1] == 2, state
            packed = call("pack", {"order_id": ctx["order"]}, "PACK-1")
            assert bins() == state
            rows.append(
                {
                    "id": "N05_full_pick_pack_handoff",
                    "status": "PASS",
                    "evidence": {
                        "pick": result,
                        "pack": packed,
                        "one_reservation_per_component": True,
                        "physical_and_value_unchanged": True,
                    },
                }
            )
            save()
            return {"native_atomic_handoff": True, "replay": replay}

        case("N05a_native_pick_handoff_guard", pick)

        def ship():
            result = wms("ship", order_id=ctx["order"])
            owner()
            dn = frappe.db.get_value(
                "Delivery Note Item", {"against_sales_order": ctx["order"]}, "parent"
            )
            ctx["delivery"] = dn
            entries = frappe.get_all(
                "GL Entry",
                filters={"voucher_no": dn, "is_cancelled": 0},
                fields=["account", "debit", "credit"],
            )
            b = bins()
            assert (
                b["TEST-C1"][0] == 9
                and b["TEST-C2"][0] == 8
                and sum(v[2] for v in b.values()) == 250
            ), b
            assert (
                entries and round(sum(x.debit - x.credit for x in entries), 2) == 0
            ), entries
            assert round(sum(x.debit for x in entries), 2) == 50, entries
            return {
                "WMS_fulfillOrder": result,
                "Delivery_Note": dn,
                "GL": entries,
                "bins": b,
            }

        case("N06_WMS_ship_native_DeliveryNote_COGS_GL", ship)

        def returned():
            result = call("return", {"delivery_note": ctx["delivery"]}, "RETURN-1")
            replay = call("return", {"delivery_note": ctx["delivery"]}, "RETURN-1")
            assert result == replay
            b = bins()
            assert (
                b["TEST-C1"][0] == 10
                and b["TEST-C2"][0] == 10
                and sum(v[2] for v in b.values()) == 300
            ), b
            owner()
            entries = frappe.get_all(
                "GL Entry",
                filters={"voucher_no": result["return_note"], "is_cancelled": 0},
                fields=["account", "debit", "credit"],
            )
            assert entries and round(sum(x.debit - x.credit for x in entries), 2) == 0
            assert round(sum(x.debit for x in entries), 2) == 50, entries
            return {"native_return_and_replay": result, "GL": entries, "bins": b}

        case("N07_native_return_replay_value_and_GL_reversal", returned)

        def cancellation():
            order = wms("order", request="ORDER-CANCEL")["order_id"]
            result = wms("cancel", order_id=order)
            again = wms("cancel", order_id=order)
            assert result == again
            b = bins()
            assert b["TEST-C1"][1] == 0 and b["TEST-C2"][1] == 0, b
            return {"WMS_cancelOrder": result, "bins": b}

        case("N08_WMS_cancel_and_duplicate_event", cancellation)

        def identity():
            rejected = []
            for tok, company in [
                (token(exp=int(time.time()) - 10), "TEST-A"),
                (token(company_id="TEST-B"), "TEST-B"),
                (token(sub="outsider@example.invalid"), "TEST-A"),
                (token() + "bad", "TEST-A"),
            ]:
                status, data = request(
                    "POST",
                    "/api/method/surooh_accounting.native_lab.api.command",
                    {
                        "envelope": dict(
                            company=company,
                            source="lab-manual",
                            request_id="DENIED",
                            operation="balances",
                            payload={},
                        )
                    },
                    tok,
                )
                assert status != 200, (status, data)
                rejected.append(status)
            return {"expired_foreign_outsider_forged_statuses": rejected}

        case("N09_native_HTTP_verified_identity_company_and_role", identity)

        def revoke():
            tok = token(jti="revoked-native")
            owner()
            frappe.get_doc(
                dict(
                    doctype="Surooh Lab Revocation",
                    name=hashlib.sha256(b"revoked-native").hexdigest(),
                )
            ).insert(set_name=hashlib.sha256(b"revoked-native").hexdigest())
            frappe.db.commit()
            status, _ = request(
                "POST",
                "/api/method/surooh_accounting.native_lab.api.command",
                {
                    "envelope": dict(
                        company="TEST-A",
                        source="lab-manual",
                        request_id="RECEIVE-1",
                        operation="receive",
                        payload={"items": []},
                    )
                },
                tok,
            )
            assert status != 200
            return {"revoked_JWT_replay_status": status}

        case("N10_durable_token_revocation_before_replay", revoke)

        def native_bypass():
            checks = []
            for method, path, body in [
                ("GET", "/api/resource/Stock%20Entry", None),
                (
                    "POST",
                    "/api/method/surooh_accounting.native_lab.api._native",
                    {"operation": "receive", "payload": {}, "company": "TEST-A"},
                ),
                (
                    "POST",
                    "/api/method/frappe.client.insert",
                    {"doc": {"doctype": "Stock Entry"}},
                ),
            ]:
                status, _ = request(method, path, body, token())
                assert status != 200
                checks.append({"path": path, "status": status})
            body = {
                "doc": {
                    "doctype": "Stock Entry",
                    "company": "TEST-A",
                    "stock_entry_type": "Material Receipt",
                    "items": [
                        {
                            "item_code": "TEST-C1",
                            "qty": 1,
                            "t_warehouse": ctx["warehouse"],
                            "basic_rate": 10,
                        }
                    ],
                }
            }
            status, data = request(
                "POST",
                "/api/method/frappe.client.insert",
                body,
                native_auth=ctx["native_auth"],
            )
            assert status != 200 and "trusted command boundary" in json.dumps(data), (
                status,
                data,
            )
            checks.append(
                {
                    "native_Stock_Manager_API_credentials": "denied_by_guard",
                    "status": status,
                }
            )
            for doctype in ["Pick List", "Packing Slip"]:
                status, data = request(
                    "POST",
                    "/api/method/frappe.client.insert",
                    {"doc": {"doctype": doctype}},
                    native_auth=ctx["native_auth"],
                )
                assert status != 200 and "trusted command boundary" in json.dumps(
                    data
                ), (doctype, status, data)
                checks.append({"doctype": doctype, "raw_native_API_denied": status})
            return {
                "real_native_HTTP_bypass_denials": checks,
                "WMS_legacy_fallback": wms("legacy-denial"),
            }

        case("N11_raw_RPC_API_and_legacy_writer_denial", native_bypass)

        def role_revoke():
            owner()
            frappe.db.delete(
                "Has Role", {"parent": actor, "role": "Surooh Lab Operator"}
            )
            frappe.db.commit()
            try:
                status, _ = request(
                    "POST",
                    "/api/method/surooh_accounting.native_lab.api.command",
                    {
                        "envelope": dict(
                            company="TEST-A",
                            source="lab-manual",
                            request_id="RECEIVE-1",
                            operation="receive",
                            payload={"items": []},
                        )
                    },
                    token(role="Administrator"),
                )
                assert status != 200
            finally:
                owner()
                user = frappe.get_doc("User", actor)
                user.append("roles", {"role": "Surooh Lab Operator"})
                user.save()
                frappe.db.commit()
            return {
                "revoked_role_replay_status": status,
                "token_role_escalation_denied": True,
            }

        case("N12_fresh_DB_role_revocation_and_claim_escalation", role_revoke)

        def concurrent_native():
            from concurrent.futures import ThreadPoolExecutor
            import threading

            barrier = threading.Barrier(2)

            def submit():
                barrier.wait(timeout=10)
                return call(
                    "order",
                    {"lines": [{"product_id": "TEST-KIT", "quantity": 1}]},
                    "CONCURRENT-NATIVE",
                )

            with ThreadPoolExecutor(max_workers=2) as pool:
                futures = [pool.submit(submit) for _ in range(2)]
                results = [f.result(timeout=90) for f in futures]
            assert results[0] == results[1]
            state = bins()
            assert state["TEST-C1"][1] == 1 and state["TEST-C2"][1] == 2, state
            call("cancel", {"order_id": results[0]["order_id"]}, "CANCEL-CONCURRENT")
            return {
                "two_real_HTTP_clients": True,
                "same_native_result": results[0],
                "one_reservation_effect_per_component": True,
            }

        case("N13_native_HTTP_concurrent_command_replay", concurrent_native)

        def worker():
            from frappe.utils.background_jobs import enqueue

            owner()
            before = bins()

            def burst():
                code = "import frappe;frappe.init('wms-native-a.invalid');from frappe.utils.background_jobs import start_worker;start_worker(queue='short',burst=True,quiet=True)"
                result = subprocess.run(
                    [sys.executable, "-c", code],
                    capture_output=True,
                    text=True,
                    env=os.environ.copy(),
                    timeout=90,
                )
                data = result.stdout + result.stderr
                for tok in tokens:
                    data = data.replace(tok, "[REDACTED]")
                with (out / "native-worker.log").open("a") as f:
                    f.write(data)
                assert result.returncode == 0, (result.returncode, data)

            env = dict(
                company="TEST-A",
                source="lab-manual",
                request_id="WORKER-OK",
                operation="balances",
                payload={},
            )
            good = enqueue(
                "surooh_accounting.native_lab.api.run_job",
                queue="short",
                envelope=env,
                token=token(),
                job_id="native-allowed",
            )
            frappe.db.commit()
            burst()
            good.refresh()
            assert good.get_status().value == "finished", good.get_status()
            owner()
            tok = token(jti="worker-revoked")
            env = dict(
                company="TEST-A",
                source="lab-manual",
                request_id="WORKER-DENIED",
                operation="receive",
                payload={"items": [{"item": "TEST-C1", "qty": 1, "rate": 10}]},
            )
            bad = enqueue(
                "surooh_accounting.native_lab.api.run_job",
                queue="short",
                envelope=env,
                token=tok,
                job_id="native-revoked",
            )
            name = hashlib.sha256(b"worker-revoked").hexdigest()
            frappe.get_doc(dict(doctype="Surooh Lab Revocation")).insert(set_name=name)
            frappe.db.commit()
            burst()
            bad.refresh()
            assert bad.get_status().value == "failed", bad.get_status()
            assert bins() == before
            return {
                "real_RQ_allowed_job": "finished",
                "revoked_before_execution_job": "failed_as_required",
                "no_stock_effect": True,
            }

        case("N14_real_RQ_job_and_execution_time_revocation", worker)

        def inflight_revoke():
            import pymysql
            from concurrent.futures import ThreadPoolExecutor

            owner()
            before = bins()
            frappe.db.sql("SELECT name FROM `tabUser` WHERE name=%s FOR UPDATE", actor)
            observer = pymysql.connect(
                host="127.0.0.1",
                port=14306,
                user="root",
                password=config["password"],
                autocommit=True,
            )
            envelope = dict(
                company="TEST-A",
                source="lab-manual",
                request_id="INFLIGHT-DENIED",
                operation="receive",
                payload={"items": [{"item": "TEST-C1", "qty": 1, "rate": 10}]},
            )
            try:
                with ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(
                        request,
                        "POST",
                        "/api/method/surooh_accounting.native_lab.api.command",
                        {"envelope": envelope},
                        token(),
                    )
                    observed = False
                    for _ in range(50):
                        with observer.cursor() as cursor:
                            cursor.execute(
                                "SELECT count(*) FROM information_schema.INNODB_LOCK_WAITS"
                            )
                            if cursor.fetchone()[0] > 0:
                                observed = True
                                break
                        time.sleep(0.1)
                    # Release even on an unexpected observation failure so HTTP can finish.
                    frappe.db.delete(
                        "Has Role", {"parent": actor, "role": "Surooh Lab Operator"}
                    )
                    frappe.db.commit()
                    status, _ = future.result(timeout=60)
                    assert observed and status != 200, (observed, status)
            finally:
                observer.close()
                frappe.db.rollback()
                owner()
                user = frappe.get_doc("User", actor)
                user.append("roles", {"role": "Surooh Lab Operator"})
                user.save()
                frappe.db.commit()
            assert bins() == before
            return {
                "independent_MariaDB_lock_wait_observed": True,
                "role_revoked_while_HTTP_in_flight": True,
                "HTTP_status": status,
                "no_stock_effect": True,
                "policy": "Permission locks linearize execution; revocation before acquisition denies, after acquisition waits for accepted command commit",
            }

        case(
            "N15_inflight_HTTP_permission_revocation_current_locking_reads",
            inflight_revoke,
        )

        def file_boundary():
            status, body = request(
                "GET", "/private/files/native-canary.txt", tok=token()
            )
            assert status in [
                302,
                403,
                404,
            ] and "SYNTHETIC_PRIVATE_CANARY" not in json.dumps(body), (status, body)
            return {
                "private_file_HTTP_status": status,
                "canary_not_exposed": True,
                "OS_file_identity_isolation": "BLOCKED",
            }

        case("N16_HTTP_private_file_boundary", file_boundary)

        def lost_and_restart():
            nonlocal process, log
            envelope = dict(
                company="TEST-A",
                source="lab-manual",
                request_id="LOST-NATIVE",
                operation="order",
                payload={"lines": [{"product_id": "TEST-KIT", "quantity": 1}]},
            )
            body = json.dumps({"envelope": envelope}).encode()
            tok = token()
            raw = (
                "POST /api/method/surooh_accounting.native_lab.api.command HTTP/1.1\r\nHost:127.0.0.1\r\nX-Frappe-Site-Name:"
                + site
                + "\r\nX-Surooh-Synthetic-JWT:"
                + tok
                + "\r\nContent-Type:application/json\r\nContent-Length:"
                + str(len(body))
                + "\r\nConnection:close\r\n\r\n"
            ).encode() + body
            with socket.create_connection(
                ("127.0.0.1", 18080), timeout=5
            ) as connection:
                connection.sendall(raw)
            name = hashlib.sha256(
                json.dumps(
                    ["TEST-A", "lab-manual", "LOST-NATIVE"], separators=(",", ":")
                ).encode()
            ).hexdigest()
            result = None
            for _ in range(100):
                owner()
                value = frappe.db.get_value("Surooh Native Command", name, "result")
                if value:
                    result = json.loads(value)
                    break
                time.sleep(0.1)
            assert result is not None, "Lost-response command did not commit"
            before = bins()
            oldpid = process.pid
            process.kill()
            process.wait(timeout=15)
            log.close()
            log = (out / "frappe-http.log").open("a")
            process = subprocess.Popen(
                [sys.executable, str(Path(__file__).with_name("serve.py"))],
                stdout=log,
                stderr=subprocess.STDOUT,
                env=os.environ.copy(),
            )
            for _ in range(100):
                try:
                    with socket.create_connection(("127.0.0.1", 18080), timeout=0.2):
                        break
                except OSError:
                    time.sleep(0.1)
            replay = wms("order", request="LOST-NATIVE")
            assert replay["order_id"] == result["order_id"] and bins() == before
            call("cancel", {"order_id": result["order_id"]}, "CANCEL-LOST-NATIVE")
            return {
                "lost_HTTP_response_after_commit": True,
                "old_HTTP_pid": oldpid,
                "new_HTTP_pid": process.pid,
                "same_durable_order_id": result["order_id"],
                "no_second_reservation": True,
            }

        case(
            "N17_native_lost_response_process_kill_restart_and_replay", lost_and_restart
        )

        def two_sites():
            import pymysql

            denied = []
            for own, foreign in [("a", "b"), ("b", "a")]:
                data = json.loads(
                    Path(f"wms-native-{own}.invalid/site_config.json").read_text()
                )
                conn = pymysql.connect(
                    host="127.0.0.1",
                    port=14306,
                    user=data.get("db_user", data["db_name"]),
                    password=data["db_password"],
                    database=data["db_name"],
                    autocommit=True,
                )
                for sql in [
                    f"SELECT name FROM surooh_fresh_wms_{foreign}.`tabCompany`",
                    f"DELETE FROM surooh_fresh_wms_{foreign}.`tabCompany` WHERE name='NEVER-EXISTS'",
                ]:
                    try:
                        with conn.cursor() as c:
                            c.execute(sql)
                        raise AssertionError("Cross-database access permitted")
                    except pymysql.err.OperationalError as error:
                        assert error.args[0] in [1044, 1142]
                        denied.append(error.args[0])
                conn.close()
            now = int(time.time())
            b_token = jwt.encode(
                dict(
                    sub="operator-b@example.invalid",
                    company_id="TEST-B",
                    source="lab-manual",
                    jti="B-READ",
                    iat=now,
                    nbf=now - 1,
                    exp=now + 600,
                    iss="surooh-synthetic-issuer",
                    aud="surooh-native-lab",
                ),
                key_b,
                algorithm="HS256",
            )
            tokens.append(b_token)
            envelope = dict(
                company="TEST-B",
                source="lab-manual",
                request_id="B-BALANCE",
                operation="balances",
                payload={},
            )
            own_status, _ = request(
                "POST",
                "/api/method/surooh_accounting.native_lab.api.command",
                {"envelope": envelope},
                b_token,
                site_name="wms-native-b.invalid",
            )
            foreign_status, _ = request(
                "POST",
                "/api/method/surooh_accounting.native_lab.api.command",
                {"envelope": envelope},
                token(),
                site_name="wms-native-b.invalid",
            )
            assert own_status == 200 and foreign_status != 200, (
                own_status,
                foreign_status,
            )
            a = json.loads(Path("wms-native-a.invalid/site_config.json").read_text())
            b = json.loads(Path("wms-native-b.invalid/site_config.json").read_text())
            assert (
                a["db_password"] != b["db_password"]
                and a["encryption_key"] != b["encryption_key"]
            )
            return {
                "real_restricted_SQL_cross_DB_read_write_errors": denied,
                "B_own_HTTP": own_status,
                "A_JWT_on_B_denied": foreign_status,
                "independent_DB_credentials_and_encryption_keys": True,
                "separate_site_paths": True,
                "separate_OS_service_storage_boundary": "BLOCKED",
            }

        case("N18_two_fresh_sites_DB_credentials_and_HTTP_identity", two_sites)
        from atomic_cases import run as atomic_run

        atomic_run(case, call, token, owner, bins, wms)
        from stock_cases import run as stock_run

        stock_run(case, call, token, owner, wms)
        from scanner_cases import run as scanner_run

        scanner_run(case, call, token, owner, bins, wms)
        from shipping_cases import run as shipping_run

        shipping_run(case, call, token, owner, bins, wms)
        browser_row = run_browser(browser_input(token()), out / "browser-cycle.log")
        rows.append(browser_row)
        save()
    finally:
        if process:
            process.terminate()
            process.wait(timeout=15)
            log.close()
            p = out / "frappe-http.log"
            data = p.read_text(errors="replace")
            for tok in tokens:
                data = data.replace(tok, "[REDACTED]")
            p.write_text(data)
        frappe.destroy()
        save()
    expected = {f"N{i:02d}" for i in range(1, 19)} | {"N01b", "N05a"}
    actual = {x["id"].split("_")[0] for x in rows}
    if (
        actual != expected | {f"A{i:02d}" for i in range(1, 10)} | {f"O{i:02d}" for i in range(1, 10)} | {f"S{i:02d}" for i in range(1, 4)} | {"B01"}
        or len(rows) != 42
    ):
        raise RuntimeError("Missing/duplicate native cases")
    if any(x["status"] == "FAIL" for x in rows):
        raise RuntimeError(
            "Native integration assertions failed; see native-tests.json"
        )
