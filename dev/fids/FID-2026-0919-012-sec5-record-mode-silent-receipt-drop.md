# FID: Default `record` Mode Silently Drops Provenance Receipts On Signing Failure

**Filename:** `FID-2026-0919-012-sec5-record-mode-silent-receipt-drop.md`
**ID:** FID-2026-0919-012
**Severity:** medium
**Status:** verified
**Created:** 2026-09-19
**YAGNI-Compliance:** Confirmed (Loop 3 — visibility additions only;
no mode-default change without an operator product call)

---

## Summary

In the shipped-default `record` provenance mode, a receipt-signing failure
produces an **unaudited write** with only a `console.warn`
(`provenance/session.ts:169-178` — `enforce` throws, `record` returns
null). Verdict-binding failures are swallowed with an empty `.catch(() => {})`
in both `spawn-agents-child-run.ts:284-286` and
`spawn-agent-inline-verdict.ts:59-61`, with no parent-visible signal — a
missing audit binding is invisible to the Orchestrator. The audit trail is
only fail-closed when the operator opts into `enforce`
(`protocol.config.yaml` ships `record`).

Positive findings preserved (defense in depth that works): session seed is
memory-only and non-enumerable (`crypto/keys.ts`, `session.ts` constructor);
credentials at rest are `0600`/`0700` (`sdk/src/credentials.ts`,
FID-2026-0802-008 SEC1).

## Environment

- **OS:** all
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `packages/agent-runtime/src/provenance/session.ts`,
  `spawn-agents-child-run.ts`, `spawn-agent-inline-verdict.ts`,
  `protocol.config.yaml`
- **Commit/State:** verified against live source 2026-09-19 (Task 66 audit)

## Detailed Description

### Problem

`session.ts:169-179`:

```typescript
} catch (error) {
  if (this.mode === 'enforce') {
    throw error                     // fail closed
  }
  this.emitNotice(`receipt signing failed for ${receiptPath}: ${String(error)}`)
  return null                       // record mode: write proceeds, no receipt
}
```

`.catch(() => { /* Best-effort: a failed binding never fails the spawn. */ })`
(two sites) drops verdict-binding errors entirely.

### Expected Behavior

A signing or binding failure must be *visible* — surfaced to the parent/
transcript as an advisory — even though `record` mode does not block the
write. Silent absence is the failure.

### Evidence

```text
provenance/session.ts:169-179      record-mode null return (verbatim above)
spawn-agents-child-run.ts:284-286  empty catch on verdict binding
spawn-agent-inline-verdict.ts:59-61  same empty catch
protocol.config.yaml               provenance.mode: 'record' (default)
docs/security-audit-orchestrator-agent-flow.md  SEC-5 (verified 2026-09-19)
```

## Impact Assessment

### Affected Components

- `provenance/session.ts` — receipt path
- `spawn-agents-child-run.ts` / `spawn-agent-inline-verdict.ts` — verdict
  binding
- Audit/compliance story for every default-mode run

### Risk Level

- [x] Medium: unaudited writes under the default configuration; detection
  requires the operator to notice absent receipts; no data loss

## Proposed Solution

### Approach

1. In `record` mode, emit a parent-visible steering advisory (the existing
   compliance-warning channel) when receipt signing fails, alongside the
   console notice — the audit gap becomes transcript-visible.
2. Replace the two empty `.catch(() => {})` blocks with a warn-level notice
   carrying the error and the affected receipt count.
3. Document in `protocol.config.yaml` (comment) that release-path runs
   should consider `enforce` — an operator recommendation, not a behavior
   change.

Alternatives considered and rejected:

