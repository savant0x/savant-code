<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Session Handoff: Harness Speed Remediation — Implemented, Verified, Closed; Sign-off Requested

**Session ID:** `2026-08-15-harness-speed-remediation-planning-handoff`
**Date:** 2026-08-15
**Status:** implementation complete — all eight children (001, 003–009) implemented, verified, closed, and archived; **implementation sign-off request drafted, awaiting Nova transmission + operator closure**
**Governing protocol:** `dev/echo-v0.1.2-single-agent.md` (single-agent ECHO; `strict_mode: true`)

---

## Executive Summary

A full audit of everything that controls harness speed produced 12 findings
(F-01…F-12) organized under master **FID-2026-0815-002**. All 12 are now
implemented — two children (001, 003) closed early in the session, and the
remaining six (004–009) implemented after operator approval. Each child ran its
Perfection Loop (RED → GREEN → AUDIT → SELF-CORRECT) with grep-verified Law-4
evidence; each is verified, closed, and archived. The planning sign-off returned
**PASS** (one Nova caveat was traced and retracted as a misread of a stale
header comment, since corrected). The implementation sign-off request is
drafted in `dev/nova/outbox/` and awaits operator transmission to Nova.

---

## Final FID State

| FID | Findings | Status |
|---|---|---|
| FID-2026-0815-001 | F-01 per-step prompt format eager placeholder cost | **CLOSED** (archived) |
| FID-2026-0815-002 | master plan (catalogs F-01…F-12) | **CLOSED** (archived) — re-audited after children |
| FID-2026-0815-003 | F-02 trace writer async + O(1) role tracking | **CLOSED** (archived) |
| FID-2026-0815-004 | F-03 per-step history copy reduction | **CLOSED** (archived) |
| FID-2026-0815-005 | F-04/F-05 per-write overhead (checkpoint + existsSync) | **CLOSED** (archived) |
| FID-2026-0815-006 | F-06/F-07/F-08 compactor micro-optimizations | **CLOSED** (archived) |
| FID-2026-0815-007 | F-09/F-10 CLI startup (model catalog + registry I/O) | **CLOSED** (archived) |
| FID-2026-0815-008 | F-11 UI re-render (store no-op guards + profiling) | **CLOSED** (archived) |
| FID-2026-0815-009 | F-12 code-map / knowledge-graph indexing | **CLOSED** (archived) |

`dev/fids/` is clear. Master 002 and children 004–009 are in `dev/fids/archive/`.

---

## Implementation Record (all children)

### FID-004 — per-step history copy reduction (F-03)

`expireMessages` fast-path (return input unchanged when nothing expires) +
conditional append in `step.ts` (4 allocations/step → 2). Law-4 grep confirmed
no caller mutates the returned array in place.

### FID-005 — per-write overhead (F-04/F-05)

Async `captureSnapshot` (`fs.promises.readFile`) with an in-flight per-path
promise map (first-wins dedupe preserved), awaited in `runWriteGate`; async
`closeTurn`/`prune`; Law-1 gate uses awaited `fs.promises.access`. `finalize()`
awaits `closeTurn`. New concurrency regression (one read for concurrent
same-path captures).

### FID-006 — compactor micro-optimizations (F-06/F-07/F-08)

`reactiveCompact` single forward walk (O(n²)→O(n)); `microCompact` uses a
`keepRecentSet`; `getThresholds()` returns the immutable internal reference.
Also corrected the stale header comment that had mis-described
`context-compactor.ts` as a re-export shim (the cause of Nova's retracted
citation gap).

### FID-007 — CLI startup (F-09/F-10)

Gateway disk cache (`gateway-catalog.json`, same `CATALOG_TTL_MS`, write-through);
async skill + agent discovery via `fs.promises`. **Surfaced API change:**
`loadSkillsSync` removed (Law-4 zero callers); re-export + `docs/sdk-overview.md`
updated; restorable on request.

### FID-008 — UI re-render (F-11)

