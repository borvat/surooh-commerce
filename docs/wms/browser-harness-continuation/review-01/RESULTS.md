# Bounded review corrections — B01 remains NOT RUN

Exact tested source: `1b163dd88e4558bdccdc439cedcf18c6c2742da6`.
Tree: `83df73e2143671b8f7d984854f4f0f963ac96c7e`. Source was clean before and after.
This continues Draft PR23 from evidence head `618854c1b703448c4bdf12316ed15ebca6e6b338`.
Original WMS PR22 and Accounting PR31 remain unchanged.

## Corrections and reproduction

The deterministic test reproduces the old readiness loop consuming60 HTTP503
attempts without any delay. Readiness now uses a30-second elapsed-time deadline,
backs off500ms after non-ready HTTP responses and connection failures, and caps
probe/backoff durations to the remaining budget. A late success cannot pass. Tests
cover503, connection failure, eventual readiness, immediate readiness, timeout and
owned-server exit.

A separate synthetic DOM test reproduces the old generic latest-error assertion
accepting an existing toast. Error scenarios now wait for old errors to disappear,
mark all existing toast nodes, correlate the failure with endpoint/operation/order/
deterministic command ID, and require a new visible error node with exact expected
text (including the actual rejected HTTP status for stale-order errors). An old
node that reappears with identical text is rejected. Wrong-text and invisible errors
are rejected. Stock/ledger assertions remain separate and unchanged.

## Exact-source results

| Check | Result |
| --- | --- |
| New deterministic readiness/feedback helper unit tests |14 PASS |
| Existing browser-runner unit tests |8 PASS |
| Atomic evidence-gate unit tests |7 PASS |
| General evidence-gate unit tests |14 PASS |
| JS syntax/format, Python syntax, CLI, whitespace |PASS |
| Real browser B01/native/app/PG/HTTP acceptance |NOT RUN/BLOCKED |

Total43 unit tests pass; these use fake clocks/DOM records and child fixtures only,
not native or rendered-browser evidence. [Report](report.json) retains actual
commands, exits and SHA256 log hashes. No browser launch/navigation, denied-route
retry, browser download, production or credential operation was performed during
this follow-up. The prior `data:` navigation policy failure remains preserved in
[parent results](../RESULTS.md) and is not relabelled or rerun.

The missing marked ERPNext runtime/Bun/WMS dependencies and unverified permitted
loopback browser navigation still block B01. PREPARATION/P01/M1 remain BLOCKED.
ERPNext remains sole writer of stock/reservations/valuation/ledger. No security,
identity, permissions, deployment or merge changes. Rollback reverts only this
bounded continuation; all original PRs and historical evidence are preserved.

This evidence directory is added after the tested source; the publication head is
an evidence-only descendant, not a separate test-code revision. No hosted workflow
success is claimed and no Actions rerun was requested.
