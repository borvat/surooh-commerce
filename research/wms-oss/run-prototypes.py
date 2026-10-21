#!/usr/bin/env python3
"""Manual research runner. Native upstream tests only; no install, CI or production targets."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

p = argparse.ArgumentParser()
p.add_argument('product', choices=['tryton', 'inventree'])
p.add_argument('--python', required=True, type=Path)
p.add_argument('--source', type=Path, help='Pinned InvenTree checkout; not needed for Tryton packages')
p.add_argument('--output', required=True, type=Path)
a = p.parse_args()
a.output.mkdir(parents=True, exist_ok=True)
base = Path(tempfile.mkdtemp(prefix='surooh-synthetic-'))
probes = Path(__file__).resolve().parent / 'prototypes'
# Do not inherit database URLs, provider credentials or arbitrary upstream config.
env = {k: os.environ[k] for k in ['PATH', 'LANG', 'LC_ALL'] if k in os.environ}
env.update(PYTHONPATH=str(probes), PYTHONDONTWRITEBYTECODE='1')
python = str(a.python.resolve())
if a.product == 'tryton':
    env['DB_NAME'] = ':memory:'
    groups = [
        ['trytond.modules.stock.tests.test_scenario'],
        ['trytond.modules.stock.tests.test_module.StockTestCase.test_assign_try',
         'trytond.modules.stock.tests.test_module.StockTestCase.test_products_by_location_assign',
         'trytond.modules.company.tests.test_module.CompanyTestCase.test_company_rule',
         'trytond.modules.company.tests.test_module.CompanyTestCase.test_user_company'],
        ['trytond.modules.product_kit.tests.test_scenario', '-k', 'scenario_product_kit_sale'],
        ['tryton_probe.SuroohStockProbe.test_shared_component_cancel_and_dispatch',
         'tryton_probe.SuroohStockProbe.test_company_stock_quantity_scope',
         'tryton_probe.SuroohKitAvailabilityProbe.test_two_native_kits_share_one_component'],
    ]
    commands = [[python, '-m', 'unittest', *group, '-v'] for group in groups]
else:
    if not a.source:
        p.error('--source required for InvenTree')
    app = a.source.resolve() / 'src/backend/InvenTree'
    if not (app / 'manage.py').is_file():
        p.error('InvenTree manage.py missing')
    config = dict(debug=True, plugins_enabled=False, plugin_noinstall=True,
                  database=dict(ENGINE='sqlite3', NAME=str(base / 'synthetic.sqlite3')),
                  media_root=str(base / 'media'), static_root=str(base / 'static'),
                  backup_dir=str(base / 'backup'), site_url='http://localhost:18771',
                  secret_key='synthetic-evaluation-only-not-production')
    config_path = base / 'config.yaml'
    config_path.write_text(json.dumps(config))
    env['INVENTREE_CONFIG_FILE'] = str(config_path)
    names = ['test_over_allocate', 'test_allocate_full', 'test_complete_order',
             'test_complete_allocation_stale_line_instance', 'test_order_cancel',
             'test_order_cancel_stale_instance_is_noop', 'test_complete_shipment_task_is_idempotent']
    commands = [[python, str(app / 'manage.py'), 'test',
                 *['order.test_sales_order.SalesOrderTest.' + n for n in names],
                 'stock.tests.StockTest.test_split_stock',
                 'stock.tests.StockTest.test_return_from_customer', 'inventree_probe',
                 'order.test_sales_order.SalesOrderAllocateStockConcurrencyTest', '--noinput', '-v2']]
results = []
for i, command in enumerate(commands):
    log = a.output / f'{a.product}-{i + 1}.log'
    print(f'Running synthetic {a.product} batch {i + 1}; log: {log}', flush=True)
    with log.open('w') as f:
        result = subprocess.run(command, env=env, stdout=f, stderr=subprocess.STDOUT, timeout=1200)
    results.append(dict(command=command, exit_code=result.returncode, log=log.name))
(a.output / f'{a.product}-commands.json').write_text(json.dumps(results, indent=2) + '\n')
print('Review skips, roles and backend limitations; exit 0 is not production acceptance.')
raise SystemExit(1 if any(x['exit_code'] for x in results) else 0)
