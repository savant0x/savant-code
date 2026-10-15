<!-- markdownlint-disable MD013 -->

# Nova Planning Audit Response — FID-2026-0812-005 Adaptive Session Grounding Refresh

**Date:** 2026-08-12
**Auditor:** Nova — independent third-party ECHO auditor
**Request:** dev/nova/outbox/2026-08-12-fid-2026-0812-005-adaptive-session-grounding-refresh-planning-signoff-request.md
**FID under audit:** dev/fids/FID-2026-0812-005-adaptive-session-grounding-refresh.md

## Overall Verdict: PASS (planning)

The FID is internally coherent, every material claim is grounded in cited source (independently re-verified), and the normative requirements for Domains C–E are fully specified. Ready for the operator's separate implementation decision. No implementation or release authorization granted by this audit.

## Per-Domain Table

| Domain | Verdict | Basis |
|---|---|---|
| A — Problem & root-cause evidence | PASS | All 7 cited defects verified against source (see citations below) |
| B — Safety invariants & scope | PASS | Mandatory first-session grounding preserved (§22, §47); harness universal gate retained; SDK legacy no-gate behavior explicit (§10, §49); subagent pre-seeding unchanged (MQ-11); no credential/release scope (Out of Scope §112-121) |
| C — Persisted checkpoint contract | PASS | Authoritative `schemaVersion:1` shape defined (§142-161); normative serialization rules (sorted lowercase path keys, SHA-256 fingerprint over tuple, epoch = deterministic identity not timestamp); migration behavior for missing/malformed/unknown/stale (§170-171); sufficient and migratable |
| D — Adaptive cadence & anti-thrash | PASS | All 4 constants normative (§178-183); logical-turn semantics explicit (§206); same-epoch dedupe + MIN_REFRESH_TURN_GAP=2 + compaction epoch cap (§198-204); no path to refresh-every-turn or repeat-within-turn |
| E — Stream & transcript visibility | PASS | Fixed to non-rendered per-step buffer (§214); hidden-renderer alternative explicitly forbidden; discard-on-block; typed internal delivery or explicit renderer-filter fallback with replace semantics (§215, MQ-9) |
| F — Call-graph & implementation readiness | PASS | Every seam names a file family + caller/test update requirement (§95-110, §230); no orphan new symbol proposed without caller updates |
| G — Verification & evidence boundaries | PASS | Source tests separated from live `bun dev` evidence; live operator/UI correctly NEEDS-REVIEW (§270-272, MQ-13); no implementation claim pre-existence |

## Source Citations Verified (independent re-check)

- `packages/agent-runtime/src/echo/enforcement.ts:23` — `const enforcementInstances = new WeakMap<object, EchoEnforcement>()` ✓ (A1, A3)
- `packages/agent-runtime/src/echo/enforcement.ts:152-162` — gate clears on single `isProtocolReadCall` match only; code comment confirms "gate clears when a read targets the protocol file" ✓ (A3, A6)
- `packages/agent-runtime/src/tools/stream-parser.ts:293-305` — `onResponseChunk(chunk.text)` forwards immediately; `fullResponseSoFar` accumulates ✓ (A4, E)
- `packages/agent-runtime/src/run-agent-step/loop-iteration.ts:314-325` — `applyUngroundedCompletionGate` runs AFTER step returns (line 324) → cannot retract streamed text ✓ (A4, E)
- `sdk/src/run/execution/session-state.ts:72-83` — `applyOverridesToSessionState` deep-clones prior session ✓ (A1, A5)
- `packages/agent-runtime/src/echo/enforcement.ts:397-405` — `onStepBoundary()` increments `turnCount` per loop step; `:401` refreshes on `% PROTOCOL_REFRESH_INTERVAL` ✓ (A2)
- `packages/agent-runtime/src/echo/protocol-summary.ts:17` — `PROTOCOL_REFRESH_INTERVAL = 15` (internal-step cadence, not user turns) ✓ (A2, D)

## Findings

**None critical/high.** Minor notes (not blocking):

- *Low:* The FID assumes `requiredPaths`/`completedPaths` cover the four-file boot set (`ECHO.md`, `ARCHITECTURE.md`, `protocol.config.yaml`, `dev/LEARNINGS.md`) named in the boot message. The current enforcement gate (enforcement.ts:152-162) only checks one protocol file. The FID correctly identifies this as the defect to fix (§41, §50-51); implementation must populate `requiredPaths` from the resolved contract. This is an implementation task, not a planning gap.
- *Informational:* Live `bun dev` transcript/UI behavior (no first-answer flash, no synthetic user messages, cadence near turn 5) remains NEEDS-REVIEW per FID §270-272. Correctly out of planning scope.

## Authorization Boundary

This PASS grants **no implementation, closure, archive, commit, tag, push, publication, or deployment authorization.** Implementation begins only after explicit operator approval and requires a separate implementation audit before the FID moves to `dev/fids/archive/`.

## Planning vs Operator Approval

Planning sign-off (this response) confirms the FID is evidence-grounded and implementation-ready. **Operator approval is separate and not supplied by this request.** The FID remains `Status: verified` (planning) and must not be marked `closed` until implementation + independent implementation audit + operator live evidence exist.

## Residual Before Closure

1. Operator approves implementation.
2. Implementation passes typecheck × 4, ESLint (`--max-warnings 0`), Prettier, lint:md.
3. Unit/integration tests prove: resumed clone no full re-ground; single ECHO.md read ≠ four-file set complete; turn-5 condensed refresh; compaction dedupe; checkpoint migration.
4. Direct `bun dev` operator session (≥6 turns + compaction/resume) confirms no ungrounded flash, no synthetic user messages, cadence near turn 5. NEEDS-REVIEW until performed.

---
*Audit performed without editing repository files. Verification basis: cited test/output claims + direct source inspection of the files referenced in FID §Evidence and the request's suggested commands.*
