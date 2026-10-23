"""Storage, count and transfer acceptance over real HTTP/native transactions."""

from concurrent.futures import ThreadPoolExecutor
import threading


def run(case, call, token, owner, wms):
    import frappe

    ctx = {}

    def denied(fn, text):
        try:
            fn()
        except AssertionError as exc:
            assert text.lower() in str(exc).lower(), str(exc)
            return
        raise AssertionError("Operation unexpectedly succeeded")

    def snapshot():
        return call(
            "stock_locations", {}, "O:snapshot:" + frappe.generate_hash(length=12)
        )

    def balance(wh):
        row = next(
            (
                r
                for r in snapshot()["bins"]
                if r["warehouse"] == wh and r["item_code"] == "TEST-C1"
            ),
            {},
        )
        return float(row.get("actual_qty", 0)), float(row.get("stock_value", 0))

    def transfer(source, target, qty, key, **kw):
        return call(
            "stock_transfer",
            dict(
                source=source,
                target=target,
                item="TEST-C1",
                qty=qty,
                reason="Synthetic putaway",
            ),
            key,
            **kw,
        )

    def count(wh, qty, expected, key):
        return call(
            "stock_count",
            dict(
                warehouse=wh,
                item="TEST-C1",
                qty=qty,
                expected_qty=expected,
                reason="Synthetic physical count",
            ),
            key,
        )

    def locations():
        before = snapshot()
        ctx["base"] = before["fulfillment_warehouse"]
        ctx["storage"] = call(
            "location_create",
            {"label": "TEST-STORAGE", "quarantine": False},
            "O01:storage",
        )["warehouse"]
        ctx["quarantine"] = call(
            "location_create",
            {"label": "TEST-QUARANTINE", "quarantine": True},
            "O01:quarantine",
        )["warehouse"]
        assert (
            call(
                "location_create",
                {"label": "TEST-STORAGE", "quarantine": False},
                "O01:storage-again",
            )["warehouse"]
            == ctx["storage"]
        )
        denied(
            lambda: call(
                "location_create",
                {"label": "TEST-STORAGE", "quarantine": True},
                "O01:conflict",
            ),
            "different settings",
        )
        result = wms("stock-locations")
        assert result["locations"] >= 3
        return {"locations": ctx.copy(), "WMS_service": result}

    case("O01_native_locations_and_WMS_projection", locations)

    def putaway():
        before = balance(ctx["base"])
        first = transfer(ctx["base"], ctx["storage"], 2, "O02:transfer")
        assert transfer(ctx["base"], ctx["storage"], 2, "O02:transfer") == first
        after, storage = balance(ctx["base"]), balance(ctx["storage"])
        assert after[0] == before[0] - 2 and storage[0] == 2
        assert abs(after[1] + storage[1] - before[1]) < 0.00001
        owner()
        assert (
            frappe.db.get_value("Stock Entry", first["stock_entry"], "docstatus") == 1
        )
        return {
            "voucher": first,
            "before": before,
            "after": after,
            "storage": storage,
            "value_conserved": True,
        }

    case("O02_native_transfer_replay_quantity_and_value_conservation", putaway)

    def boundaries():
        before = snapshot()["bins"]
        owner()
        frappe.local.surooh_native_command = True
        try:
            co = frappe.get_doc(
                dict(
                    doctype="Company",
                    company_name="TEST-FOREIGN",
                    abbr="TF",
                    country="Netherlands",
                    default_currency="EUR",
                    create_chart_of_accounts_based_on="Standard Template",
                    chart_of_accounts="Standard",
                )
            ).insert()
            foreign = frappe.db.get_value(
                "Warehouse", {"company": co.name, "is_group": 0}, "name"
            )
            frappe.db.commit()
        finally:
            frappe.local.surooh_native_command = False
        assert foreign
        denied(
            lambda: transfer(ctx["storage"], foreign, 1, "O03:foreign"),
            "current company",
        )
        denied(
            lambda: transfer(ctx["storage"], ctx["storage"], 1, "O03:same"),
            "Different source",
        )
        denied(
            lambda: transfer(ctx["storage"], ctx["base"], -1, "O03:negative"),
            "out of range",
        )
        denied(
            lambda: transfer(ctx["storage"], ctx["base"], True, "O03:bool"),
            "out of range",
        )
        assert snapshot()["bins"] == before
        return {
            "foreign_company_same_location_negative_boolean_denied": True,
            "unchanged_native_bins": True,
        }

    case("O03_warehouse_boundaries_and_quantity_validation", boundaries)

    def reserved():
        qty = int(balance(ctx["base"])[0])
        order = call(
            "order",
            {"lines": [{"product_id": "TEST-C1", "quantity": qty}]},
            "O04:order",
        )["order_id"]
        denied(
            lambda: transfer(ctx["base"], ctx["storage"], 1, "O04:transfer"),
            "unreserved",
        )
        denied(lambda: count(ctx["base"], qty - 1, qty, "O04:count"), "reservations")
        call("cancel", {"order_id": order}, "O04:cancel")
        assert balance(ctx["base"])[0] == qty
        return {"reserved_order": order, "transfer_and_count_denied": True}

    case("O04_reserved_stock_protected_from_transfer_and_count", reserved)

    def reconciliation():
        before = balance(ctx["storage"])
        first = count(ctx["storage"], 1, 2, "O05:count")
        assert count(ctx["storage"], 1, 2, "O05:count") == first
        after = balance(ctx["storage"])
        assert after[0] == 1 and abs(after[1] * 2 - before[1]) < 0.00001
        denied(lambda: count(ctx["storage"], 0, 2, "O05:stale"), "refresh and recount")
        owner()
        name = first["stock_reconciliation"]
        assert frappe.db.get_value("Stock Reconciliation", name, "docstatus") == 1
        gl = frappe.db.sql(
            "SELECT sum(debit),sum(credit),count(*) FROM `tabGL Entry` WHERE voucher_no=%s AND is_cancelled=0",
            name,
        )[0]
        assert frappe.db.exists(
            "Comment",
            {
                "reference_doctype": "Stock Reconciliation",
                "reference_name": name,
                "content": ["like", "%Synthetic physical count%"],
            },
        )
        assert gl[0] > 0 and abs(float(gl[0] - gl[1])) < 0.00001 and gl[2] >= 2
        unchanged = count(ctx["storage"], 1, 1, "O05:unchanged")
        assert unchanged["no_change"]
        return {
            "native_reconciliation": name,
            "before": before,
            "after": after,
            "balanced_native_GL": gl,
            "stale_count_denied": True,
        }

    case("O05_native_count_value_GL_replay_and_stale_count", reconciliation)

    def concurrent():
        barrier = threading.Barrier(2)

        def invoke(i):
            barrier.wait(timeout=10)
            try:
                return {
                    "success": True,
                    "result": transfer(
                        ctx["storage"],
                        ctx["quarantine"],
                        1,
                        "O06:transfer:" + str(i),
                        tok=token(sub="second-operator@example.invalid")
                        if i
                        else token(),
                    ),
                }
            except AssertionError as exc:
                assert "unreserved" in str(exc).lower(), str(exc)
                return {"success": False, "stock_shortage": True}

        before = balance(ctx["storage"])[1] + balance(ctx["quarantine"])[1]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(invoke, [0, 1]))
        assert sum(row["success"] for row in results) == 1, results
        assert balance(ctx["storage"])[0] == 0 and balance(ctx["quarantine"])[0] == 1
        assert abs(balance(ctx["quarantine"])[1] - before) < 0.00001
        projection = wms("stock-locations")
        return {
            "different_actor_concurrent_HTTP": results,
            "value_conserved": True,
            "quarantine_stock_separate": projection,
        }

    case("O06_concurrent_last_unit_transfer_and_quarantine", concurrent)

    def returned():
        order = call(
            "order", {"lines": [{"product_id": "TEST-KIT", "quantity": 1}]}, "O07:order"
        )["order_id"]
        for op in ["pick", "pack", "ship"]:
            call(op, {"order_id": order}, "O07:" + op)
        projected = call("snapshot", {}, "O07:shipped")
        delivery = next(row for row in projected["orders"] if row["id"] == order)[
            "delivery_note"
        ]
        ctx["delivery"] = delivery
        base_before, hold_before = balance(ctx["base"]), balance(ctx["quarantine"])
        first = wms(
            "return-quarantine", delivery_note=delivery, warehouse=ctx["quarantine"]
        )
        assert balance(ctx["base"]) == base_before
        assert balance(ctx["quarantine"])[0] == hold_before[0] + 1
        alias = call(
            "return_quarantine",
            dict(
                delivery_note=delivery,
                warehouse=ctx["quarantine"],
                reason="Recheck physical return",
            ),
            "O07:alias",
        )
        assert alias["return_note"] == first["return_note"]
        owner()
        gl = frappe.db.sql(
            "SELECT sum(debit),sum(credit),count(*) FROM `tabGL Entry` WHERE voucher_no=%s AND is_cancelled=0",
            first["return_note"],
        )[0]
        assert gl[0] > 0 and abs(float(gl[0] - gl[1])) < 0.00001
        readback = call("snapshot", {}, "O07:readback")
        assert (
            next(row for row in readback["orders"] if row["id"] == order)["return_note"]
            == first["return_note"]
        )
        transfer(ctx["quarantine"], ctx["base"], 1, "O07:inspection-release")
        assert balance(ctx["base"])[0] == base_before[0] + 1
        return {
            "return": first,
            "same_delivery_deduplicated": True,
            "balanced_native_return_GL": gl,
            "sellable_stock_increased_only_after_native_release": True,
        }

    case("O07_native_quarantine_return_replay_GL_and_inspection_release", returned)

    def return_boundary():
        before = snapshot()["bins"]
        denied(
            lambda: call(
                "return_quarantine",
                dict(
                    delivery_note=ctx["delivery"],
                    warehouse=ctx["base"],
                    reason="Synthetic rejected bypass",
                ),
                "O08:base",
            ),
            "quarantine",
        )
        denied(
            lambda: count(ctx["storage"], -1, 0, "O08:negative-count"), "out of range"
        )
        denied(
            lambda: call(
                "stock_count",
                dict(
                    warehouse=ctx["storage"],
                    item="TEST-C1",
                    qty=1,
                    expected_qty=0,
                    reason="",
                ),
                "O08:no-reason",
            ),
            "reason required",
        )
        assert snapshot()["bins"] == before
        return {
            "direct_restock_negative_count_missing_reason_denied": True,
            "native_bins_unchanged": True,
        }

    case("O08_return_and_count_boundary_validation", return_boundary)
