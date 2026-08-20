<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0818-006 — Auto Drive completion certification: goal-conformance audit, `/verify` gate, gap loop

**Severity:** medium
**Status:** closed
**ID:** FID-2026-0818-006
**Filename:** `FID-2026-0818-006-completion-certification.md`
**Created:** 2026-08-18
**Master FID:** FID-2026-0818-001
**Depends On:** FID-2026-0818-004, FID-2026-0818-005

## Summary

The double-gate completion contract. "Never stop" means: stop only when (a)
the FID queue is empty **and** (b) the goal-conformance audit passes — the
approved acceptance criteria are verified against the actual repository —
**and** (c) `/verify` (all four workspace typechecks) is green. If the queue
is empty but the audit finds gaps, the gaps become new FIDs (child 005 rung
4) and the drive loop continues: the run cannot end on an unfulfilled goal.
The audit is mechanical where possible (tests, typechecks, feature greps)
and Scribe-assisted where judgment is needed (CHANGELOG cross-check against
the approved plan).

## Environment

- `common/src/types/session-state.ts:149` — `GoalRecord.completionCriterion`
  (the acceptance criteria approved at entry, child 002).
- `packages/agent-runtime/src/run-agent-step/goal-engine.ts:275-276` —
  `<untrusted_completion_criterion>` serialization into model context.
- `cli/src/commands/defs/chat.ts:109` — `/verify` command (four workspace
  typechecks or one selected).
- `cli/src/commands/export-conversation.ts` — `/export` self-contained
  branded HTML report (child 007 consumes for handoff).
- `agents/scribe/scribe.ts` — Scribe agent (session summaries, LESSONS.md,
  knowledge files) — the CHANGELOG cross-check actor.
- `scripts/fid-ledger.ts` — `validateActiveFidLedger` + `validateFidStepLedger`
  (`bun run validate:repository`) — the mechanical queue-empty + step-status
  proof.
- `agents/context-pruner/` — compaction (the audit runs after the drive has
  been long; context hygiene applies).

## Detailed Description

### Problem

A run that stops when its own queue drains can stop early: the decomposition
may have missed work, the agent may have implemented a subset, or the
acceptance criteria may be unsatisfied despite all FIDs closing. The goal
driver's `update_goal` is a model claim, not a verification. Without a
second gate, "100% complete" is whatever the agent says it is.

### Expected Behavior

At zero-open-FID, the certification stage runs: (1) `validate:repository`
PASS (queue truly empty, ledger clean, no unresolved steps); (2)
goal-conformance audit — every acceptance criterion from the approved plan
is checked against the repo (tests/typechecks/greps; Scribe cross-checks the
CHANGELOG against the plan); (3) `/verify` all four typechecks green; (4)
gaps found at (2) → new FIDs → drive continues (child 005 rung 4); (5) all
pass → handoff (child 007).

### Root Cause

Completion is a single, model-claim signal today (`update_goal`). The
approved plan's acceptance criteria are never mechanically re-checked
against the repo.

### Evidence

- `completionCriterion` field + `<untrusted_completion_criterion>` verified
  (`goal-engine.ts:275-276`).
- `/verify` command verified (`cli/src/commands/defs/chat.ts:109`).
- `validate:repository` mechanics verified (`scripts/fid-ledger.ts` +
  `scripts/validate-repository.ts`).
