# PostgreSQL validation — final exact-source results

Tested source: **6066f6a3fbb8f6edd2b6cadb8304b311e2e046bb**, tree **b02c4792f55d9945b7c2906832ac13c4a58ee053**, based on cleanup evidence9c14f77a72ac2d36dd906909b481758b7cc7c3e7. The owner accepted source cleanup at3a7cfb73850ec89fd91822c5c0078ff985d25895 for preparation only. This packet implements/executes the legacy DB test adapter; no production adoption or Codex start.

**Outcome: adapter executed; validation NOT accepted.** Real PostgreSQL cases: **19 PASS /2 FAIL /21 executed**, no omitted planned DB cases. All23 original migrations passed unchanged, in order with per-file hashes. No production endpoint or data was used. The native DB adapter and outer runner exit1 honestly; it is not a startup-only failure or a green DB acceptance.

| Scope | Result / actual exit |
|---|---|
| Fresh isolated legacy migrations |23 applied, no skipped/edited historical SQL |
| Native DB acceptance groups |19 PASS,2 FAIL; adapter exit1 |
| Real limited identities |9 LOGIN roles; non-owner/NOSUPERUSER/NOBYPASSRLS, row_security=on; owner/service_role escalation denied |
| Native recovery |Terminated transaction rollback/retry; clean restart/reconnect; pg_dump/restore to a separate synthetic DB with23 matching relation fingerprints and restored RLS reads |
| Frozen dependencies / TypeScript / full ESLint / build |PASS exit0; no app dependency/settings change; lint retains15 disclosed warnings |
| Application unit tests |100 PASS =91 previous +9 source-quality regressions; not native DB tests |
| Existing phase/authority/alternative gate suites |19 /6 /14 PASS;6 new DB-adapter guard tests PASS |
| Generated tree/source after build and DB run |Clean before/after; same exact source commit/tree |
| Full verifier summary |14 PASS command slots,1FAIL (legacy DB adapter),19 BLOCKED future/environment/policy slots; outer exit1 |
| POSTGRESQL_VALIDATION gate |BLOCKED exit2: DB failures +host identity +real HTTP auth boundary |
| PREPARATION gate |BLOCKED exit2 for the same three required areas |
| P01 gate |BLOCKED exit2; additionally fresh engine bootstrap remains missing |
| SOURCE_QUALITY gate |READY_FOR_HUMAN_EVIDENCE_REVIEW exit0; earlier owner approval is limited and no phase start follows |
| Hosted GitHub Actions |BLOCKED; no rerun/billing/admin change |

## Every executed DB group

| ID | Actual result | Scope |
|---|---|---|
| D01 | PASS | all original migrations |
| D02 | PASS | real restricted login roles |
| D03 | PASS | company user select isolation |
| D04 | PASS | direct CRUD matrix |
| D05 | PASS | definer RPC and helper bypass denial |
| D06 | PASS | browser roles cannot read credentials |
| D07 | PASS | shared bundle concurrent shortage |
| D08 | PASS | whole bundle atomic rollback |
| D09 | PASS | cancel ship race and replay |
| D10 | PASS | terminated transaction rollback and retry |
| D11 | PASS | external idempotency required |
| D12 | PASS | execution time membership revocation |
| D13 | PASS | view and report isolation |
| D14 | PASS | temp schema shadow resistance |
| D15 | FAIL | direct SQL claim spoof boundary |
| D16 | PASS | restart durability reconnect |
| D17 | PASS | all public table read surfaces |
| D18 | FAIL | null channel external replay |
| D19 | PASS | separate ship and cancel lifecycles |
| D20 | PASS | real dump restore and RLS recheck |
| D21 | PASS | anonymous role denials |

D15: a restricted SQL session can overwrite the custom claim used by the compatibility auth.uid() and see foreign rows. This fails an arbitrary-SQL-client identity invariant; it does **not** prove a forged JWT works against real PostgREST, which was not run. D18: two independent connections with the same external_ref and NULL channel both commit and reserve twice. Both observations, backend PIDs, returned order IDs and stock snapshots are in the native JSON. FINDINGS.md gives reproductions, conditions and proposed fixes; no product/migration fix is silently applied. D11 non-null-channel uniqueness is one-effect constraint protection with23505, not a complete successful idempotent replay/result protocol.

