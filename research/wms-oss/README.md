# Manual isolated upstream prototypes

Research only. No application replacement, real data, external database configuration, marketplace credentials or production writes. The runner installs nothing and is not wired into CI. Python runtimes and upstream source live outside the Surooh checkout. SQLite supports bounded domain/API experiments, not native database concurrency acceptance. Existing CI remains separated from DB/live tests.

## Prepare a fresh sandbox

Use a fresh parent directory outside production/network integrations. Install `uv` by your approved environment procedure. Create two Python 3.12 virtual environments separately. Clone InvenTree at `be488919e4928cf16140b85d77058115a89cb4ef` (tag 1.6.1), never a floating master. Verify the exact commit and source before installing dependencies.

```sh
uv venv --python 3.12 /tmp/wms-tryton-env
uv pip install --python /tmp/wms-tryton-env/bin/python trytond==8.2.1 trytond_stock==8.2.1 trytond_company==8.2.0 trytond_sale==8.2.0 trytond_product_kit==8.2.0 proteus==8.2.0
uv venv --python 3.12 /tmp/wms-inventree-env
uv pip install --python /tmp/wms-inventree-env/bin/python -r /tmp/wms-inventree/src/backend/requirements.txt django-slowtests==1.1.1
```

The above pins direct dependencies; transitive resolutions can vary. Exact executed inventories are in `docs/wms/oss/evidence/*-installed.json`; use them as constraints for a repeat experiment. Package artifact signatures/hashes were not fully verified, so this is not a supply-chain lockfile or production build procedure.

## Execute native tests

From the Surooh repository root:

```sh
python research/wms-oss/run-prototypes.py tryton --python /tmp/wms-tryton-env/bin/python --output /tmp/wms-tryton-results
python research/wms-oss/run-prototypes.py inventree --python /tmp/wms-inventree-env/bin/python --source /tmp/wms-inventree --output /tmp/wms-inventree-results
```

The runner constructs an allowlisted process environment, uses Tryton `DB_NAME=:memory:` and creates a fresh InvenTree SQLite configuration with plugins disabled. It does not accept a database URL. Synthetic config and temporary directories are created under the OS temp directory. Upstream test runners build/destroy their test databases. Output must be reviewed for skipped tests: InvenTree's `has_select_for_update` concurrency test is expected to skip SQLite and must remain a blocker. No HTTP listener is opened; InvenTree API probes use its real in-process test client. The upstream suite may take several minutes.

Tests import upstream products; they do not reimplement their stock arithmetic. Our shared-component assignment probe explicitly supplies component quantities. The separate native product_kit probe and upstream sale scenario test native kit behavior. Its use of force assignment is not a Surooh-safe command path.

## PostgreSQL follow-up

Do not point this runner at a real PostgreSQL system. A separately reviewed disposable-database adapter must be prepared for G1/G2: isolated local PostgreSQL instance, newly generated fixture users/companies, no production secrets, independent database sessions, restricted users and audited teardown. Match the prototype scenarios in `docs/wms/oss/EXECUTION_PLAN.md`. Neither changing an environment URL nor treating SQLite skips as passes satisfies this gate.
