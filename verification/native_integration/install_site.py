"""Internal fresh installer subprocess; private synthetic configuration only."""


def main():

    import argparse
    import json
    import os
    import secrets
    from pathlib import Path

    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    args = parser.parse_args()
    assert os.environ.get("WMS_TEST_ISOLATED") == "true"
    config = json.loads(args.config.read_text())
    sites = Path(config["sites"])
    assert sites.parent.parent.name.startswith("surooh-new-native-")
    os.chdir(sites)
    import frappe
    import erpnext

    assert frappe.__version__ == "16.52.0" and erpnext.__version__ == "16.52.0"
    from frappe.installer import _new_site

    frappe.init("wms-native-a.invalid", new_site=True)
    _new_site(
        "surooh_fresh_wms_a",
        "wms-native-a.invalid",
        db_root_username="root",
        db_root_password=config["password"],
        admin_password=config["password"],
        db_password=secrets.token_urlsafe(30),
        db_type="mariadb",
        db_host="127.0.0.1",
        db_port=14306,
        install_apps=["erpnext", "surooh_accounting", "surooh_native_guard"],
        verbose=False,
        force=False,
    )
    frappe.init("wms-native-a.invalid")
    frappe.connect()
    assert set(frappe.get_installed_apps()) == {
        "frappe",
        "erpnext",
        "surooh_accounting",
        "surooh_native_guard",
    }
    assert not frappe.get_all("Company")
    print("FRESH_SITE_INSTALLED_NO_COMPANIES")
    frappe.destroy()
    frappe.init("wms-native-b.invalid", new_site=True)
    _new_site(
        "surooh_fresh_wms_b",
        "wms-native-b.invalid",
        db_root_username="root",
        db_root_password=config["password"],
        admin_password=secrets.token_urlsafe(30),
        db_password=secrets.token_urlsafe(30),
        db_type="mariadb",
        db_host="127.0.0.1",
        db_port=14306,
        install_apps=["erpnext", "surooh_accounting", "surooh_native_guard"],
        verbose=False,
        force=False,
    )
    frappe.init("wms-native-b.invalid")
    frappe.connect()
    assert not frappe.get_all("Company")
    print("FRESH_TWO_SITES_INSTALLED_NO_COMPANIES")
    frappe.destroy()
    from native_cases import run

    run(config)


if __name__ == "__main__":
    main()
