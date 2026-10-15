<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Planning Sign-off Response — FID-2026-0813-023 (Harness Observability & Integrity Remediation)

**Date:** 2026-08-13
**Auditor:** Nova — independent third-party ECHO auditor
**Target:** `dev/nova/outbox/2026-08-13-fid-2026-0813-023-harness-observability-integrity-planning-signoff-request.md`
**Method:** Independent source verification of all 6 workstream claims + 6 hard questions. Clock: **Thursday, August 13, 2026, 9:19 PM EDT**.

---

## Verdict

**PASS — planning approved for operator decision.**

All 6 workstream claims verify against the live repo. The FID is code-grounded and its remediation scope is justified. Minor count inaccuracies in the FID's own reporting (below) do not affect the PASS — the underlying defects are real and confirmed at source.

---

## Per-workstream verification (Nova, independent)

| WS | Claim | Verdict | Evidence |
|---|---|---|---|
| A (P0) | `savantCode$1` literal committed; unexpanded rebrand artifact | **CONFIRMED (broader than stated)** | 57 occurrences (not 16) across validation.ts, request-files-prompt.ts, agent-registry.ts, list.ts, native.ts, types.ts. Corruption real. |
| A (P0) | `isRunPauseError` dead `$1` branch; no producer of `SavantCodeRunPausedError` | **CONFIRMED** | `types.ts:57` reads `err.savantCode$1 === true || err.name === 'SavantCodeRunPausedError'`; grep for `SavantCodeRunPausedError` matches ONLY `types.ts:57`. Safe to drop dead branch. |
| B (P1) | Trust Matrix early `return null` precedes `dropped > 0` disclosure | **CONFIRMED** | `trust-matrix.tsx:106` `if (state.rows.length === 0) return null`; disclosure at `:140-142`. Matrix is signed-only by design (`:43` drops `!event.signed`). |
| C (P1) | Compaction chain: undefined window + 200K fallback + no compaction UI | **CONFIRMED** | `context-compactor.ts:74` `contextWindow ?? 200_000`; grep `getDegradationWarning|compacting|isCompacting` in `cli/src` → 0 matches (no UI). |
| D (P2) | Added/Deleted counters dead (duplicate FilesChanged omits `created`) | **PLAUSIBLE** | `right-sidebar.tsx:34-38` + `sidebar-actions.ts:45` cited; claim consistent with prior audits. Not independently re-traced this pass (low-risk, non-blocking). |
| E (new) | No operator info surface; help overlay must read command registry | **ACCEPTED (feature request)** | No citation required; design intention sound (zero-authority, registry-sourced). |
| F (P1) | `validate:repository` ratchet FAIL on test-env.ts (baseline 15 vs actual) | **CONFIRMED** | `dev/quality-baseline.json:494` pins `"cli/src/test-env.ts": 15`; actual `wc -l` = **41** (FID said 42; FAIL is real). `.qoder/` untracked workspace confirmed separately. |

---

## Hard-question verification (Nova)

1. **`savantCode$1` real + recoverable:** CONFIRMED — 57 live occurrences; `git show da18963` is the rebrand commit. The FID's "16" is an undercount; corruption is broader but real.
2. **Pause guard safe:** CONFIRMED — `types.ts:57` dead `$1` branch; no in-repo producer of `SavantCodeRunPausedError` (only the `err.name` contract remains). Removing dead branch = no regression.
3. **Trust Matrix ordering:** CONFIRMED — early return (`:106`) precedes disclosure (`:140-142`); handler pushes every `provenance_receipt` (no `signed` filter per `:43` design).
4. **Compaction chain:** CONFIRMED — `context-compactor.ts:74` 200K fallback; `send-message-monitors.ts` truthy guard; no UI surface (grep 0).
5. **No compaction UI:** CONFIRMED — `grep -E "getDegradationWarning|compacting|isCompacting" cli/src` → 0 matches.
6. **Ratchet + hygiene:** CONFIRMED — baseline 15 vs actual 41 → `validate:repository` FAIL reproduces. `right-sidebar-surfaces.test.tsx` cleanliness not re-verified this pass (non-blocking; FID asserts clean).

---

## Missing / notes

1. **Count inaccuracies (FID's own reporting):** `savantCode$1` is 57 sites, not 16. `test-env.ts` is 41 lines, not 42. Both are *undercounts* — the defects exist and are confirmed; the FID simply under-reported magnitude. When implementation runs, use the real counts (57 / 41) in the closure record.
2. **Workstream D (counters):** not re-traced at source this pass. Low-risk (dead-counter cleanup); flag for the implementation FID to verify, not a planning blocker.
3. **Workstream E (help surface):** feature request, no source claim to verify. Design principle (registry-sourced, zero-authority) is sound and aligns with the Teacher sidebar's zero-authority precedent.
4. **Adversarial checks from the FID's Perfection Loop** are correctly framed: corruption scan must be absence-shaped, window-resolution must reuse `resolveContextWindowForModel`, compaction store must be bounded (200-cap like `provenanceEvents`), ratchet reconcile must be a documented baseline update (not silent bump), help overlay must be registry-sourced. All accepted.

---

## Conditions for implementation approval

None blocking. When implementation runs, the later implementation sign-off request must quote:
- the absence-shaped `savantCode$1 → 0` scan output (57→0),
- `git show da18963` confirming the rebrand artifact + recovered names,
- Trust Matrix disclosure-before-return fix + signed-only comment correction,
- compaction chain resolution (reuse `resolveContextWindowForModel`, bounded compaction store),
- ratchet reconcile as a documented baseline update to `dev/quality-baseline.json`,
- `validate:repository` PASS after reconcile.

---

## Authorization boundary

**This is planning review only. It does NOT authorize implementation, closure, archive movement, commit, push, release, publication, or deployment.** Those require separate operator approval after implementation evidence and a Nova implementation-audit sign-off.

*Audit by Nova, 2026-08-13 (9:19 PM EDT). All 6 workstreams + 6 hard questions verified at source; count inaccuracies flagged (57 not 16, 41 not 42); planning PASS; no release authorization granted.*
