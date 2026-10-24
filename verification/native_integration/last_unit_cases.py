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
                return {"success": False, "error": str(error)}

        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes = list(pool.map(invoke, [0, 1]))
        winners = [row for row in outcomes if row["success"]]
        losers = [row for row in outcomes if not row["success"]]
        assert len(winners) == len(losers) == 1, outcomes
        assert "Incomplete component reservation" in losers[0]["error"], losers
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
        projection = call("snapshot", {}, label + ":snapshot")
        for code in [component, kit]:
            item = next(row for row in projection["items"] if row["id"] == code)
            if code == component:
                assert item["physical"] == item["reserved"] == 1
        call("cancel", {"order_id": winners[0]["result"]["order_id"]}, label + ":cancel")
        assert balance() == (1, 0, 10)
        return {
            "two_distinct_HTTP_actors_and_request_keys": True,
            "physical_quantity": 1,
            "one_success_one_insufficient_reservation_rollback": True,
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
