"""Real HTTP scan validation and native atomic picking; no hardware claim."""


def run(case, call, token, owner, bins, wms):
    import frappe

    scans = [{"code": "SYNTHETIC-C1", "qty": 1}, {"code": "SYNTHETIC-C2", "qty": 2}]

    def order(key):
        return call(
            "order", {"lines": [{"product_id": "TEST-KIT", "quantity": 1}]}, key
        )["order_id"]

    def denied(fn, text):
        try:
            fn()
        except AssertionError as exc:
            assert text.lower() in str(exc).lower(), str(exc)
            return
        raise AssertionError("Scanner operation unexpectedly succeeded")

    def invalid():
        name = order("S01:order")
        before = bins()
        for label, values, message in [
            (
                "unknown",
                [{"code": "NO-SUCH-SYNTHETIC", "qty": 1}],
                "Unknown or ambiguous",
            ),
            ("ambiguous", [{"code": "TEST-C2", "qty": 2}], "Unknown or ambiguous"),
            ("other", [{"code": "TEST-KIT", "qty": 1}], "not in this order"),
            ("excess", [{"code": "SYNTHETIC-C1", "qty": 2}], "exceeds"),
            ("missing", scans[:1], "every ordered component"),
            ("negative", [{"code": "SYNTHETIC-C1", "qty": -1}], "out of range"),
        ]:
            denied(
                lambda values=values, label=label: call(
                    "scan_pick", {"order_id": name, "scans": values}, "S01:" + label
                ),
                message,
            )
        assert bins() == before
        owner()
        assert not frappe.db.exists("Pick List Item", {"sales_order": name})
        call("cancel", {"order_id": name}, "S01:cancel")
        return {
            "unknown_ambiguous_foreign_excess_incomplete_negative_denied": True,
            "native_pick_not_created": True,
            "stock_value_reservations_unchanged": True,
        }

    case("S01_invalid_scans_do_not_create_pick_or_change_reservations", invalid)

    def picked():
        name = order("S02:order")
        before = bins()
        first = wms("scanner-pick", order_id=name, scans=scans, request="S02:pick")
        from concurrent.futures import ThreadPoolExecutor
        import threading

        barrier = threading.Barrier(2)

        def alias(index):
            barrier.wait(timeout=10)
            return call(
                "scan_pick",
                {"order_id": name, "scans": scans},
                "S02:alias:" + str(index),
                tok=token(sub="second-operator@example.invalid") if index else token(),
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            aliases = list(pool.map(alias, [0, 1]))
        assert all(result == first for result in aliases) and bins() == before
        owner()
        assert frappe.db.get_value("Pick List", first["pick_list"], "docstatus") == 1
        comments = frappe.get_all(
            "Comment",
            filters={
                "reference_doctype": "Pick List",
                "reference_name": first["pick_list"],
                "content": ["like", "Scanner quantities verified:%"],
            },
            pluck="name",
        )
        assert len(comments) == 1
        sre = frappe.db.sql(
            "SELECT reserved_qty,from_voucher_type FROM `tabStock Reservation Entry` WHERE voucher_no=%s AND docstatus=1",
            name,
        )
        assert (
            len(sre) == 2
            and sum(float(row[0]) for row in sre) == 3
            and all(row[1] == "Pick List" for row in sre)
        )
        call("cancel", {"order_id": name}, "S02:cancel")
        return {
            "WMS_scanner_service_replay": first,
            "native_comment": comments[0],
            "native_reservations": sre,
            "unchanged_quantity_and_value": True,
            "no_hardware_attestation": True,
            "different_actor_concurrent_command_replay": aliases,
        }

    case("S02_actual_WMS_scanner_service_native_pick_audit_and_replay", picked)

    def no_retroactive():
        name = order("S03:order")
        picked = call("pick", {"order_id": name}, "S03:manual")
        owner()
        forged = frappe.get_doc("Pick List", picked["pick_list"]).add_comment(
            "Comment", text="Scanner quantities verified: FORGED-SYNTHETIC-COMMENT"
        )
        frappe.db.commit()
        denied(
            lambda: call(
                "scan_pick", {"order_id": name, "scans": scans}, "S03:retroactive"
            ),
            "retrospectively",
        )
        owner()
        assert (
            frappe.db.count(
                "Comment",
                {
                    "reference_doctype": "Pick List",
                    "reference_name": picked["pick_list"],
                    "content": ["like", "Scanner quantities verified:%"],
                },
            )
            == 1
        )
        assert (
            frappe.db.get_value("Comment", forged.name, "content")
            == "Scanner quantities verified: FORGED-SYNTHETIC-COMMENT"
        )
        call("cancel", {"order_id": name}, "S03:cancel")
        denied(
            lambda: call(
                "scan_pick", {"order_id": name, "scans": scans}, "S03:cancelled"
            ),
            "Submitted order required",
        )
        return {
            "manual_pick_not_relabelled_as_scanner_evidence": True,
            "cancelled_order_denied": True,
        }

    case(
        "S03_manual_pick_evidence_and_cancelled_order_are_not_rewritten", no_retroactive
    )
