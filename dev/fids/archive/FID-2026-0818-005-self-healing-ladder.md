<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0818-005 — Auto Drive self-healing ladder: failure routing, discovery handling, Run Log

**Severity:** high
**Status:** closed
**ID:** FID-2026-0818-005
**Filename:** `FID-2026-0818-005-self-healing-ladder.md`
**Created:** 2026-08-18
**Master FID:** FID-2026-0818-001
**Depends On:** FID-2026-0818-004

## Summary

The recovery engine of Auto Drive. When anything fails mid-run, the ladder
router decides **where** the work goes — never **whether** to skip it.
Rungs: (1) mechanical retry (EHEL tool blocks, compile errors → correction
prompt, same phase); (2) standard FSM (Verifier FAIL / Adversary refutation →
SELF_CORRECT → GREEN → re-AUDIT); (3) re-analysis (the *same* issue recurs →
route back to RED for a fresh Detective/Thinker pass — the approach is wrong,
not the code); (4) new-FID-on-discovery (an issue found outside the current
FID → Recorder creates a child FID, appended to the queue, processed before
completion — nothing dropped); (5) documented default (spec gap → most-robust
default, recorded as a decision in the FID's GREEN section — pre-authorized
by the operator's confirmation contract); (6) context (L0-L3 compaction);
(7) terminal block (circuit breaker after re-analysis, budget, or genuine
impasse → blocked + full report). Every event is appended to the master
FID's `## Run Log` — the deferred presentation that satisfies the
anti-deferral gate without mid-run prompts.

## Environment

- `packages/agent-runtime/src/echo/pre-write-gates.ts` — EHEL mechanical
  blocks (Law 1/3/7/8/15, step-status transition gate) — rung 1 inputs.
- `packages/agent-runtime/src/util/echo-compliance.ts` — Law 1/3
  `compliance_warning` receipts + corrective steering (FID-2026-0804-009).
- Circuit breakers in AgentState (ECHO.md): `iterationCount` (10 max),
  `oscillationDetections` + `lastIssueIds` (3-strike), 10% Levenshtein cap —
  rung 7 inputs.
- ECHO.md Perfection Loop — AUDIT fail → SELF_CORRECT; "if new issues found"
  → re-enter RED (the FSM already has the re-analysis edge).
- `agents/thinker/thinker.ts`, `agents/detective/detective.ts` — rung 3
  actors; `agents/recorder/recorder.ts` — rung 4 actor.
- `agents/context-pruner/` — L0-L3 compaction (README: 4-layer progressive
  auto-compaction) — rung 6.
- Anti-deferral gate (FID-2026-0817-005) — the contract the ladder must
  satisfy: no silent deferrals; blocked steps presented (here: Run Log +
  terminal report); `deferred::` markers operator-only.

## Detailed Description

### Problem

An autonomous run will fail. The failure modes are known (compile errors,
Verifier FAILs, Adversary refutations, EHEL blocks, discoveries, spec gaps,
context exhaustion, model errors). Interactive mode handles them by asking
the operator. Drive mode cannot ask — so the ladder must route each failure
to a resolution that preserves quality and enforcement, and must record the
decision so the operator can review it afterward.

### Expected Behavior

Failures route down the ladder; quality gates never weaken: every fix still
passes the full ceremony, every discovery becomes a tracked FID, every
default is documented, and only ladder-exhausted states terminate the run —
with a report the operator reviews, not a question the operator answers.

### Root Cause

Recovery is interactive by default (ask the user). Drive mode needs a
deterministic recovery policy with the same enforcement properties.

### Evidence

- EHEL block vocabulary verified (`pre-write-gates.ts` return shapes:
  `blocked: true, reason`).
- `compliance_warning` receipts verified (`common/src/types/print-mode.ts`).
- FSM re-entry edges verified (ECHO.md Perfection Loop diagram: SELF_CORRECT
  from AUDIT/ADVERSARIAL; re-enter RED if new issues found).
- Circuit breaker fields verified in ECHO.md ("Circuit Breaker Rules").
- Context-pruner layers verified (README "4-layer progressive
  auto-compaction").

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/` — new `ladder-router.ts`:
  failure classification (from EHEL receipts, verdicts, FID-file state) →
  rung selection; SELF_CORRECT/RED re-entry invocation; terminal block
  emission.
- Master-FID `## Run Log` — new section writer (event vocabulary below).
- `agents/recorder/recorder.ts` — new-FID-on-discovery contract (rung 4).
- `agents/thinker/thinker.ts` + `agents/detective/detective.ts` — re-analysis
  contract (rung 3: fresh instance, never inherits the failed approach).
- `common/src/types/session-state.ts` — Run Log event types.

### Risk Level

- [x] High: the ladder is what makes "never stop" safe; misclassification
  either kills runs early (rung 7 too eager) or burns budget (rung 3 too
  eager). Circuit breakers bound both directions.

## Proposed Solution

### Approach

1. **Failure classification:** the router reads (a) EHEL receipts/block
   reasons, (b) Verifier/Adversary verdicts, (c) the FID file's phase
   evidence, (d) circuit-breaker counters. Each failure maps to a rung.
2. **Rung routing:** mechanical → same-phase retry with correction prompt;
   FSM → SELF_CORRECT (standard loop); recurrence → RED re-entry (fresh
   Detective + Thinker, approach-level rethink, GREEN rewritten); discovery
   → Recorder creates child FID (queue append, dependency edge recorded);
   spec gap → documented default in GREEN (decision + rationale, step stays
   implemented — the anti-deferral gate sees `[x]`); context → compaction
   (L0-L3, proactive at FID boundaries per child 007); terminal → blocked +
   report.
3. **Oscillation semantics:** the 3-strike counter is keyed by issue
   signature AND rung — a re-analysis changes the signature, so the breaker
   fires only when the same issue survives a rethink (the ladder resolves
   wrong-implementation and wrong-approach before the breaker ever trips).
4. **Run Log (deferred presentation):** every rung event appends
   `FID-YYYY-MMDD-NNN` + `{timestamp, rung, decision, rationale, evidence
   refs}` to the master FID's `## Run Log`. The final `/export` includes it;
   the ledger scan is the mechanical backstop (an archived FID with
   unresolved steps still fails).
5. **New-FID discovery rule:** discoveries become queue items processed
   before completion (zero-open-FID criterion); the master manifest is
   updated with the addition — the operator's approved scope grows only via
   tracked, evidence-backed FIDs, and the run does not end while they are
   open.

### Steps

1. Define Run Log event schema + section writer (master FID).
2. Implement `ladder-router.ts`: classification inputs, rung mapping,
   SELF_CORRECT/RED invocation, terminal-block emission.
3. Rung 3 contract: fresh-Thinker/Detective re-analysis; GREEN rewrite;
   issue-signature change rules.
4. Rung 4 contract: Recorder discovery-FID workflow; manifest append.
5. Rung 5 contract: documented-default decision block (GREEN);
   anti-deferral compliance check.
6. Rung 7 wiring: circuit-breaker + budget + genuine-impasse → blocked +
   report (no prompt).
7. Tests: classification matrix (each failure type → correct rung);
   recurrence → RED not SELF_CORRECT; 3-strike-after-rethink → terminal;
   Run Log append correctness.

### Verification

- Unit: ladder matrix (10+ failure fixtures).
- Live: seeded failing child FID — mechanical retry → SELF_CORRECT → (repeat
  failure) RED re-analysis → resolves; a discovery mid-run becomes a new FID
  and is processed; the Run Log records all events; run completes with zero
  open FIDs.

## Step Status

- [x] 1. Run Log schema + master-FID writer (`run-log.ts` + `RunLogEvent` in `auto-drive.ts`)
- [x] 2. `ladder-router.ts` classification + rung mapping (`classifyFailure`/`rungLabel`)
- [x] 3. Rung 3 re-analysis contract (`agents/thinker/thinker.ts` + `agents/detective/detective.ts`)
- [x] 4. Rung 4 discovery-FID workflow (`agents/recorder/recorder.ts` + `gapToFidDraft` in `goal-conformance.ts`)
- [x] 5. Rung 5 documented-default decision block (`appendDocumentedDefault` in `run-log.ts`)
- [x] 6. Rung 7 terminal block (`classifyFailure` breaker/budget/impasse → rung 7)
- [x] 7. Classification + oscillation + Run Log test matrix (`ladder-router.test.ts`, 5 cases)

## Perfection Loop

### Loop 1 — RED

- R1. No autonomous recovery policy: every failure path today ends at the
  operator.
- R2. Blind retry risk: without re-analysis, a wrong approach loops in
  SELF_CORRECT until the breaker kills the run.
- R3. Discovery handling: issues found outside scope are "flagged" (Law 2
  Additional Rule) — drive mode must track them as FIDs, not prose.
- R4. No audit trail for autonomous decisions: the operator has nothing to
  review but the final diff.

### Loop 1 — GREEN

- G1. Ladder, not a policy blob: deterministic rung mapping from existing
  signals (EHEL receipts, verdicts, FID state, counters).
- G2. Re-analysis before breaker: oscillation is keyed by issue signature +
  rung, so the breaker fires only after a rethink (fixes R2).
- G3. Queue = anti-deferral: discoveries become FIDs processed before
  completion (fixes R3, consistent with FID-2026-0817-005).
- G4. Run Log = deferred presentation (fixes R4): decisions are recorded,
  reviewed at the end; the ledger remains the mechanical backstop.
- G5. Status `analyzed`; Step Status `blocked::` markers.

### Loop 1 — AUDIT

AUDIT-1 (citations):

- `packages/agent-runtime/src/echo/pre-write-gates.ts` — block vocabulary
  (blocked:true, reason) verified. ✓
- `common/src/types/print-mode.ts` — `compliance_warning` variant verified. ✓
- ECHO.md — SELF_CORRECT + RED re-entry edges, circuit breakers, Law 2
  Additional Rule verified. ✓
- `agents/context-pruner/` — compaction machinery verified (constants,
  preserved-state). ✓
- FID-2026-0817-005 — anti-deferral contract verified (this FID's parent
  authority). ✓
→ 5/5 verified.

AUDIT-2 (adversarial):

- A2.1 Could the ladder's documented default violate the anti-deferral gate?
  No: the default is a *decision* (implemented with rationale), not a
  deferral — the step stays `[x]` and the gate passes. A true deferral
  (cannot implement) is a rung-7 impasse, never a silent marker.
- A2.2 Could discovery-FIDs explode the queue (runaway scope)? Yes —
  mitigated by observability (007: sidebar growth signal) and the operator's
  Esc. The run does not ask; it reports. Documented trade-off (master
  Missed Question 3).
- A2.3 Could re-analysis loop between RED and GREEN? Yes — bounded by
  iterationCount (10) + oscillation (3-strike after rethink) → rung 7.
- A2.4 Is the Run Log trustworthy? It is written by the ladder router
  (deterministic events), not by the model — model-authored rationale is
  recorded as attributed text; the log's event frames are mechanical.

### Loop 1 — SELF-CORRECT

- SC1: initial draft had the router ask the operator on rung 7; corrected —
  rung 7 is terminal (blocked + report), the operator reviews afterward.
- SC2: initial oscillation semantics keyed by issue only; corrected to
  issue + rung (G2) — otherwise re-analysis could never clear a signature.

### Missed Questions

1. Should discoveries be prioritized (blocking the current FID) or queued
   (processed after)? Decision: queued by default (dependency-aware), but a
   discovery that blocks the current FID's implementation forces a re-order
   (dynamic queue, child 004) — the current FID is never silently abandoned.
2. Who validates a documented default's soundness? Decision: the Verifier
   (AUDIT) — a default is implemented like any other step and audited;
   the Adversary can flag defaults that hide scope changes (its checklist
   already covers silent-deferral verification, FID-2026-0817-005 Part E).

### Code Verification Evidence

- All citations verified 2026-08-18 (AUDIT-1 5/5).
- `bun run validate:repository` PASS after drafting (see master Resolution).

## Resolution

- **Status:** `closed` — operator-directed closure + archive 2026-08-18: all
  7 steps `[x]` (classification, Run Log, re-analysis + discovery contracts,
  rung-5 decision-block writer, terminal block). Typecheck ×4, agent-runtime
  suite, and the ladder/Run Log unit matrix are green. Program-level
  seeded-failure live smoke stays tracked by master FID-2026-0818-001
  (step 8), which remains active.
- **Closure path:** seeded-failure live smoke recorded (needs a live model
  run) → closed + archived with evidence per FID-2026-0817-005.

## Lessons Learned

- Recovery is routing, not permission: every failure has a destination that
  preserves enforcement (deeper analysis, tracked FID, documented decision)
  — only ladder-exhaustion may stop a run.
- The anti-deferral gate and the ladder are the same law: "never drop work
  silently" is the queue, and "never stop early" is its driver-side twin.
