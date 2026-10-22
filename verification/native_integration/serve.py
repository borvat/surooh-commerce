"""Real Frappe WSGI server; isolated loopback only."""


def main():

    import os

    assert os.environ.get("SUROOH_NATIVE_INTEGRATION") == "true"
    import frappe.app
    from werkzeug.serving import run_simple

    frappe.app._sites_path = "."
    run_simple(
        "127.0.0.1", 18080, frappe.app.application, threaded=True, use_reloader=False
    )


if __name__ == "__main__":
    main()