Read checks traverse22 public base tables and available views. CRUD exercises representative allowed admin product/review-decision operations, denied cross-company writes/deletes and restricted RPCs. Direct BOM writes are denied by design; the authorized set_product_bom RPC is the positive path.45 SECURITY DEFINER routines are inventoried, not all45 behaviorally exercised. Do not extrapolate these cases to exhaustive per-table/per-role DML, HTTP APIs, workers or native ERP integration. The SQL roles use real PostgreSQL authentication and independent sessions; auth JWT parsing/accessors are a declared compatibility fixture.

## Isolation and recovery limits

PostgreSQL18.6/psycopg3.3.6/libpq180006 run locally with SCRAM, random synthetic login passwords, loopback-only TCP and a newly created private cluster. The executor only exposes UID0 and rejects nested UID mapping. An explicit child-only libc UID/stat shim allowed engine execution; source/binary hashes are recorded. It does not establish real non-root OS/service/mount isolation. **Host isolation remains NOT PROVEN**, requiring a proper separate-identity replay. No global preload, host user setting or production rule was changed.

All test servers stopped, the private cluster/password files/dump were removed, and the owned port15432 was released. Dump data is not exported; only fingerprints/logs are retained. Restore was into another DB on the same isolated cluster; off-host recovery, keys/SLA, power-loss/failover and sized load remain unexecuted. Real PostgREST signed/expired/revoked JWTs and mixed-tenant pool reset, actual queue/worker integration, distinct service/OS boundaries, fresh full ERPNext bootstrap, native stock/valuation integration and Dutch accountant review remain held.

## Failure history and reproducibility

Initial exact run on **cf4863623a5c3e42fb850b0b5942bc17e58ba72f** failed before any native DB case: the new runner resolved the supplied venv Python symlink to the system executable, losing psycopg. Its full report/log/archive is retained. A separate one-line fix preserves the virtual-environment path. The full suite was rerun on6066f6a3fbb8f6edd2b6cadb8304b311e2e046bb and all21 native cases executed. No initial zero-case result is relabelled a DB run.

The development-history archive is explicitly UNCLEAN_DEVELOPMENT_ONLY. It preserves Unix socket startup denial, mock/fixture errors and exploratory observations. An early assumption that own-admin direct BOM DML should pass was corrected in the harness after reading the existing migration's intentional policy removal; no policy or grant was changed to pass the test.

Full exact-source reports include UTC timestamps, command argv/cwd/exit/durations, environment/tool/runtime/source/migration versions and hashes, redacted logs, source cleanliness and gate invocations. Private runtime HOME, real credentials, cluster configs and DB dumps are excluded. INDEX.json contains archive and sidecar SHA256. Verify hash, extract to a new directory with tarfile filter="data", verify evidence-manifest.json, and use verification/gate.py from the recorded source. Gate capture source is explicitly recorded; source/plan/gate code did not change between the final run and evidence publication. Evidence-only commits are not advertised as the executed code SHA.

| Archive | SHA256 |
|---|---|
| exact-run-01.tar.gz | 50e1e818735f12b642eb7be5c76240b6b25302c6b39d4917472f419cbb55f303 |
| exact-run-02.tar.gz | fc84df2c5744dc01588869b63b2ea45c2dc40b8432a3b393c8e78fc9995ee6bd |
| development-history.tar.gz | fb783d377c929c768caa17ade479349891afbe93d3ca6f926be198e886fb8f07 |

## Acceptance disposition and next decisions

This completes the authorized safe execution/evidence packet with failures and constraints exposed. It does not satisfy full PREPARATION/P01 acceptance. Review DB-F01's nullable-channel duplicate fix at the approved single-writer command boundary, DB-F02's real HTTP/JWT/direct-SQL trust model, and a proper non-root runtime replay before a subsequent implementation packet. These are proposed next scopes only, not authorization to implement them now. Keep all Codex phases held; no main/PR17/PR18 merge or deployment.

ERPNext remains the sole future quantity/reservation/valuation/COGS/GL authority. Original WMS app modules, all migration files, dependencies/compiler/lint policy and current production authority are unchanged by this packet. Rollback is discarding/reverting this independent proposal branch and deleting only its synthetic local files; no production change requires reversal.
