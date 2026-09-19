# FID: EHEL Law 3 Gate Circular Block On Interlocked Multi-File Batches

**Filename:** `FID-2026-0918-005-ehel-law3-circular-block.md`
**ID:** FID-2026-0918-005
**Severity:** high
**Status:** verified
**Created:** 2026-09-18 20:05
**YAGNI-Compliance:** Confirmed (Loop 3 — minimal scope, no speculative
additions)

---

## Summary

The EHEL Law 3 pre-write gate hard-blocks any write to a non-exempt code file
while *any* code file is dirty-and-unverified. During an interlocked
multi-file edit batch, an intermediate state can break the workspace
typecheck; the gate then blocks writes to every remaining file in the batch,
while the only repair path is writing one of those blocked files. This is a
circular dependency: the blocked write is what would allow verification to
pass and credit the dirty file. Observed twice in a single session on
2026-09-18 (FID-2026-0918-004 work); each occurrence required the operator to
end the turn twice to unlock.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** monorepo workspaces `cli`, `packages/agent-runtime`,
  `common`; EHEL harness in `packages/agent-runtime/src/echo/`
- **Commit/State:** observed during FID-2026-0918-004 session (branch `main`,
  4 commits ahead of origin, working tree carrying the 004 fix)

## Detailed Description

### Problem

While implementing FID-2026-0918-004 (8 interlocked files across
`cli/src/state/chat-store/`), the first edit left the workspace failing
typecheck until later files in the batch were written. The Law 3 pre-write
gate then refused the next write with:

```text
Law 3: Verify before proceeding — N unverified file(s): [...].
Run typecheck/lint before more writes.
```

The only edit that could repair the typecheck was precisely a write the gate
refused. The agent had no lawful move; the operator ended the turn twice to
reset enforcement state. This recurred within the same session.

### Expected Behavior

A mid-batch intermediate broken-typecheck state must never deadlock the
batch. The agent must always be able to write the repair file; verification
remains enforceable at the boundaries whose job it is (turn end, step
boundary) — not by blocking forward progress mid-batch.

### Root Cause

The gate's blocking scope is wider than the property Law 3 actually needs,
and it disagrees with the tracker layer's own philosophy:

1. **Blocking scope.** `runPreWriteGates` hard-blocks when
   `unverifiedDirty.length > 0` for ANY non-exempt target
   (`packages/agent-runtime/src/echo/pre-write-gates.ts:151-181`):

   ```text
   const unverifiedDirty = [...params.state.dirtyFiles].filter(
     (f) => !params.state.verifiedFiles.has(f) && classifyFileKind(f) === 'code',
   )
   if (
     unverifiedDirty.length > 0 &&
     !(targetPath && isExemptWritePath(targetPath))
   ) {
     return { blocked: true, reason: msg, warnings }
   }
   ```

   `isExemptWritePath` covers only `dev/fids/`, `dev/nova/`,
   `dev/scratchpad/` — production source files are never exempt.

2. **Credit path.** Dirty files are credited only when a verification
   command is detected
   (`packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts:195-208`).
   If the workspace typecheck cannot pass until blocked writes land, the
   credit condition cannot be reached by any lawful sequence.

3. **The cycle.** write B -> blocked by unverified A; verify A -> needs a
   passing verification command -> needs B written. G1 (separation) offers no
   escape because turn-end reset (`resetForNewTurn`) is the only unlock — an
   operator action.

4. **Layer disagreement.** The compliance tracker deliberately permits the
   batch-writes-then-verify pattern: `evaluateAtStepBoundary`
   (`packages/agent-runtime/src/util/echo-compliance.ts`,
   `evaluateAtStepBoundary` docblock) "Only fires on `endingTurn` so the
   batch-writes-then-verify pattern is never flagged mid-batch." The hard
   pre-write gate contradicts this by blocking mid-batch.

History: this is the third member of the deadlock family. FID-2026-0820-012
fixed the `hasVerifiedSinceLastDirty` variant by switching to the
unverified-dirty predicate; FID-2026-0917-002 fixed the docs variant via the
`classifyFileKind` code/docs split. The code-code interlock variant remained.

### Evidence

```text
packages/agent-runtime/src/echo/pre-write-gates.ts:151
  // ── Law 3: Verify Before Proceed ────────────────────────────────────
packages/agent-runtime/src/echo/pre-write-gates.ts:168
  const unverifiedDirty = [...params.state.dirtyFiles].filter(
packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts:195
  // Track verification commands for Law 3 (cumulative — FID-2026-0819-001).
packages/agent-runtime/src/echo/enforcement/turn-end.ts:38
  const unverifiedDirty = [...self.state.dirtyFiles].filter(
packages/agent-runtime/src/util/echo-compliance.ts (evaluateAtStepBoundary)
  Only fires on `endingTurn` so the batch-writes-then-verify pattern is
  never flagged mid-batch.

dev/agenda.md — EHEL circular block entry:
  "Law 3 gate holds a file unverified while the only typecheck repair lives
  in a file the gate won't let you write (interlocked multi-file batch
  edited in the wrong order); required two operator turn-ends to unlock on
  2026-09-18." recurrences: 2 (total 2)

dev/session-summaries/2026-09-18-1945-compaction-signal-repin-retirement.md
  Issue 1 (process, severe).
```

