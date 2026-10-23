"""Native remainder-close regressions. Requires the real disposable HTTP runtime."""


def run(case, call, token, owner, bins, old_snapshot):
    import frappe

    def denied(fn, text):
        try:
            fn()
        except AssertionError as exc:
            assert text.lower() in str(exc).lower(), str(exc)
            return
        raise AssertionError("Remainder close unexpectedly succeeded")

    def order(key):
        return call(
            "order", {"lines": [{"product_id": "TEST-KIT", "quantity": 3}]}, key
        )["order_id"]

    def pick(name, key, history=None):
        return call(
            "batch_pick",
            {
                "order_id": name,
                "batch_id": key,
                "units": 1,
                "expected_picks": sorted(history or []),
            },
            key,
        )

    def ship(name, picked, key):
        payload = {"order_id": name, "pick_list": picked["pick_list"]}
        call("batch_pack", payload, key + ":pack")
        return call("batch_ship", payload, key + ":ship")

    def close_payload(name, history, units=2):
        return {
            "order_id": name,
            "expected_picks": sorted(history),
            "expected_remaining_units": units,
            "reason": "Synthetic customer closes unshipped remainder",
        }

    def ledgers():
        owner()
        return [
            frappe.db.sql(
                "SELECT name,actual_qty,stock_value_difference,voucher_no "
                "FROM `tabStock Ledger Entry` WHERE company='TEST-A' ORDER BY name"
            ),
            frappe.db.sql(
                "SELECT name,debit,credit,voucher_no FROM `tabGL Entry` "
                "WHERE company='TEST-A' ORDER BY name"
            ),
        ]

    def assert_closed(name, before, stock_before):
        after = bins()
        for item in ["TEST-C1", "TEST-C2"]:
            assert after[item][0] == stock_before[item][0]
            assert after[item][2] == stock_before[item][2]
        assert after["TEST-C1"][1] == stock_before["TEST-C1"][1] - 2
        assert after["TEST-C2"][1] == stock_before["TEST-C2"][1] - 4
        assert ledgers() == before
        owner()
        doc = frappe.get_doc("Sales Order", name)
        assert doc.docstatus == 1 and doc.status == "Closed"
        assert [float(row.qty) for row in doc.items] == [3, 6]
        remaining = frappe.db.sql(
            "SELECT coalesce(sum(reserved_qty-delivered_qty),0) "
            "FROM `tabStock Reservation Entry` WHERE voucher_no=%s AND docstatus=1",
            name,
        )[0][0]
        assert float(remaining) == 0
        consumed = frappe.db.sql(
            "SELECT delivered_qty FROM `tabStock Reservation Entry` "
            "WHERE voucher_no=%s AND docstatus=1",
            name,
        )
        assert sorted(float(row[0]) for row in consumed) == [1, 2]

    def lifecycle():
        call(
            "receive",
            {"items": [
                {"item": "TEST-C1", "qty": 30, "rate": 10},
                {"item": "TEST-C2", "qty": 60, "rate": 20},
            ]},
            "P09:receipt",
        )
        name = order("P09:order")
        picked = pick(name, "P09:batch")
        shipped = ship(name, picked, "P09:batch")
        payload = close_payload(name, [picked["pick_list"]])
        stock = bins()
        before = ledgers()
        result = call("close_remainder", payload, "P09:close")
        assert call("close_remainder", payload, "P09:close") == result
        for index in range(3):
            assert call("close_remainder", payload, "P09:alias:" + str(index)) == result
        assert_closed(name, before, stock)
        owner()
        assert frappe.db.get_value("Delivery Note", shipped["delivery_note"], "docstatus") == 1
        projection = call("snapshot", {}, "P09:snapshot")
        current = next(row for row in projection["orders"] if row["id"] == name)
        assert current["remainder_closed"] is True
        assert current["shipment_plan"]["remaining_units"] == 2
        assert current["shipment_batches"][0]["shipped"] is True
        denied(lambda: pick(name, "P09:late-pick", [picked["pick_list"]]), "Closed")
        denied(
            lambda: call(
                "close_remainder",
                {**payload, "reason": "Different synthetic reason"},
                "P09:conflict",
            ),
            "payload conflict",
        )
        return {
            "close": result,
            "submitted_order_and_original_quantities_preserved": True,
            "only_unconsumed_SRE_cancelled": True,
            "stock_value_SLE_GL_unchanged": True,
            "replay_across_four_distinct_command_keys": True,
        }

    case("P09_close_remainder_releases_only_unused_native_reservations", lifecycle)

    def refusals():
        name = order("P10:order")
        first = pick(name, "P10:first")
        ship(name, first, "P10:first")
        second = pick(name, "P10:second", [first["pick_list"]])
        history = sorted([first["pick_list"], second["pick_list"]])
        payload = close_payload(name, history)
        packed = call(
            "batch_pack",
            {"order_id": name, "pick_list": second["pick_list"]},
            "P10:pack",
        )
        stock = bins()
        before = ledgers()
        denied(
            lambda: call("close_remainder", payload, "P10:active-close"),
            "active batch",
        )
        denied(
            lambda: call("close_remainder", {**payload, "reason": " "}, "P10:reason"),
            "reason",
        )
        assert bins() == stock and ledgers() == before
        call(
            "batch_cancel",
            {"order_id": name, "pick_list": second["pick_list"]},
            "P10:cancel",
        )
        denied(
            lambda: call(
                "close_remainder",
                {**payload, "expected_picks": [first["pick_list"]]},
                "P10:stale",
            ),
            "history changed",
        )
        denied(
            lambda: call(
                "close_remainder",
                {**payload, "expected_remaining_units": 1},
                "P10:quantity",
            ),
            "remainder changed",
        )
        owner()
        assert not frappe.db.exists("Delivery Note", packed["delivery_note"])
        # A rejected command rolls back its metadata; identical intent can succeed
        # after cancelling the active batch without creating a fresh close intent.
        result = call("close_remainder", payload, "P10:active-close")
        assert_closed(name, before, stock)
        return {
            "close_after_explicit_cancel": result,
            "active_packed_batch_bad_reason_stale_history_and_quantity_rejected": True,
            "cancelled_pick_retained_in_close_compare": True,
        }

    case("P10_close_refuses_active_batch_and_stale_intent", refusals)

    def concurrent():
        from concurrent.futures import ThreadPoolExecutor
        import threading

        name = order("P11:order")
        first = pick(name, "P11:first")
        ship(name, first, "P11:first")
        stale_payload = close_payload(name, [first["pick_list"]])
        second, stale = old_snapshot(
            "close_remainder",
            stale_payload,
            "P11:stale-close",
            lambda: pick(name, "P11:second", [first["pick_list"]]),
            rejection="history changed",
        )
        call(
            "batch_cancel",
            {"order_id": name, "pick_list": second["pick_list"]},
            "P11:cancel",
        )
        payload = close_payload(name, [first["pick_list"], second["pick_list"]])
        before = ledgers()
        stock = bins()
        barrier = threading.Barrier(2)

        def close(index):
            barrier.wait(timeout=10)
            return call(
                "close_remainder",
                payload,
                "P11:close:" + str(index),
                tok=token(sub="second-operator@example.invalid") if index else token(),
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(close, [0, 1]))
        assert results[0] == results[1]
        assert_closed(name, before, stock)
        assert call("close_remainder", payload, "P11:third") == results[0]
        return {
            "old_REPEATABLE_READ_close_rejected_current_batch_history": stale,
            "different_actor_close_results": results,
            "one_release_and_native_close": True,
        }

    case("P11_old_snapshot_and_concurrent_close_keep_one_native_effect", concurrent)

    def crash():
        import json
        import os
        import signal
        import subprocess
        import sys

        name = order("P12:order")
        first = pick(name, "P12:first")
        ship(name, first, "P12:first")
        payload = close_payload(name, [first["pick_list"]])
        envelope = dict(
            company="TEST-A", source="lab-manual", request_id="P12:close",
            operation="close_remainder", payload=payload,
        )
        before = ledgers()
        stock = bins()
        code = """import sys,json,os,signal,frappe
frappe.init('wms-native-a.invalid');frappe.connect();frappe.set_user('Guest')
from surooh_accounting.native_lab.api import _execute
from erpnext.selling.doctype.sales_order.sales_order import SalesOrder
original=SalesOrder.update_status
def crash(self,status):
 if status=='Closed':
  remaining=frappe.db.sql("SELECT coalesce(sum(reserved_qty-delivered_qty),0) FROM `tabStock Reservation Entry` WHERE voucher_no=%s AND docstatus=1 FOR UPDATE",self.name)[0][0]
  assert float(remaining)==0
  os.kill(os.getpid(),signal.SIGKILL)
 return original(self,status)
SalesOrder.update_status=crash
v=json.load(sys.stdin);_execute(v['envelope'],v['token'])
raise RuntimeError('injection not reached')
"""
        child = subprocess.run(
            [sys.executable, "-c", code],
            input=json.dumps({"envelope": envelope, "token": token()}),
            text=True, capture_output=True, timeout=60, env=os.environ.copy(),
        )
        assert child.returncode == -signal.SIGKILL, (child.returncode, child.stderr)
        assert bins() == stock and ledgers() == before
        owner()
        assert frappe.db.get_value("Sales Order", name, "status") != "Closed"
        result = call("close_remainder", payload, "P12:close")
        assert_closed(name, before, stock)
        return {
            "owned_child_exit": child.returncode,
            "crash_after_all_unused_reservations_cancelled_before_close": True,
            "rollback_restored_reservations_and_open_order": True,
            "same_request_new_process_recovered": result,
        }

    case("P12_SIGKILL_between_reservation_release_and_close_rolls_back", crash)