- Scribe agent verified (`agents/scribe/scribe.ts`).

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/` — new `goal-conformance.ts`:
  criterion registry (from the approved plan), per-criterion check
  strategies (test suite, typecheck, feature grep, file existence),
  gap → new-FID emitter.
- `agents/scribe/scribe.ts` — CHANGELOG-vs-plan cross-check contract.
- `cli/src/commands/` — `/verify` reuse (no change expected; invocation
  only).
- `common/src/types/session-state.ts` — certification record
  (`criterionResults[]`, `gaps[]`).

### Risk Level

- [x] Medium: the audit is additive (post-queue check); risk is criterion
  over/under-specification — the acceptance criteria were approved by the
  operator at entry (002), so the audit enforces the operator's own
  definition of done.

## Proposed Solution

### Approach

1. **Criterion registry:** at drive start (child 003), the master FID's
   acceptance criteria are parsed into `criterionResults[]` (id, check
   strategy, evidence refs). The registry is the audit's checklist.
2. **Check strategies (mechanical where possible):**
   - test-suite: `bun test <workspace>` for criteria backed by tests;
   - typecheck: `/verify` (all four) for build-integrity criteria;
   - feature-grep: `code_search`/`grep` for criteria naming symbols/APIs
     (Law 4 pattern: production entry points);
   - file-existence: expected artifacts exist;
   - judgment: Scribe cross-checks the CHANGELOG entries against the plan
     and flags uncited or missing work (attributed, not asserted — the
     Cross-Agent Claim Rule applies).
3. **Gap loop:** any unchecked criterion → new child FID (rung 4, child
   005) with the criterion as its acceptance target → drive resumes → audit
   re-runs at next zero-open-FID. The loop terminates by construction:
   each gap FID is bounded by the ladder's breakers.
4. **Certification record:** `criterionResults[]` + `gaps[]` persisted in
   session state and rendered in the `/export` report (child 007).

### Steps

1. Define criterion registry schema + parsing from the master FID.
2. Implement check strategies (test-suite / typecheck / feature-grep /
   file-existence).
3. Implement gap → new-FID emitter (reuses child 005 rung 4).
4. Scribe CHANGELOG cross-check contract (attributed findings).
5. Certification record + report rendering hooks (child 007 consumes).
6. Tests: criterion matrix (pass/fail per strategy); gap emission; audit
   re-run after gap FIDs close; Scribe attribution format.

### Verification

- Unit: criterion-strategy matrix + gap loop.
- Live: fixture goal where one criterion is deliberately unmet at
   zero-open-FID → audit flags → gap FID → drive continues → audit passes →
   handoff. `/export` report contains `criterionResults[]`.

## Step Status

- [x] 1. Criterion registry schema + build (`buildCriterionRegistry` in `goal-conformance.ts`)
- [x] 2. Check strategies (`evaluateCriterion` + `ConformanceEvidence`)
- [x] 3. Gap → new-FID emitter (`gapToFidDraft`)
- [x] 4. Scribe CHANGELOG cross-check contract (`agents/scribe/scribe.ts`)
- [x] 5. Certification record + report hooks (`DriveCertification`/`CriterionResult` types on `auto-drive.ts`; `/export` Run Log + certification sections via `drive-report.ts` + `template.ts` + `template-css-part2.ts` + `export-conversation.ts`, tested in `drive-report.test.ts`)
- [x] 6. Criterion + gap-loop test matrix (`goal-conformance.test.ts`, 7 cases)

## Perfection Loop

### Loop 1 — RED

- R1. `update_goal` is a model claim — no mechanical criterion check
  (`goal-engine.ts` verified: criterion is serialized, never evaluated).
- R2. Queue-empty ≠ goal-fulfilled: decomposition gaps and subset
  implementations both produce empty queues with unmet goals.
- R3. No audit trail of criterion results: the operator cannot see *why*
  the run believes it is done.

### Loop 1 — GREEN

- G1. Double gate: queue-empty (ledger) AND conformance (criterion
  registry) AND `/verify` — three independent signals, all mechanical.
- G2. The operator's own acceptance criteria are the checklist — the audit
  enforces the approved definition of done, no new authority.
- G3. Gap loop reuses child 005 rung 4 — no new discovery machinery.
- G4. Scribe's cross-check is attributed (Cross-Agent Claim Rule), never
  asserted as fact.
- G5. Status `analyzed`; Step Status `blocked::` markers.

### Loop 1 — AUDIT

AUDIT-1 (citations):

- `packages/agent-runtime/src/run-agent-step/goal-engine.ts:275-276` —
  criterion serialization verified. ✓
- `cli/src/commands/defs/chat.ts:109` — `/verify` usage verified. ✓
- `agents/scribe/scribe.ts` — Scribe definition verified. ✓
- `scripts/fid-ledger.ts` — queue-empty + step-status validation verified. ✓
→ 4/4 verified.

AUDIT-2 (adversarial):

- A2.1 Could the audit loop forever (gap FIDs never converge)? Gap FIDs are
  bounded by the ladder's breakers (child 005 rung 7); a criterion that
  cannot be met is an impasse → terminal block with the criterion named.
- A2.2 Could criteria be gamed (vague acceptance text)? The operator
  approves the criteria at entry (child 002 presentation) — the audit
  checks what the operator approved; vague criteria are an entry-time
  quality issue, surfaced in the plan presentation.
- A2.3 Is `/verify` sufficient for "build stays clean"? It proves typecheck;
  the full gate sweep (eslint, lint:md, prettier, tests) is the closure
  gate per child — the audit uses `/verify` as the run-end signal and the
  full sweep at program close (master step 7).

### Loop 1 — SELF-CORRECT

- SC1: initial design had the Scribe *decide* criterion pass/fail; corrected
  — Scribe produces attributed findings; pass/fail is mechanical (G4).
- SC2: initial audit ran only at zero-open-FID; corrected — the audit also
  runs pre-handoff after every gap loop iteration (G1 double-gate).

### Missed Questions

1. Should the audit run mid-run (periodic) or only at zero-open-FID?
   Decision: at zero-open-FID (the gate that matters) plus after each gap
   loop; periodic mid-run auditing is observability (child 007), not
   certification.
2. Who owns the criterion registry if the plan changes mid-run (discovery
   FIDs add scope)? Decision: the master FID is the single registry;
   discovery FIDs append their acceptance targets to it (child 005 rung 4);
   the audit always reads the master FID fresh.

### Code Verification Evidence

- All citations verified 2026-08-18 (AUDIT-1 4/4).
- `bun run validate:repository` PASS after drafting (see master Resolution).

## Resolution

- **Status:** `closed` — operator-directed closure + archive 2026-08-18: all
  6 steps `[x]` (step 5's `/export` certification rendering landed via
  `drive-report.ts` + `template.ts` + `export-conversation.ts`). Criterion +
  gap-loop matrix green. Program-level live unmet-criterion smoke stays
  tracked by master FID-2026-0818-001 (step 8), which closed + archived 2026-08-18.

## Lessons Learned

- Completion needs three independent signals: queue-empty (ledger),
  goal-fulfilled (criterion audit), build-clean (`/verify`). Any one alone
  is a claim, not a proof.
- The operator's acceptance criteria are the audit's checklist — the same
  text that made the plan "crystal clear" at entry makes "done" mechanical
  at the end.