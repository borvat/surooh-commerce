"""Real native proportional batches, reservations, replay and valuation."""


def run(case, call, token, owner, bins, wms):
    import frappe

    def denied(fn, text):
        try:
            fn()
        except AssertionError as exc:
            assert text.lower() in str(exc).lower(), str(exc)
            return
        raise AssertionError("Shipment operation unexpectedly succeeded")

    def order(key, qty=3):
        return call(
            "order", {"lines": [{"product_id": "TEST-KIT", "quantity": qty}]}, key
        )["order_id"]

    def pick(name, key, units=1, expected=None, **kwargs):
        return call(
            "batch_pick",
            {
                "order_id": name,
                "batch_id": key,
                "units": units,
                "expected_picks": expected or [],
            },
            key,
            **kwargs,
        )

    def ship(name, picked, key):
        payload = {"order_id": name, "pick_list": picked["pick_list"]}
        packed = call("batch_pack", payload, key + ":pack")
        shipped = call("batch_ship", payload, key + ":ship")
        assert call("batch_ship", payload, key + ":alias") == shipped
        assert call("batch_pack", payload, key + ":pack-alias") == packed
        return shipped

    def lifecycle():
        call(
            "receive",
            {
                "items": [
                    {"item": "TEST-C1", "qty": 30, "rate": 10},
                    {"item": "TEST-C2", "qty": 60, "rate": 20},
                ]
            },
            "P01:receipt",
        )
        name = order("P01:order")
        before = bins()
        history = []
        deliveries = []
        for index in range(3):
            key = "P01:batch:" + str(index)
            result = wms(
                "batch-pick", order_id=name, units=1, batch_id=key, request=key
            )
            if index == 0:
                assert bins() == before
            history.append(result["pick_list"])
            shipped = ship(name, result, key)
            deliveries.append(shipped["delivery_note"])
            owner()
            doc = frappe.get_doc("Sales Order", name)
            assert [float(x.delivered_qty) for x in doc.items] == [
                index + 1,
                (index + 1) * 2,
            ]
            sre = frappe.db.sql(
                "SELECT coalesce(sum(reserved_qty-delivered_qty),0) FROM `tabStock Reservation Entry` WHERE voucher_no=%s AND docstatus=1",
                name,
            )[0][0]
            assert float(sre) == (2 - index) * 3
            sle = frappe.db.sql(
                "SELECT sum(actual_qty),sum(stock_value_difference) FROM `tabStock Ledger Entry` WHERE voucher_no=%s AND is_cancelled=0",
                shipped["delivery_note"],
            )[0]
            assert tuple(map(float, sle)) == (-3.0, -50.0), sle
            gl = frappe.db.sql(
                "SELECT sum(debit),sum(credit) FROM `tabGL Entry` WHERE voucher_no=%s AND is_cancelled=0",
                shipped["delivery_note"],
            )[0]
            assert tuple(map(float, gl)) == (50.0, 50.0), gl
        after = bins()
        assert after["TEST-C1"][0] == before["TEST-C1"][0] - 3
        assert after["TEST-C2"][0] == before["TEST-C2"][0] - 6
        assert len(set(deliveries)) == 3
        denied(lambda: pick(name, "P01:excess", expected=sorted(history)), "exceeds")
        return {
            "order": name,
            "native_picks": history,
            "native_deliveries": deliveries,
            "per_batch_native_SLE_value": -50,
            "per_batch_native_GL_debit_credit": [50, 50],
            "remaining_reservation_after_each_batch": [6, 3, 0],
        }

    case("P01_three_WMS_batches_preserve_remainder_and_native_SLE_GL", lifecycle)

    def races():
        from concurrent.futures import ThreadPoolExecutor
        import threading

        name = order("P02:order", 2)
        before = bins()
        payload = {
            "order_id": name,
            "batch_id": "P02:batch",
            "units": 1,
            "expected_picks": [],
        }
        barrier = threading.Barrier(2)

        def race(index):
            barrier.wait(timeout=10)
            return call(
                "batch_pick",
                payload,
                "P02:actor:" + str(index),
                tok=token(sub="second-operator@example.invalid") if index else token(),
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(race, [0, 1]))
        assert results[0] == results[1] and bins() == before
        denied(
            lambda: call("batch_pick", {**payload, "units": 2}, "P02:conflict"),
            "payload conflict",
        )
        denied(lambda: pick(name, "P02:stale"), "history changed")
        denied(
            lambda: pick(name, "P02:active", expected=[results[0]["pick_list"]]),
            "active batch",
        )
        ship(name, results[0], "P02:first")
        # A different stale batch must not silently become the next shipment.
        denied(lambda: pick(name, "P02:late-stale"), "history changed")
        second = pick(name, "P02:second", expected=[results[0]["pick_list"]])
        ship(name, second, "P02:second")
        return {
            "different_actor_business_replay": results,
            "same_batch_changed_payload_denied": True,
            "stale_history_denied_before_and_after_ship": True,
            "one_active_batch": True,
        }

    case("P02_concurrent_batch_replay_conflict_and_stale_history", races)

    def guards():
        name = order("P03:order", 2)
        result = pick(name, "P03:batch")
        before = bins()
        for operation in ["pick", "pack", "ship", "cancel"]:
            denied(
                lambda operation=operation: call(
                    operation, {"order_id": name}, "P03:legacy:" + operation
                ),
                "explicit shipment batch",
            )
        denied(
            lambda: call(
                "batch_ship",
                {"order_id": name, "pick_list": result["pick_list"]},
                "P03:unpacked",
            ),
            "Packed shipment",
        )
        other = order("P03:other", 1)
        denied(
            lambda: call(
                "batch_pack",
                {"order_id": other, "pick_list": result["pick_list"]},
                "P03:foreign-order",
            ),
            "Trusted shipment",
        )
        call("cancel", {"order_id": other}, "P03:cancel-other")
        assert bins() == before
        first = ship(name, result, "P03:first")
        quarantine = call(
            "location_create",
            {"label": "P03 quarantine", "quarantine": True},
            "P03:location",
        )
        returned = call(
            "return_quarantine",
            {
                "delivery_note": first["delivery_note"],
                "warehouse": quarantine["warehouse"],
                "reason": "Synthetic batch return",
            },
            "P03:return",
        )
        owner()
        doc = frappe.get_doc("Sales Order", name)
        assert [float(x.delivered_qty) for x in doc.items] == [0, 0]
        returned_fields = [float(x.returned_qty) for x in doc.items]
        before_remainder = call("snapshot", {}, "P03:after-return")
        projected = next(row for row in before_remainder["orders"] if row["id"] == name)
        assert projected["shipment_plan"]["remaining_units"] == 1
        assert (
            projected["shipment_batches"][0]["return_note"] == returned["return_note"]
        )
        remainder = pick(name, "P03:remainder", expected=[result["pick_list"]])
        ship(name, remainder, "P03:remainder")
        readback = call("snapshot", {}, "P03:readback")
        current = next(row for row in readback["orders"] if row["id"] == name)
        assert current["shipment_plan"]["remaining_units"] == 0
        assert current["status"] == "fulfilled"
        assert current["shipment_batches"][0]["return_note"] == returned["return_note"]
        return {
            "legacy_and_unpacked_and_foreign_order_commands_denied": True,
            "quarantine_return_for_one_delivery": returned,
            "remaining_order_stays_reserved": True,
            "native_SO_returned_qty_observed_not_assumed": returned_fields,
            "gross_fulfillment_from_submitted_outgoing_DN_rows": True,
        }

    case("P03_batch_scope_guards_and_per_delivery_quarantine_return", guards)

    def competing():
        from concurrent.futures import ThreadPoolExecutor
        import threading

        name = order("P04:order", 2)
        before = bins()
        barrier = threading.Barrier(2)

        def prepare(index):
            barrier.wait(timeout=10)
            try:
                return pick(
                    name,
                    "P04:batch:" + str(index),
                    tok=token(sub="second-operator@example.invalid")
                    if index
                    else token(),
                )
            except AssertionError as exc:
                assert "history changed" in str(exc).lower(), str(exc)
                return None

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(prepare, [0, 1]))
        winners = [result for result in results if result]
        assert len(winners) == 1 and bins() == before
        picked = winners[0]
        payload = {"order_id": name, "pick_list": picked["pick_list"]}
        call("batch_pack", payload, "P04:pack")
        barrier = threading.Barrier(2)

        def dispatch(index):
            barrier.wait(timeout=10)
            return call(
                "batch_ship",
                payload,
                "P04:ship:" + str(index),
                tok=token(sub="second-operator@example.invalid") if index else token(),
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            shipped = list(pool.map(dispatch, [0, 1]))
        assert shipped[0] == shipped[1]
        owner()
        sle = frappe.db.sql(
            "SELECT sum(actual_qty),sum(stock_value_difference) FROM `tabStock Ledger Entry` WHERE voucher_no=%s AND is_cancelled=0",
            shipped[0]["delivery_note"],
        )[0]
        assert tuple(map(float, sle)) == (-3.0, -50.0)
        remainder = pick(name, "P04:remainder", expected=[picked["pick_list"]])
        ship(name, remainder, "P04:remainder")
        return {
            "competing_new_batch_winners": len(winners),
            "concurrent_ship_same_delivery": shipped,
            "single_native_SLE_effect": list(map(float, sle)),
        }

    case("P04_competing_new_batches_and_concurrent_ship_have_one_effect", competing)

    def crash():
        import json
        import os
        import signal
        import subprocess
        import sys

        name = order("P05:order", 2)
        before = bins()
        payload = {
            "order_id": name,
            "batch_id": "P05:batch",
            "units": 1,
            "expected_picks": [],
        }
        envelope = dict(
            company="TEST-A",
            source="lab-manual",
            request_id="P05:pick",
            operation="batch_pick",
            payload=payload,
        )
        code = """import os,signal,sys,json,frappe
frappe.init('wms-native-a.invalid');frappe.connect();frappe.set_user('Guest')
from surooh_accounting.native_lab import shipping
from surooh_accounting.native_lab.api import _execute
original=shipping.reserve
def crash(*args,**kwargs):
 original(*args,**kwargs)
 os.kill(os.getpid(),signal.SIGKILL)
shipping.reserve=crash
v=json.load(sys.stdin);_execute(v['envelope'],v['token'])
raise RuntimeError('injection not reached')
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
        owner()
        assert not frappe.db.exists("Pick List Item", {"sales_order": name})
        sre = frappe.db.sql(
            "SELECT reserved_qty,from_voucher_type FROM `tabStock Reservation Entry` WHERE voucher_no=%s AND docstatus=1",
            name,
        )
        assert sum(float(row[0]) for row in sre) == 6 and all(not row[1] for row in sre)
        recovered = call("batch_pick", payload, "P05:pick")
        assert call("batch_pick", payload, "P05:pick") == recovered
        ship(name, recovered, "P05:first")
        remainder = pick(name, "P05:remainder", expected=[recovered["pick_list"]])
        ship(name, remainder, "P05:remainder")
        return {
            "child_exit": child.returncode,
            "rollback_after_native_pick_and_first_SRE": True,
            "original_order_reservations_preserved": True,
            "new_process_replay": recovered,
        }

    case("P05_SIGKILL_after_first_batch_reservation_rolls_back_and_recovers", crash)

    def cancelled():
        name = order("P06:order", 2)
        before = bins()
        first = pick(name, "P06:first")
        payload = {"order_id": name, "pick_list": first["pick_list"]}
        packed = call("batch_pack", payload, "P06:pack")
        result = call("batch_cancel", payload, "P06:cancel")
        assert call("batch_cancel", payload, "P06:cancel-alias") == result
        assert bins() == before
        owner()
        assert frappe.db.get_value("Pick List", first["pick_list"], "docstatus") == 2
        assert not frappe.db.exists("Delivery Note", packed["delivery_note"])
        denied(
            lambda: call("batch_ship", payload, "P06:cancelled-ship"),
            "Submitted shipment batch",
        )
        denied(lambda: pick(name, "P06:stale"), "history changed")
        replacement = pick(
            name, "P06:replacement", units=2, expected=[first["pick_list"]]
        )
        ship(name, replacement, "P06:replacement")
        denied(
            lambda: call(
                "batch_cancel",
                {"order_id": name, "pick_list": replacement["pick_list"]},
                "P06:shipped-cancel",
            ),
            "requires a return",
        )
        return {
            "native_cancelled_pick": first["pick_list"],
            "deleted_draft_delivery": packed["delivery_note"],
            "all_remaining_reservations_restored": True,
            "replacement": replacement,
            "cancelled_history_prevents_ABA_stale_request": True,
        }

    case("P06_packed_batch_cancel_restores_reservation_and_keeps_history", cancelled)
