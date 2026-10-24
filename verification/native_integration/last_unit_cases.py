"""Distinct-actor native order races over one physical component, not a model."""

import threading
from concurrent.futures import ThreadPoolExecutor


def run(case, call, token, owner):
    import frappe

    component = "TEST-LAST-UNIT"
    kit = "TEST-LAST-UNIT-KIT"
    peer = "second-operator@example.invalid"

    def balance():
        owner()
        row = frappe.db.get_value(
            "Bin",
            {"item_code": component, "warehouse": frappe.conf.surooh_lab_warehouse},
            ["actual_qty", "reserved_stock", "stock_value"],
        )
        return tuple(map(float, row))

    def compete(label, products):
        barrier = threading.Barrier(2)

        def invoke(index):
            barrier.wait(timeout=10)
            try:
                result = call(
                    "order",
                    {"lines": [{"product_id": products[index], "quantity": 1}]},
                    f"{label}:actor:{index}",
                    tok=token(sub=peer) if index else token(),
                )
                return {"success": True, "result": result, "product": products[index]}
            except AssertionError as error:
                detail = error.args[0] if error.args else None
                if not isinstance(detail, tuple) or len(detail) != 2 or not isinstance(detail[1], dict):
                    raise
                return {"success": False, "status": detail[0], "error_type": detail[1].get("exc_type")}

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(invoke, [0, 1]))
        winners = [row for row in outcomes if row["success"]]
        losers = [row for row in outcomes if not row["success"]]
        try:
            assert len(winners) == len(losers) == 1, outcomes
            assert losers[0]["status"] == 417 and losers[0]["error_type"] == "ValidationError", losers
            assert balance() == (1, 1, 10)
            owner()
            reservations = frappe.db.sql(
                "SELECT voucher_no,reserved_qty,delivered_qty "
                "FROM `tabStock Reservation Entry` WHERE item_code=%s AND docstatus=1",
                component,
            )
            assert len(reservations) == 1, reservations
            assert reservations[0][0] == winners[0]["result"]["order_id"]
            assert tuple(map(float, reservations[0][1:])) == (1, 0)
            submitted_orders = frappe.db.sql(
                "SELECT count(DISTINCT s.name) FROM `tabSales Order` s "
                "JOIN `tabSales Order Item` i ON i.parent=s.name "
                "WHERE i.item_code=%s AND s.docstatus=1", component,
            )[0][0]
            assert submitted_orders == 1, submitted_orders
            sle = frappe.db.sql(
                "SELECT count(*),sum(actual_qty),sum(stock_value_difference) "
                "FROM `tabStock Ledger Entry` WHERE item_code=%s AND is_cancelled=0", component,
            )[0]
            assert tuple(map(float, sle)) == (1, 1, 10), sle
            projection = call("snapshot", {}, label + ":snapshot")
            item = next(row for row in projection["items"] if row["id"] == component)
            assert item["physical"] == item["reserved"] == 1
        finally:
            # A failed assertion must not leave the next independent race reserved.
            for index, winner in enumerate(winners):
                call("cancel", {"order_id": winner["result"]["order_id"]}, f"{label}:cancel:{index}")
        assert balance() == (1, 0, 10)
        return {
            "two_distinct_HTTP_actors_and_request_keys": True,
            "physical_quantity": 1,
            "one_success_one_validation_rejection_not_auth_failure": True,
            "losing_order_not_persisted_and_receipt_only_SLE": True,
            "one_native_SRE_for_winning_SO": True,
            "winning_product": winners[0]["product"],
            "cancellation_released_exactly_one_unit": True,
            "native_stock_value_unchanged": 10,
        }

    def last_piece():
        owner()
        for code, stock in [(component, 1), (kit, 0)]:
            frappe.get_doc(
                dict(
                    doctype="Item",
                    item_code=code,
                    item_name=code,
                    item_group="TEST-ITEMS",
                    stock_uom="Nos",
                    is_stock_item=stock,
                )
            ).insert()
        frappe.get_doc(
            dict(
                doctype="Product Bundle",
                new_item_code=kit,
                items=[dict(item_code=component, qty=1)],
            )
        ).insert()
        frappe.db.commit()
        call(
            "receive",
            {"items": [{"item": component, "qty": 1, "rate": 10}]},
            "C01:single-unit-receipt",
        )
        assert balance() == (1, 0, 10)
        return compete("C01", [component, component])

    case("C01_distinct_orders_compete_for_one_last_native_unit", last_piece)
    case(
        "C02_bundle_and_single_compete_for_the_same_last_component",
        lambda: compete("C02", [kit, component]),
    )
