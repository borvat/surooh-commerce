"""Real Frappe WSGI server; isolated loopback only."""


def main():

    import os

    assert os.environ.get("SUROOH_NATIVE_INTEGRATION") == "true"
    import frappe.app
    import traceback
    from werkzeug.serving import run_simple

    # Test-only telemetry: framework-handled exceptions otherwise hide the failing frame.
    # No locals, request bodies or credentials are logged; bootstrap redacts generated secrets.
    original_handler = frappe.app.handle_exception

    def report_exception(error):
        traceback.print_exception(type(error), error, error.__traceback__)
        return original_handler(error)

    frappe.app.handle_exception = report_exception

    # Website rendering handles errors before the API exception hook. Preserve
    # their traceback too, without changing the framework response or logging
    # request bodies/locals. Bootstrap still redacts generated lab credentials.
    import frappe.website.serve

    original_website_handler = frappe.website.serve.handle_exception

    def report_website_exception(error, endpoint, path, status):
        traceback.print_exception(type(error), error, error.__traceback__)
        return original_website_handler(error, endpoint, path, status)

    frappe.website.serve.handle_exception = report_website_exception

    frappe.app._sites_path = "."
    run_simple(
        "127.0.0.1", 18080, frappe.app.application, threaded=True, use_reloader=False
    )


if __name__ == "__main__":
    main()