`Object.is` no-op guards in `updateContextTokens`/`updateContextTokensMax`/
`updateSessionCost`; `setCompactionStatus` no-ops on a shallow field compare
(not reference equality — the runtime rebuilds a fresh object per heartbeat).
New subscriber-notification regressions. Interactive profiling pass deferred
(tmux follow-up).

### FID-009 — code-map / knowledge-graph indexing (F-12)

Bounded pool (concurrency 6) for reads + parses with lookup-only Maps and an
ordered cap walk (byte-identical output); scan-loop hash reused in the upsert
loop; `resolveSymbolDefiningFile` O(1) pick over pre-sorted lists. Determinism
regression (two rebuilds → identical stats + semantic rows).

---

## Verification (all exit 0)

- Typecheck ×4 (sdk/common/agent-runtime/cli) + code-map + knowledge-graph.
- Full suites: agent-runtime 964/0 · SDK 475 pass / 1 skip / 0 fail · CLI 3074
  pass / 18 skip / 0 fail · code-map 51/0 · knowledge-graph 19/0.
- Focused: checkpoint-store 18/0, rewind 10/0, send-message 45/0, compactor
  17/0, load-skills 7/0, openrouter-models 22/0, registry-gating 5/0,
  chat-store no-op guards 11/0.
- ESLint `--max-warnings 0` on every changed file.

---

## Nova Correspondence

- **Planning sign-off:** PASS — planning approved for operator decision
  (`dev/nova/outbox/2026-08-15-fid-2026-0815-002-004-009-planning-audit-verdict.md`).
- **Implementation sign-off request:** drafted
  (`dev/nova/outbox/2026-08-15-fid-2026-0815-004-009-harness-speed-remediation-implementation-signoff-request.md`).
  **Awaiting operator transmission to Nova.** It sits in `outbox/` and does not
  send by itself.

---

## Corrected Governance (recorded for the next session)

- **Governing doc is `dev/echo-v0.1.2-single-agent.md`, not `ECHO.md`**
  (`ECHO.md` is the harness protocol; this session is single-agent).
- **Workflow:** write ALL FIDs → run the Perfection Loop on each → re-run the
  loop on the master → **PRESENT for approval** → implement only after approval.
- **Nothing is out of scope unless the operator says so; default = include
  everything** (standing directive).
- **No signatures / author attribution** in any artifact.
- `SCOPE.md` at the repo root is the live audit trail of approved scope.

---

## Open Items

- **Transmit the implementation sign-off request** to Nova
  (`dev/nova/outbox/2026-08-15-fid-2026-0815-004-009-harness-speed-remediation-implementation-signoff-request.md`).
- On Nova PASS: operator closure decision for the program.
- FID-008 interactive profiling pass (render counts / `bun --cpu-prof` over a
  scripted tmux session) remains a follow-up; record findings + follow-up FIDs
  if material.
- Commit decisions are the operator's — all implementation is uncommitted
  alongside the broader pre-existing 0.0.24 worktree changes (do not conflate).

## Lessons Learned

- Running the Perfection Loop on a planning FID is real work: grep-verify every
  `file:line` citation. This session's AUDIT pass caught an incorrect
  `write-gate.ts:165-171` citation (file is 148 lines) and corrected it via
  SELF-CORRECT.
- Present-Before-Act is absolute: code must follow a converged, approved FID,
  not precede it. Retroactive FIDs reconcile but are not the intended path.
- Concurrency changes must preserve the existing invariant explicitly (e.g.
  checkpoint "first capture wins" → in-flight dedupe map) — documented in the
  FID's Missed Questions, not assumed.
- Determinism under parallelism needs an explicit guard: collect into
  path-keyed lookup-only Maps and assemble from pre-existing ordered structures;
  a raw-rowid snapshot can false-fail on AUTOINCREMENT shifts (join on the
  semantic key instead).

No commit, push, release, publication, or deployment was performed.
