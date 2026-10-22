# Atomic Pick Handoff & Real UI Integration — partial acceptance remains blocked

Paired Draft PRs: [WMS22](https://github.com/borvat/surooh-commerce/pull/22) / [Accounting31](https://github.com/borvat/surooh-accounting/pull/31), based on reviewed PR21/PR30 without merging them. **Tested clean source pair:** WMS `920e3a12a0136ad51975c5a55dc5871645d5d7e3` / Accounting `97c22b594fa37e2fe1e12458cf1a0f7edeec5432`. Later publication commits contain documentation/evidence only and are not advertised as rerun application code.

**NI-F01 has a successful bounded candidate remediation. The complete real UI integration is not accepted. PREPARATION/P01/M1 remain BLOCKED.** No Codex/stage start, main merge, deployment, financial/tax operation, live data, provider write, billing change, paid service or Actions rerun occurred.

## Final executed results

| Evidence | Actual result | Exit / limit |
|---|---|---|
| Fresh unpatched ERPNext/Frappe16.52.0, two new sites/databases | 29 PASS,0 FAIL,1 BLOCKED | Outer2 because real browser is BLOCKED; installer/native case command0 |
| Previously successful19 native scenarios | All retained PASS | Includes native receipt/SO/SRE/ship/return/value/GL, JWT/role/revocation, real RQ, in-flight permission lock, DB/site/files, lost-response/restart and raw API/RPC denial |
| Former N05 pick/pack gap | Native manual Pick List + native reservation handoff PASS | One transaction; physical quantity/value unchanged; native complete SRE links preserved |
| A01–A09 additional native scenarios | 9 PASS | True concurrent HTTP/DB sessions, different authorized actors, packed cancellation, SIGKILL rollback, actual screen services |
| WMS independent full run | 17 checks PASS,0 FAIL,19 requirements BLOCKED | Outer2, preserved broad production/fiscal/operations/deployed gates |
| WMS units | 109 PASS,0 FAIL | Original100 plus existing6 native guards plus3 new UI command guards; not browser/engine proof |
| TypeScript / lint / build / generated cleanliness | All exit0; clean source before/after | Lint15 pre-existing warnings:14 Fast Refresh +1 Hooks; no rule suppression or settings reduction |
| Legacy PostgreSQL18.6 | All21 migration/RLS/concurrency groups PASS |23 historical migrations unchanged; isolated fixture adapter only |
| Trusted HTTP identity regression |18 PASS | Independent real HTTP/JWT fixture; not production identity approval |
| Accounting independent full run at exact paired SHA |13 checks PASS,0 FAIL,17 requirements BLOCKED | Native seeded mitigation8 and scoped isolation11 cases rerun; separate from fresh29 native cases |
| Evidence gate regressions |7 PASS | Reject stale pair, tampering, missing case, dirty source and absent/failed owned-service shutdown; no self approval |
| New native Python / sandbox guard Ruff and format | exit0 | Main Accounting hooks unchanged/inert |
| Rendered current React browser cycle B01 | BLOCKED, exit2 | No runnable browser; **cycle not executed** |
| Distinct non-root OS/service/storage/file/key identities | BLOCKED | Actual UID0-only mapping; non-root namespace attempt exit1; no UID shim treated as acceptance |

Full exact logs, commands, environment, exits, sources and SHA256: [archive index](evidence/INDEX.json). Human-readable case details: [native results](NATIVE_RESULTS.json), [bootstrap](BOOTSTRAP_RESULTS.json), [WMS full run](WMS_REGRESSION_RESULTS.json), [Accounting full run](ACCOUNTING_REGRESSION_RESULTS.json), [atomic gate](ATOMIC_GATE.json). Every archive has an internal per-file MANIFEST and an external archive digest. Unpack only into a new empty directory with Python `tarfile` `filter="data"`, verify hashes, then replay gates at the report's **tested commit**, not the later evidence head.

## What NI-F01 now proves

Native Sales Order and sorted Bin locks serialize the transaction with competing authorized stock commands. The native SO SRE is cancelled, the native manual Pick List is inserted/submitted and native Pick List SREs recreated inside one transaction; exact reservation completeness is checked before success. No core code or stock/financial tables are patched directly. Native pick/pack/ship/return documents are the only quantity/value/COGS/GL writer.

A01 proves replay and fresh-key pick discovery create one native pick and one active SRE per component without changing physical stock/value. A02 runs two simultaneous pick requests with distinct authorized actors. A03 races pick/cancel; A04 races packed shipment/cancel with one valid terminal result and replay/linked return when shipped. A05 SIGKILLs only a separate child after actual unreserve and before native mapper creation: rollback restores original SO reservations, and a new process retries successfully once. A06 reserves every available shared C2 component and races handoff against another bundle order: the competitor is denied, with no temporary availability or oversell. A08 explicitly tests packed cancellation and pack replay.

The final clean native run logs **4 actual deadlock retries**. The candidate retries only DB-declared QueryDeadlockError, after a full native rollback and fresh JWT/DB authorization, at most3 attempts with the same command identity. Exhaustion/other errors remain errors. An earlier unclean development run exposed this real deadlock and dependent assertion failures; they are preserved rather than relabelled. This is finite correctness evidence, not stress/load/deadlock-free production proof.

Valuation baseline:10 C1@EUR10 +10 C2@EUR20 =EUR300; reservation/pick/pack keep300; shipping one1C1+2C2 kit gives native value250 and balanced native COGS50; native linked return restores300 and balanced50 reversal. A09 uses the **same service functions/action helper used by existing screens**, sends real HTTP receipt/bundle/order/pick/pack/ship/return commands, proves A→B→A bundle edits persist, replays receipt/return once, checks native COGS50/balanced GL, and ends at320 after the additional EUR20 receipt. These are actual native results, not mocked API contracts.

## What the current UI work does and does not prove

Existing React `/components`, `/bundles`, `/orders`, `/movements` routes now consume verified native projections and use the tested command services in explicit synthetic native mode. They contain receive cost/identity, native bundle edits, order identity and pick/pack/ship/cancel/linked-return actions; native history renders SLE quantity/value. Typecheck/build/lint pass; actual projection and mutation services run over HTTP (A07/A09).

**No rendered browser cycle or visual/interactive acceptance has run.** Two bounded official Chromium download attempts exited1 with an invalid/truncated archive and lock failure; no system/cached executable is usable. B01 is a real-browser-only fail-closed harness and exited2/BLOCKED. No jsdom, static render, contract test or headless service run replaces it. Browser route/auth bootstrap, interactions, selectors, proxy, cache refresh and production UI identity remain unproven and need actual browser debugging/replay. The browser script itself is unexecuted beyond its capability refusal.

Native mode is opt-in, loopback and memory-only, not production auth/cutover. Other legacy modules/DB credentials are not revoked. Metadata-only Surooh scaffold hooks remain inert; the separate guard exists only on marked synthetic sites. Raw Stock Manager insert bypasses for Stock Entry/Pick List/Packing Slip are denied; this is not a whole endpoint/extension/child-document audit. Administrator-scoped internals require production least privilege review. Existing bol write disables are unchanged; no bol/provider connection is used.

The commercial/native mapping is deliberately bounded: one complete integer-component bundle pick/pack/shipment, one fixed warehouse, no serial/batch/nested bundle, partial shipment, landed/backdated cost, quarantine/inspection, taxes/invoices, commercial parent price/discount or FBB mapping acceptance. Synthetic Material Receipt is not a supplier invoice/AP/VAT workflow. Timestamp normalization, new-SKU Bin contention, full device/permission matrix, pool/service lifecycle and load/restore/upgrade acceptance remain future requirements.

## Gates and readiness

| Gate | Current disposition |
|---|---|
| G0 | `HOSTED_CI_BLOCKED — ALTERNATIVE_VERIFICATION_REQUIRED`; exact alternative checks executed and reviewable; hosted failure preserved; no phase approval |
| G1 | BLOCKED: separate non-root service/storage/files/keys/backups not proven; separate fresh sites/DB users/JWT/encryption alone do not close it |
| G2 | PARTIAL/BLOCKED: scoped native HTTP/RQ/role/replay/bypass proven; complete deployed cross-system/service privileges/cutover not accepted |
| G3 | PARTIAL/BLOCKED: native atomic pick/pack and service cycle pass; full rendered UI/browser and complete stock scenarios unproven |
| G4 | BLOCKED: qualified Dutch accountant, fiscal policy/goldens/native enforcement and commercial invoice/tax acceptance outstanding |
| G5 | PARTIAL/BLOCKED: source/build/PG/native checks pass; full asset/runtime/upgrade/off-host recovery/load matrix outstanding |
| G6 | BLOCKED: effective main protection and human/owner stage-start acceptance outstanding; no admin settings changed |

`SOURCE_QUALITY` and `TRUSTED_BOUNDARY` gates exit0/READY_FOR_HUMAN_EVIDENCE_REVIEW. The atomic native subgate is READY_FOR_HUMAN_EVIDENCE_REVIEW, while rendered UI/operational isolation/PREPARATION/P01 remain BLOCKED and the overall atomic gate exits2. The older Accounting PREPARATION technical scope is also review-ready; Accounting M1 and this paired integration's overall preparation stay BLOCKED. These are distinct scoped results, not conflicting phase approvals. See [machine-readable gate status](GATE_STATUS.json), [PREPARATION](GATE_PREPARATION.json) and [P01](GATE_P01.json).

## Preserved failures and cleanup

The development/history archive retains incomplete automatic pick mapping, a native mapper target-type failure, a projection serialization failure, real lock deadlock and dependent failures, plus mutable/unclean development runs. They are not exact clean acceptance evidence. First clean source WMS0eb2bb0/Accounting97c22b5 produced29 PASS/1 browser BLOCKED, but the first atomic evidence validator wrongly required immediate exits for owned services. It failed closed. A separate gate-only fix added strict shutdown-log matching and two tests, then the complete WMS/fresh-native run was repeated at920e3a1. Original results/gate output remain in the prior-exact archive, unmodified.

Both final source trees were clean and matched their recorded before/after SHAs during execution. Runtime upstream archives/all original source files were byte checked. Driver cleanup flags are accompanied by an external owned-root removal/port check: no remaining owned fresh-native roots and ports14306/17379/18080/18081/15432/13306/16379 unbound. [Cleanup evidence](CLEANUP.json). Runtime/site configs, DBs/dumps, JWTs/passwords and private-runtime-home are excluded; archive scan found no JWT values. Cleanup is not an OS-isolation proof.

Rollback discards/reverts only these candidate branches and removes the owned synthetic environment. Existing production/accounting/WMS data were never changed. Next steps are separately reviewed bounded browser and operational isolation packets; [future review packet](NEXT_REVIEW_PACKET.md) authorizes nothing automatically.