**Honest open item (RED-completion required at implementation):** static
reading shows the credit path fires on *detection* of a verification command
(`tool-pipeline.ts:195-208`) with no visible exit-code check, which would
discharge the block after any typecheck run — yet the incident shows the
block persisting until operator turn-ends. Two candidate causes: (a) a
failing verification command does not credit (exit-gated somewhere not yet
located), or (b) the agent never ran a verification command mid-batch before
attempting the next write. The implementing session MUST first write a
deterministic repro test that pins which cause dominates, then apply GREEN
against it. Both hypotheses are compatible with the proposed approach below.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/pre-write-gates.ts` — Law 3 hard block
- `packages/agent-runtime/src/echo/enforcement/turn-end.ts` — Law 15
  turn-end block (unchanged by the fix; the boundary that keeps Law 3 true)
- `packages/agent-runtime/src/util/echo-compliance.ts` — tracker philosophy
  reference
- Agent throughput in every HYBRID/STRICT session doing multi-file edits

### Risk Level

- [x] High: agent deadlocks mid-batch with no lawful self-recovery; requires
  operator intervention (two turn-ends); workaround exists but is manual

## Proposed Solution

### Approach

Narrow the hard block to the file being written; demote other-file dirtiness
to an advisory. Two-part rule in `runPreWriteGates` (Law 3 section):

1. **Target-dirty hard block (kept, narrowed).** If the *target* file itself
   is dirty-and-unverified (i.e. the target is in the `dirtyFiles` minus
   `verifiedFiles` set), block as today: "verify before re-editing this
   file." The required action is running a verification command; whether a
   single run discharges the block (detection-only crediting) or the run
   must pass (exit-gated crediting) is exactly what the Step 1 repro pins —
   the rule change here is scope, not the credit mechanism.
2. **Other-dirty advisory (new).** If other files are dirty-unverified but
   the target is not, do not block. Emit an advisory warning naming the
   unverified set (same wording as today's message).

Why this preserves Law 3: nothing ships unverified — `evaluateTurnEndImpl`
Law 15 (`turn-end.ts:31-53`) still blocks ending the turn with unverified
files, and the run-agent-step boundary gates still enforce
verify-after-write. The pre-write mid-batch block adds no protection the
turn-end does not already guarantee; it only creates the cycle. This also
aligns the gate with the tracker's documented batch-writes-then-verify
philosophy and follows the FID-2026-0917-002 precedent of narrowing blocking
scope by file kind/role.

Alternatives considered and rejected:

- *Exempt production source paths* — guts Law 3 entirely.
- *Allow writes while typecheck is failing* — encourages piling broken
  edits; also indistinguishable from "typecheck broken by someone else."
- *Static cross-file dependency analysis* — unimplementable in general;
  cannot prove a write is "the repair."

### Steps

1. [x] DONE — repro pinned (`pre-write-gates-law3.test.ts`, credit
   mechanism): crediting is detection-only and exit-code-blind
   (`afterToolCallImpl` receives `{text?, error?}` — no exit code), so a
   failing typecheck credits dirty files exactly like a passing one. The
   incident's block persisted because no verification command was
   detected mid-batch. Answer recorded in Loop 2.
2. [x] DONE — two-part rule implemented; Law 3 logic extracted verbatim
   into `pre-write-gates-law3.ts` (300-line ceiling discipline,
   FID-2026-0913-002) with the parent routing through it.
3. [x] DONE — `pre-write-gates-law3.test.ts` rewritten for the two-part
   contract (13 pass / 0 fail): other-file write passes with advisory;
   target-dirty re-edit still blocked absent verification; discharge
   after a detected run; turn-end Law 15 unchanged (enforcement suite).
4. [x] DONE — docblock states the two-part rule and cites this FID.

### Verification

- New repro + regression suites green (pasted output).
- Typecheck `packages/agent-runtime`; eslint `--max-warnings 0`; quality
  gate.
- Manual adversarial re-read confirming: no code path can end a turn with
  unverified files that previously could (Law 3 property preserved at
  boundaries).

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:37f6606490c9132a3a2c6f6411a7f27bd4ca69ec76acbd714ae8306b2c82c5e7
- verified: 2026-09-19T02:31:48.090Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Cycle cataloged above with file:line evidence; recurrence 2x on
  2026-09-18; operator unlock required both times. Open item: exact credit
  discharge behavior for a failing verification run (repro to be written
  first at implementation).
- **GREEN:** Two-part rule proposed (see Proposed Solution). Not
  implemented; awaiting operator approval.
- **AUDIT:** Document-level double audit performed in single-agent mode:
  markdownlint clean + manual re-read. No code exists yet to verify.
- **ADVERSARIAL:** Self-challenge: does the advisory-only path let an agent
  stack infinite unverified edits? Answer: bounded by turn-end Law 15 (turn
  cannot END unverified) and steering budgets. Does narrowing weaken STRICT
  mode? The target-dirty block remains hard in both tiers; only the
  other-file case changes — and that case is exactly the deadlock case.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Why did the observed incidents not discharge via the detection-only
   credit path? -> Open item; Step 1 repro answers it before any behavior
   change lands.
2. Should the advisory be rate-limited? -> Yes, reuse the existing steering
   budget mechanism; no new budgeting.
3. Does the fix change single-agent mode? -> Single-agent mode has no EHEL;
   the fix changes the Savant harness product behavior only.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending G2 (operator commit authorization; no
  silent deferral — presented at turn end)
- [x] **File:line ranges:** `pre-write-gates.ts` Law 3 section routes
  through `pre-write-gates-law3.ts` (`runLaw3Gate`); path helpers in
  `pre-write-gates-paths.ts`; tests in
  `echo/__tests__/pre-write-gates-law3.test.ts`
- [x] **Gate output:** receipt below — typecheck/test/quality all exit 0
- [x] **Reproducibility:** `bun test
  packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts`
  → 13 pass / 0 fail (credit + exhaustion pins deterministic; full echo
  battery 174 pass / 0 fail across 22 files)
- [x] **Step statuses:** all 4 steps `implemented` (operator-approved
  scope, 2026-09-18; no deferrals)

### Code Verification Evidence

- [x] Files referenced in this FID exist and contain the quoted code
  (verified by grep + read 2026-09-18)
- [x] Implementation matches Proposed Solution (two-part rule; Loop 2
  audit)
- [x] Typecheck/tests/lint pass with pasted output (receipt below; full
  battery transcript in the session summary)
- [x] No production call-graph change proposed (behavior narrowing inside
  one function)

### Loop 2 — Independent audit and self-correction

- **RED:** Step-1 repro answer pinned: the credit path is detection-only
  and exit-code-blind, so hypothesis (a) is structurally impossible (no
  exit code exists to gate on) and (b) dominated the incident — no
  verification command was detected mid-batch before the next write.
- **GREEN:** Two-part rule implemented as proposed (target-dirty hard
  block kept; other-dirty advisory added). Extraction kept the parent
  under the ceiling with zero import-site changes.
- **AUDIT:** Static: typecheck agent-runtime exit 0; eslint
  `--max-warnings 0`; quality PASS; receipt gates exit 0 ×3. Manual
  re-read of the reworked Law 3 section and the new module found no
  drift from the proposed rule.
- **ADVERSARIAL:** (1) Can the advisory path stack infinite unverified
  edits? Bounded by turn-end Law 15 (unchanged; enforcement suite pins
  the block). (2) Does narrowing weaken STRICT mode? Target-dirty stays
  hard in both tiers; only the deadlock case changed. (3) Discovered
  pre-existing gap, flagged not hidden: exit-code-blind crediting means
  a FAILING verification command also discharges Law 3 and turn-end Law
  15 (same `verifiedFiles`). Pre-dates this FID (FID-2026-0819-001's
  detection design); out of scope here (this FID changes block scope,
  not the credit mechanism); recorded on the learning agenda as a
  candidate finding for operator routing.
- **CHANGE DELTA:** `pre-write-gates-law3.ts` + `pre-write-gates-paths.ts`
  new; `pre-write-gates.ts` reworked (kept under the 300-line ceiling);
  4 test files (law3 suite rewritten, 3 adjacent suites updated);
  `runPreWriteGates` signature and all import sites unchanged.

### Loop 3 — Final convergence

- **RED:** Converged — cycle root-caused with primary-source evidence;
  repro pin merged (Loop 2 RED).
- **GREEN:** Converged — two-part rule live in the working tree
  (uncommitted, G2-pending).
- **AUDIT:** Converged — all declared gates exit 0 (receipt below);
  eslint 0 warnings; markdownlint clean; manual re-read clean.
- **ADVERSARIAL:** Converged — challenges resolved; one pre-existing
  credit-integrity gap honestly flagged to the agenda (Loop 2).
- **CHANGE DELTA:** Final: see Loop 2 CHANGE DELTA; none after receipt
  stamp.

## Resolution

- **Closed Date:** pending G2 commit (operator authorization)
- **Fix Description:** Law 3 pre-write gate narrowed to the target file
  (hard block kept); other-file dirtiness demoted to a steering advisory;
  turn-end Law 15 unchanged as the invariant boundary
- **Tests Added:** `pre-write-gates-law3.test.ts` (two-part contract +
  credit-mechanism pin, 13 pass / 0 fail); three adjacent suites updated
  for the narrowed scope
- **Verification Evidence:** receipt below (typecheck/test/quality exit
  0); full battery in the session summary
- **Archived:** pending G2 (moves to `dev/fids/archive/` with the commit)

## Lessons Learned

A hard gate that blocks *forward progress* on a property enforced elsewhere
(turn end) turns any intermediate invalid state into a deadlock. Gate at the
boundary that owns the invariant; advise at intermediate steps. A
suppression/blocking predicate over "other files" must never make the repair
itself unwritable.
