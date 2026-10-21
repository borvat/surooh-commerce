# Acceptance catalog

All fixtures are fictional. Use actual domain code plus a disposable database; do not demonstrate acceptance with an alternate in-memory stock implementation. Each test verifies balance=sum(ledger), reserved=active allocations, no negative quantity, tenant coherence and exactly one business effect per operation key. General success requires all commands at the tested SHA and no unresolved inventory/security P0/P1 defect.

| ID / phase check              | Arrange and act                                                             | Assert                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A01 / pick-pack-dispatch      | Receive10 X; reserve3; print; pick; pack; verify fixture label; handoff     | Print leaves P10/R3; dispatch leaves P7/R0; one dispatch transaction                          |
| A02 / shared-bom              | GAS100/STOVE20; A=4gas+stove; B=10gas; reserve2A then9B                     | GAS R98/STOVE R2; extra A rejected atomically; offer stocks not summed                        |
| A03 / concurrent-reservations | X1; independent sessions and start barrier; channel1/channel2 reserve1      | One accepted, one shortage; R1; run both orderings and a contention sample                    |
| A04 / cancel-replay           | Receive10; reserve3; cancel; replay cancel                                  | P10/R0; one release effect; same stable response                                              |
| A05 / return-inspection       | Receive10; ship2; return1 to quarantine; repeat inspect-restock key         | Available8 before inspection,9 after; no duplicate restock; reject return over shipped        |
| A06 / transfer-transit        | W1 X10; dispatch4 to W2; receive4 twice same key                            | After dispatch W1=6,W2=0,transit4; after receipt W1=6,W2=4,transit0; total10                  |
| A07 / shortage-atomicity      | X5; reserve6 plus another component line                                    | No order/reservation/ledger/outbox partial effect; explicit shortage; rejection audit allowed |
| A08 / tenant-isolation        | A session reads/mutates B, then dual member mixes A item+B warehouse        | API403/empty reads and DB RLS/RPC rejection; zero foreign outbox/events/PII                   |
| A09 / inbox-replay            | Two concurrent same receipt/order events then changed payload same event ID | One inventory effect, stable replay; changed hash conflicts; old version cannot regress order |

## P01 database foundation

baseline-reconciliation: current Git refs and Lovable revision metadata are pinned; compare/sample provenance recorded; preserve unknown Replit patch before migration work.

schema-rebuild: apply every migration in order on a blank disposable Supabase-compatible database, with auth roles/functions appropriate to Supabase; record any bootstrap stubs explicitly. No claim of provider parity from an incomplete auth stub.

sql-acceptance: execute the existing rollback acceptance function only in disposable fixtures, verify stock/ledger consistency and no fixture residue; use independent-role SQL sessions for RLS/EXECUTE tests.

database-isolation: test URL guard rejects production hosts, both known Lovable references, remote/encoded/malformed addresses and missing isolation flag before any connection. Test fixture cleanup cannot target an unrelated database.

## Required phase extensions

- P02 cross-owner-fk / role-revocation: enforce all child references and revoked membership immediately across RPCs/views, including dual-member and cache keys.
- P03 bom-snapshot / site-availability: BOM edit after reservation leaves old allocation unchanged; two aliases to same component aggregate; X at W1 and Y at W2 does not promise a one-site XY bundle; safety applied consistently; FBB no internal effect; reject negative/unknown/overflow inputs.
- P04 receipt-inspection-putaway / count-concurrency / damage-control: partial acceptance, duplicate delivery, wrong-location scan; simultaneous stock count+movement; no silent overwrite; segregated damaged goods unavailable.
- P05 partial-dispatch / cancel-dispatch-race / print-no-dispatch / label-scope: one serialized outcome, remaining quantity correct, label account/shipper match, reprint no purchase or dispatch, client-provided handoff claim rejected.
- P06 return-overage / partial-transfer: lost/damaged transit quantities remain accountable; no cross-company internal transfer or over-return.
- P07 outbox-recovery / pagination-account-scope / accounting-export-dedupe / sam-delegation: crash before/after commit, provider ambiguous outcome readback, all pages/watermarks, separate accounts, stable export ACK, missing cost pending, SAM expired/mismatched delegation denied.
- P08 component-quota-budget / sync-lag-pause / reconciliation-drift / reorder-evidence: quotas constrained by every shared component across all EANs; pause/reallocation on lag; deliberate drift detected; demand/lead-time evidence without creating a purchase.
- P09 all-core-acceptance / load-recovery / migration-rehearsal / read-only-live-review / rollback-rehearsal: one fixed commit, retained logs, acceptance coverage and failure injection, migration opening balances exactly once, recovery without erasing later legitimate movements; live read review remains blocked until explicitly authorized and implemented.
