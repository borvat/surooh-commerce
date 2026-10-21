# Additional native security probes

Executed against Tryton 8.2 on SQLite, not PostgreSQL. From repository root with a separate installed Tryton environment:

```sh
DB_NAME=:memory: PYTHONPATH="$PWD/research/wms-oss/closure" /path/to/tryton-env/bin/python -m unittest tryton_security_probe -v
```

Uses native WSGI JSON-RPC, actual users/groups/company rules, real reports and exports; native queue push/run with a spy calling the original export method. Test data and passwords are synthetic only. One test deliberately expects the default trusted-worker context to expose the foreign synthetic row; that test passing documents an unsafe policy for delegated jobs. Do not count it as successful company isolation. No queue daemon or independent DB sessions are exercised. PostgreSQL execution requires a separate reviewed disposable target runner; never set an arbitrary production DB_NAME/URI because upstream tests can drop/rebuild databases.

The initial queue fixture treated push's returned integer as an object; corrected code uses Queue(id). Failed attempt logs remain attached. No upstream application source is copied here.