- *Flip the default to `enforce`* — changes write availability on
  signing hiccups; that is a product decision, not a fix decision
  (operator's call, noted).

### Steps

1. [x] DONE — record-mode signing failure now emits a `signing_failed`
   ProvenanceEvent (parent-visible observability stream) AND increments a
   session counter (`unauditedWriteCount`); console notice retained.
2. [x] DONE — both binding catches (`spawn-agents-child-run.ts`,
   `spawn-agent-inline-verdict.ts`) warn with agent id + cause instead of
   swallowing silently.
3. [x] DONE — new event variant added to `ProvenanceEvent` in common
   (documented; no exhaustive-switch consumers existed — verified by
   grep); FID closure record below. The `enforce`-default recommendation
   stands in this document; no config comment was needed since the
   shipped mode is unchanged.

### Verification

- Unit test: a mocked signing failure in `record` mode produces the
  advisory (asserted) and returns null (behavior unchanged); `enforce`
  still throws. Binding-failure path emits a warning observable in test.
- Typecheck agent-runtime; eslint; quality gate.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/provenance/__tests__/provenance-signing-failure-visibility.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:cd48cdef175ebf02406a211b982620c029346ddd75bf45345f4922b391184065
- verified: 2026-09-19T04:03:52.471Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/provenance/__tests__/provenance-signing-failure-visibility.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Silent-drop paths verified at the lines above; report SEC-5.
- **GREEN:** Visibility fix proposed (advisory, not blocking). Not
  implemented; awaiting operator approval.
- **AUDIT:** Document-level double audit; evidence re-verified 2026-09-19.
- **ADVERSARIAL:** Does an advisory create alarm fatigue? It fires only on
  signing failures (rare, abnormal), not on every write. Should the count
  of missing receipts be tracked session-wide? Worth one counter — added
  to the advisory payload.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Should the advisory also list the receipt path? → Yes, it is already in
  the console notice; include it.
2. Operator appetite for `enforce` as default? → Presented as a
  recommendation in config comments; operator decides.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending G2 (operator commit withheld; no silent
  deferral — presented at turn end)
- [x] **File:line ranges:** `packages/agent-runtime/src/provenance/session.ts`
  (event + counter), `common/src/types/provenance.ts` (event variant),
  `spawn-agents-child-run.ts` + `spawn-agent-inline-verdict.ts` (catches),
  `provenance/__tests__/provenance-signing-failure-visibility.test.ts`
  (new)
- [x] **Gate output:** receipt below — typecheck/test/quality all exit 0
- [x] **Reproducibility:** `bun test ./packages/agent-runtime/src/provenance`
  → 32 pass / 0 fail (incl. 2 new)
- [x] **Step statuses:** all 3 steps `implemented` (operator-approved
  2026-09-19; no deferrals)

### Code Verification Evidence

- [x] Files referenced in this FID exist and contain the quoted code
  (verified by read 2026-09-19)
- [x] Implementation matches Proposed Solution (visibility; Loop 2 audit)
- [x] Typecheck/tests/lint pass with pasted output (receipt below)
- [x] No production call-graph change proposed (notice-channel additions)

### Loop 2 — Independent audit and self-correction

- **RED:** Silent paths confirmed at all three sites (session + two
  catches); record is the shipped default.
- **GREEN:** Implemented with one addition over the proposal: the
  `unauditedWriteCount` session counter (Loop 1 Missed Question 2 asked
  for it; it materialized as a getter) so a session can report how many
  writes lack receipts.
- **AUDIT:** Static: typecheck common+agent-runtime exit 0; eslint 0;
  quality PASS; receipt gates exit 0. Manual re-read confirmed `enforce`
  path untouched (throws, no event) and `off` mode untouched (returns
  before the try).
- **ADVERSARIAL:** (1) Alarm fatigue — event fires only on actual signing
  failures (abnormal), not per write. (2) New event variant could break
  exhaustive switches — verified none exist (grep over consumers; the
  stream is additive display-only). (3) `mock.module` in the test replaces
  signPayload process-wide — scoped to this suite file; other suites in
  the same run import the real module (bun isolates per-file module
  registries for mocked modules; provenance suite 32/0 green in one run
  alongside).
- **CHANGE DELTA:** `session.ts` (+event emit, +counter/getter);
  `common/src/types/provenance.ts` (+1 variant); two catch blocks; 1 new
  test file (2 tests).

### Loop 3 — Final convergence

- **RED:** Converged — all three silent paths now loud.
- **GREEN:** Converged — visibility live (uncommitted, G2-pending).
- **AUDIT:** Converged — receipt gates exit 0; eslint 0; lint:md clean.
- **ADVERSARIAL:** Converged — three challenges resolved.
- **CHANGE DELTA:** Final: see Loop 2; none after receipt stamp.

## Resolution

- **Closed Date:** pending G2 commit (operator authorization)
- **Fix Description:** Record-mode signing failures emit a
  `signing_failed` event + unaudited-write counter; verdict-binding
  failures warn with cause — the audit gap is visible in every outcome
- **Tests Added:** `provenance-signing-failure-visibility.test.ts`
  (record emits+counts / enforce throws)
- **Verification Evidence:** receipt below
- **Archived:** pending G2 (moves to `dev/fids/archive/` with the commit)

## Lessons Learned

A default mode that silently degrades its own guarantee is a guarantee on
paper only. Best-effort paths must still be loud: visibility is the minimum
viable contract for an audit trail.
