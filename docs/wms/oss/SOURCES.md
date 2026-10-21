# Primary source register

Read at the pins listed below, on 2026-10-21 UTC. File-level implementation observations are independent of marketing claims. URLs are reproducible evidence locations, not proof of passing unexecuted tests.

## erpnext

- [license.txt](https://github.com/frappe/erpnext/blob/90cb7f9243048a44311777d60a1cec8ca05ceec9/license.txt)
- [SECURITY.md](https://github.com/frappe/erpnext/blob/90cb7f9243048a44311777d60a1cec8ca05ceec9/SECURITY.md)
- [erpnext/stock/doctype/stock_reservation_entry/stock_reservation_entry.py](https://github.com/frappe/erpnext/blob/90cb7f9243048a44311777d60a1cec8ca05ceec9/erpnext/stock/doctype/stock_reservation_entry/stock_reservation_entry.py)
- [erpnext/stock/doctype/stock_reservation_entry/test_stock_reservation_entry.py](https://github.com/frappe/erpnext/blob/90cb7f9243048a44311777d60a1cec8ca05ceec9/erpnext/stock/doctype/stock_reservation_entry/test_stock_reservation_entry.py)
- [erpnext/selling/doctype/product_bundle/product_bundle.py](https://github.com/frappe/erpnext/blob/90cb7f9243048a44311777d60a1cec8ca05ceec9/erpnext/selling/doctype/product_bundle/product_bundle.py)
- [Release](https://github.com/frappe/erpnext/releases/tag/v16.52.0)

## odoo

- [LICENSE](https://github.com/odoo/odoo/blob/1fb40e5c0d25852d0495d4e016ab1a47db2ded13/LICENSE)
- [SECURITY.md](https://github.com/odoo/odoo/blob/1fb40e5c0d25852d0495d4e016ab1a47db2ded13/SECURITY.md)
- [addons/stock/security/ir.access.csv](https://github.com/odoo/odoo/blob/1fb40e5c0d25852d0495d4e016ab1a47db2ded13/addons/stock/security/ir.access.csv)
- [addons/mrp/tests/test_multicompany.py](https://github.com/odoo/odoo/blob/1fb40e5c0d25852d0495d4e016ab1a47db2ded13/addons/mrp/tests/test_multicompany.py)
- [addons/stock/tests/test_multicompany.py](https://github.com/odoo/odoo/blob/1fb40e5c0d25852d0495d4e016ab1a47db2ded13/addons/stock/tests/test_multicompany.py)
- [addons/stock/models/stock_quant.py](https://github.com/odoo/odoo/blob/1fb40e5c0d25852d0495d4e016ab1a47db2ded13/addons/stock/models/stock_quant.py)
- [addons/mrp/models/mrp_bom.py](https://github.com/odoo/odoo/blob/1fb40e5c0d25852d0495d4e016ab1a47db2ded13/addons/mrp/models/mrp_bom.py)

## inventree

- [LICENSE](https://github.com/inventree/InvenTree/blob/be488919e4928cf16140b85d77058115a89cb4ef/LICENSE)
- [SECURITY.md](https://github.com/inventree/InvenTree/blob/be488919e4928cf16140b85d77058115a89cb4ef/SECURITY.md)
- [src/backend/InvenTree/order/test_sales_order.py](https://github.com/inventree/InvenTree/blob/be488919e4928cf16140b85d77058115a89cb4ef/src/backend/InvenTree/order/test_sales_order.py)
- [src/backend/InvenTree/order/serializers.py](https://github.com/inventree/InvenTree/blob/be488919e4928cf16140b85d77058115a89cb4ef/src/backend/InvenTree/order/serializers.py)
- [src/backend/InvenTree/part/models.py](https://github.com/inventree/InvenTree/blob/be488919e4928cf16140b85d77058115a89cb4ef/src/backend/InvenTree/part/models.py)
- [src/backend/InvenTree/stock/models.py](https://github.com/inventree/InvenTree/blob/be488919e4928cf16140b85d77058115a89cb4ef/src/backend/InvenTree/stock/models.py)
- [src/backend/InvenTree/company/models.py](https://github.com/inventree/InvenTree/blob/be488919e4928cf16140b85d77058115a89cb4ef/src/backend/InvenTree/company/models.py)
- [Release](https://github.com/inventree/InvenTree/releases/tag/1.6.1)

## openboxes

- [LICENSE.md](https://github.com/openboxes/openboxes/blob/a5c20c74243f32c7303fe38b18d5ad7a4cd55f46/LICENSE.md)
- [build.gradle](https://github.com/openboxes/openboxes/blob/a5c20c74243f32c7303fe38b18d5ad7a4cd55f46/build.gradle)
- [grails-app/services/org/pih/warehouse/inventory/InventoryService.groovy](https://github.com/openboxes/openboxes/blob/a5c20c74243f32c7303fe38b18d5ad7a4cd55f46/grails-app/services/org/pih/warehouse/inventory/InventoryService.groovy)
- [grails-app/services/org/pih/warehouse/inventory/StockMovementService.groovy](https://github.com/openboxes/openboxes/blob/a5c20c74243f32c7303fe38b18d5ad7a4cd55f46/grails-app/services/org/pih/warehouse/inventory/StockMovementService.groovy)
- [test/integration/org/pih/warehouse/inventory/StockMovementServiceTests.groovy](https://github.com/openboxes/openboxes/blob/a5c20c74243f32c7303fe38b18d5ad7a4cd55f46/test/integration/org/pih/warehouse/inventory/StockMovementServiceTests.groovy)
- [Release](https://github.com/openboxes/openboxes/releases/tag/v0.9.8-hotfix1)

## Tryton

- [Official 8.2 download index](https://downloads.tryton.org/8.2/) — stable series artifacts, signatures and SHA256 list.
- [Stock module docs](https://docs.tryton.org/modules-stock/)
- [Product kit docs](https://docs.tryton.org/modules-product-kit/)
- [Tryton server docs](https://docs.tryton.org/trytond/)
- Installed packages and versions: `source-pins.json`, `evidence/tryton-installed.json`.
- Implementation files inspected: `trytond/modules/stock/move.py`, `stock/tests/test_module.py`, stock scenario doctests; `company/tests/test_module.py`; `product_kit/product.py`, `common.py`, `sale.py`, `tests/scenario_product_kit_sale.rst`. Exact selected installed-source hashes are in `evidence/tryton-module-hashes.json`.
- License inspected: installed `trytond_stock-8.2.1.dist-info/licenses/LICENSE`; all runtime packages require a separate completed SBOM/license/advisory review before adoption.

## Additional official documentation

- [Odoo 20 support page](https://www.odoo.com/documentation/20.0/administration/supported_versions.html) — read alongside the pinned SECURITY table; commercial support scope is distinct from Community maintenance.
- [InvenTree stable docs](https://docs.inventree.org/en/stable/) — supplementary; runtime/source assertions take precedence.
- [GNU license FAQ](https://www.gnu.org/licenses/gpl-faq.html), [LGPLv3](https://www.gnu.org/licenses/lgpl-3.0.html), [EPL 1.0](https://www.eclipse.org/legal/epl-v10.html).

No advisory API crawl or full dependency CVE scan was completed. Do not infer a clean security bill from this register.
