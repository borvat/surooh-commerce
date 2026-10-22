"""Real fresh-site races and transaction failure injection, never an alternate ledger."""

import json
import os
import signal
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor


def run(case, call, token, owner, bins, wms):
    import frappe

    owner()
    other = "second-operator@example.invalid"
    if not frappe.db.exists("User", other):
        user = frappe.get_doc(
            dict(
                doctype="User",
                email=other,
                first_name="Synthetic second",
                send_welcome_email=0,
                enabled=1,
            )
        )
        user.append("roles", {"role": "Surooh Lab Operator"})
        user.insert()
    frappe.db.commit()

    def create(label, quantity=1):
        return call(
            "order",
            {"lines": [{"product_id": "TEST-KIT", "quantity": quantity}]},
            f"{label}:order",
        )["order_id"]

    def action(op, order, key, second=False):
        return call(
            op, {"order_id": order}, key, tok=token(sub=other) if second else token()
        )

    def race(left, right):
        barrier = threading.Barrier(2)

        def invoke(fn):
            barrier.wait(timeout=10)
            try:
                return {"success": True, "result": fn()}
            except AssertionError as exc:
                return {"success": False, "denied": str(exc)}

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(invoke, fn) for fn in [left, right]]
            return [future.result(timeout=90) for future in futures]

    def reservations(order):
        owner()
        return frappe.db.sql(
            "SELECT item_code, reserved_qty, delivered_qty, from_voucher_type FROM `tabStock Reservation Entry` WHERE voucher_no=%s AND docstatus=1 ORDER BY item_code",
            order,
        )

    def replay():
        order = create("A01")
        before = bins()
        first = action("pick", order, "A01:pick")
        assert action("pick", order, "A01:pick") == first
        assert action("pick", order, "A01:new-key") == first
        assert bins() == before
        entries = reservations(order)
        assert len(entries) == 2 and all(row[3] == "Pick List" for row in entries), (
            entries
        )
        action("cancel", order, "A01:cancel")
        return {
            "native_pick": first,
            "native_SRE": entries,
            "same_bins_and_value": True,
        }

    case("A01_atomic_handoff_replay_and_native_links", replay)

    def duplicate():
        order = create("A02")
        before = bins()
        outcomes = race(
            lambda: action("pick", order, "A02:pick"),
            lambda: action("pick", order, "A02:pick", True),
        )
        assert all(x["success"] for x in outcomes), outcomes
        assert outcomes[0]["result"] == outcomes[1]["result"]
        assert bins() == before and len(reservations(order)) == 2
        action("cancel", order, "A02:cancel")
        return {
            "different_authorized_actors": True,
            "separate_HTTP_DB_sessions": True,
            "outcomes": outcomes,
        }

    case("A02_concurrent_pick_same_command", duplicate)

    def cancel_race():
        order = create("A03")
        outcomes = race(
            lambda: action("pick", order, "A03:pick"),
            lambda: action("cancel", order, "A03:cancel", True),
        )
        owner()
        assert frappe.db.get_value("Sales Order", order, "docstatus") == 2, outcomes
        assert not reservations(order)
        assert all(x[1] == 0 for x in bins().values())
        return {
            "outcomes": outcomes,
            "final_order_cancelled_no_active_reservation": True,
        }

    case("A03_pick_cancel_race", cancel_race)

    def ship_race():
        order = create("A04")
        action("pick", order, "A04:pick")
        action("pack", order, "A04:pack")
        outcomes = race(
            lambda: action("ship", order, "A04:ship"),
            lambda: action("cancel", order, "A04:cancel", True),
        )
        assert sum(x["success"] for x in outcomes) == 1, outcomes
        owner()
        shipped = frappe.db.get_value("Sales Order", order, "per_delivered") == 100
        if shipped:
            delivery = outcomes[0]["result"]["delivery_note"]
            assert action("ship", order, "A04:ship") == outcomes[0]["result"]
            call("return", {"delivery_note": delivery}, "A04:return")
        else:
            assert frappe.db.get_value("Sales Order", order, "docstatus") == 2
        assert all(x[1] == 0 for x in bins().values())
        return {
            "outcomes": outcomes,
            "exactly_one_terminal_action": True,
            "returned_if_shipped": shipped,
        }

    case("A04_packed_ship_cancel_retry_race", ship_race)

    def crash():
        order = create("A05")
        before = bins()
        envelope = dict(
            company="TEST-A",
            source="lab-manual",
            request_id="A05:pick",
            operation="pick",
            payload={"order_id": order},
        )
        # Kill only this child, after native cancellation, at entry to native mapper.
        code = """import os,signal,sys,json,frappe
frappe.init('wms-native-a.invalid');frappe.connect();frappe.set_user('Guest')
from erpnext.selling.doctype.sales_order import sales_order
from surooh_accounting.native_lab.api import _execute
def crash(*a,**k): os.kill(os.getpid(),signal.SIGKILL)
sales_order.create_pick_list=crash
v=json.load(sys.stdin);_execute(v['envelope'],v['token'])
raise RuntimeError('injection was not reached')
"""
        child = subprocess.run(
            [sys.executable, "-c", code],
            input=json.dumps({"envelope": envelope, "token": token()}),
            text=True,
            capture_output=True,
            timeout=60,
            env=os.environ.copy(),
        )
        assert child.returncode == -signal.SIGKILL, (child.returncode, child.stderr)
        assert bins() == before
        entries = reservations(order)
        assert len(entries) == 2 and all(not x[3] for x in entries), entries
        result = action("pick", order, "A05:pick")
        assert action("pick", order, "A05:pick") == result
        assert len(reservations(order)) == 2 and bins() == before
        action("cancel", order, "A05:cancel")
        return {
            "child_exit": child.returncode,
            "injection": "SIGKILL after native SO unreserve before native pick mapping",
            "rollback_preserved_original_SRE": True,
            "new_process_retry": result,
        }

    case("A05_process_death_rolls_back_handoff", crash)

    def no_gap():
        order = create("A06", 5)
        before = bins()
        outcomes = race(
            lambda: action("pick", order, "A06:pick"),
            lambda: call(
                "order",
                {"lines": [{"product_id": "TEST-KIT", "quantity": 1}]},
                "A06:competitor",
                tok=token(sub=other),
            ),
        )
        assert outcomes[0]["success"] and not outcomes[1]["success"], outcomes
        assert bins() == before
        entries = reservations(order)
        assert len(entries) == 2 and sum(float(x[1]) for x in entries) == 15
        action("cancel", order, "A06:cancel")
        return {
            "outcomes": outcomes,
            "all_C2_stock_reserved": True,
            "no_transient_availability_or_oversell": True,
        }

    case("A06_handoff_vs_competing_shared_bundle", no_gap)

    def projection():
        result = wms("projection")
        assert result["company"] == "TEST-A" and result["stock_rows"] >= 2
        return result

    case("A07_actual_WMS_projection_service_over_HTTP", projection)

    def packed_cancel():
        order = create("A08")
        before = bins()
        action("pick", order, "A08:pick")
        packed = action("pack", order, "A08:pack")
        assert action("pack", order, "A08:pack") == packed
        action("cancel", order, "A08:cancel")
        owner()
        assert frappe.db.get_value("Sales Order", order, "docstatus") == 2
        assert not reservations(order)
        assert all(value[1] == 0 for value in bins().values())
        assert {key: (value[0], value[2]) for key, value in bins().items()} == {
            key: (value[0], value[2]) for key, value in before.items()
        }
        return {
            "native_packed_order_cancelled": order,
            "native_pack": packed,
            "value_unchanged": True,
        }

    case("A08_packed_cancel_and_pack_replay", packed_cancel)

    def screen_services():
        return wms("screens")

    case("A09_actual_screen_mutation_services_native_full_cycle", screen_services)
