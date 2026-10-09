# FID: Atria handoff friction P1 and P5 — Law 3 batch-edit collision and the missing green→complete edge

**Filename:** `FID-2026-1007-015-atria-harness-friction-p1-p5.md`
**ID:** FID-2026-1007-015
**Severity:** low
**Status:** closed
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

Formal FID for the two live friction points in
`dev/build-orders/BO-2026-09-16-atria-friction.md`, a handoff catalog that
recorded six harness problems during the Atria provider integration
(`FID-2026-0916-005`, since archived). P6 is fixed. P1 and P5 are still
reproducible seven months-later, and neither ever became a FID.

**P1** — the Law 3 pre-write gate blocks writing to a *different* file while
another dirty file is unverified, colliding with the "batch all writes, then
typecheck once" guidance. **P5** — the FSM has no direct `green → complete`
edge, so inline verification after GREEN cannot close the loop.

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `tsc --noEmit`, `eslint`, `bun test`
- **Commit/State:** uncommitted working tree

## Detailed Description

### Problem — P1

`pre-write-gates-law3.ts:183-195` blocks on "other-dirty" state: any write to a
file that is not itself the dirty-unverified file is refused while *any* dirty
file lacks verification. The working guidance says batch the writes and verify
once; the gate demands per-file verification between them. An editing session
doing N files needs N+1 verification round-trips.

The block is now guarded by three carve-outs (a verification-command escape, a
failure-attribution exemption, and a `self_correct` phase allowance), so the
blast radius shrank — but the collision is intact.

### Problem — P5

`transition-phase.ts:40` defines `green: ['audit', 'idle']`. A direct
`green → complete` transition is rejected, so a run that verified inline after
GREEN cannot close the loop and must detour through `idle`, leaving the loop
visibly unclosed.

### Expected Behavior

- **P1:** Batch-editing a set of files, then verifying once, does not require
  per-file verification between edits.
- **P5:** A GREEN run whose work is already verified can transition to
  `complete`, as `self_correct` already can.

### Root Cause

Both are policy/implementation mismatches rather than bugs. P1 is a Law 3
strictness question the handoff explicitly left open ("is the per-file gate's
strictness intended, or an EHEL/guidance mismatch worth reconciling?"). P5 is a
transition-map omission — the inline-verification optimization is documented for
`GREEN → inline verification` but never wired as a `green → complete` edge.

### Evidence

Measured 2026-10-07:

```text
$ Select-String -Path ".../pre-write-gates-law3.ts" -Pattern "Other-dirty"
183:  // ── Other-dirty BLOCK (restored, FID-2026-1001-003 step 4) ─────────
188:  return { blocked: true, reason: `Law 3: Verify before proceeding — ...` }

$ Select-String -Path ".../transition-phase.ts" -Pattern "green:"
40:  green: ['audit', 'idle'], // abort from green
```

P6, for contrast — already fixed, cited here so the fix pattern is on record:

```text
packages/agent-runtime/src/echo/enforcement/tool-pipeline.ts:277
  if (classifyFileKind(path) === 'code' && hasWiringDeclaration(content)) {
    self.state.featuresWired.add(path)
  }
```

## Impact Assessment

### Affected Components

- P1: `packages/agent-runtime/src/echo/pre-write-gates-law3.ts`, its tests
- P5: `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts`, its tests

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

> P1 touches a Law 3 gate, so a wrong fix would weaken process enforcement —
> ranked low for impact, but the change must not be taken lightly.

## Proposed Solution

### Approach

Both need an operator ruling on intended behavior before implementation; neither
is a mechanical fix. The FID exists to make them trackable items rather than
prose in an archived handoff.

### Steps

1. **P1 — decide the intent.** Either (a) the per-file gate is intended and the
   *guidance* should be corrected to match, or (b) the gate should credit a
   whole batch. If (b), the design question is what makes a set "one batch" —
   a declared write set, a session phase, or a time window — and that
   specification does not exist yet.
2. **P5 — add the edge** (if approved): `green: ['audit', 'complete', 'idle']`,
   with a guard that `complete` from `green` requires verification credit, so
   the shortcut cannot bypass Law 3 the way an unguarded edge would. Test:
   `green → complete` allowed with credit; blocked without.
3. RED pins for whichever are approved.

### Verification

```bash
bun test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts
bun test packages/agent-runtime/src/tools/handlers/tool/__tests__/transition-phase.test.ts
bun run --cwd=packages/agent-runtime typecheck
bun x eslint packages/agent-runtime/src --max-warnings 0
bun run lint:md
bun run quality:report
```

## Verification Gates

- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/law3-credit-mechanism.test.ts
- gate: test packages/agent-runtime/src/tools/handlers/tool/__tests__/transition-phase.test.ts
- gate: typecheck packages/agent-runtime
- gate: quality

### Verification Receipt

- fingerprint: sha256:70bab2f3528feadbdb505ce1344fffdf76b075988fb45d01ca93168e186d2020
- verified: 2026-10-09T00:17:31.580Z
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/law3-credit-mechanism.test.ts: exit 0
- test packages/agent-runtime/src/tools/handlers/tool/__tests__/transition-phase.test.ts: exit 0
- typecheck packages/agent-runtime: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** P1 reproducible at `pre-write-gates-law3.ts:183-195`; P5 reproducible
  at `transition-phase.ts:40`. Neither has a FID.
- **GREEN:** Not reached — both require an operator ruling on intended behavior.
- **AUDIT / ADVERSARIAL:** Not reached.
- **CHANGE DELTA:** n/a

### Missed Questions

1. **Is P1 actually a problem, or correct enforcement?** → Undecided, and the
   decision belongs to the operator. A handoff asking the question is not a
   mandate to change the answer, and the block was deliberately *restored*
   (`FID-2026-1001-003` step 4, over an earlier demotion to advisory that was
   itself called "attribution laundering"). That history argues against touching
   it without a deliberate ruling.
2. **Would a `green → complete` edge weaken the loop?** → It would if
   unguarded. `self_correct → complete` already exists as a precedent
   (`transition-phase.ts:43`) and carries the same risk, so the precedent is
   mixed: the edge is defensible only with an explicit verification-credit guard.
3. **Why did this decay?** → The handoff was filed as documentation with "fixes
   left to the next engineer" and no register line, so nothing re-read it. Same
   root cause as the build-order cleanup this FID sits beside.

### Loop 2 — full-perfection pass, GREEN fold (2026-10-08, operator-triggered)

RED re-confirmed today: the other-dirty BLOCK is live
(`pre-write-gates-law3.ts` → the `Other-dirty BLOCK` branch) with its three
carve-outs; `transition-phase.ts` still maps `green: ['audit', 'idle']` while
`self_correct: ['green', 'complete', 'idle']` exists.

GREEN fold — missed questions answered:

1. The gate is an intentionally restored control (operator Ruling 1, recorded in
   the gate's own header) and passes all Five Questions. The only non-ruling
   change is guidance-side (batch planning + verify-after-write cadence) or a
   narrower conveyance (a `targetFiles`/`selfDirty` verification-credit lane),
   never a relaxation of the block.
2. Trace-first precondition: classify block triggers (in-batch / self-dirty /
   external-dirty) from `dev/experiences/raw-traces.jsonl` before proposing any
   behavior change.
3. P5 predicate (folded into the plan): `green → complete` requires verification
   credit — a tool-mediated verification event (typecheck/lint/test, exit 0)
   that postdates the last write, satisfying ECHO.md's documented AUDIT-skip
   criteria (< 10 lines, single file, inline gates pass). No credit → the edge is
   refused. Test both legs.

Named operator decision: P1 intent — does Ruling 1 permit any gate-behavior
change at all? Until ruled, P1 ships nothing.

### Loop 3 — RULINGS RECEIVED AND IMPLEMENTED (2026-10-08)

Both frictions were ruled by the operator in this session and are now
implemented.

**P1 ruling, verbatim: "verify once seems optimal" (2026-10-08).** The
other-dirty branch of the Law 3 gate becomes an ADVISORY while the caller is in
the `green` implementation phase: an N-file batch costs ONE verification
round-trip instead of N+1. This supersedes the strict reading of Ruling 1 for
`green` only — the operator set it explicitly, recorded here. Law 3 is still
enforced at the batch boundary, three ways:

- the TARGET-dirty leg ("verify before re-editing") is unchanged in every
  phase, including `green`;
- turn-end Law 15 (`enforcement/turn-end.ts`) still refuses to end a turn with
  unverified files — the one green run is mandatory before the turn closes;
- outside `green` (audit, adversarial, self_correct, idle) the branch remains
  the hard block Ruling 1 restored, and the N=3 escalation ladder keeps keying
  on it there. An undefined/typo'd phase fails CLOSED to the block.

**P5 ruling: "Approve" (2026-10-08, structured answer).** The `green →
complete` edge is added, guarded: the transition handler reads the enforcement
layer's own cumulative credit flag `hasVerifiedSinceLastDirty`
(FID-2026-0819-001 — set by a green verification run after the last dirtying
write, revoked by any later write) through the SAME cached
`getOrCreateEnforcement(agentState)` instance the executor's EHEL gate uses —
no parallel state. No credit → the edge is refused with remediation text;
`green → audit`/`idle` remain the lawful detours. A fresh state starts clean
(`hasVerifiedSinceLastDirty: true` by contract), so zero writes → edge lawful,
consistent with turn-end Law 15 on an empty dirty set.

**Implementation evidence (all measured on this tree):**

- `packages/agent-runtime/src/echo/pre-write-gates-law3.ts` — other-dirty
  branch: `if (fsmPhase === 'green')` → advisory citing the ruling; hard block
  retained for every other phase. Header history updated.
- `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` —
  `green: ['audit', 'complete', 'idle']` + the credit guard refusing the edge
  without `hasVerifiedSinceLastDirty`, resolved via
  `getOrCreateEnforcement(params.agentState)` (factory cache = the EHEL
  instance).
- Pins: `pre-write-gates-law3.test.ts` gains the batch-verify-once suite
  (green advisory, target-dirty still blocks in green, audit/adversarial keep
  the block, undefined phase fails closed); `transition-phase.test.ts` gains
  the P5 suite (allowed with credit, refused without, refused when a write
  postdates the run, fresh-state lawful, `green → audit` intact).
- Gates: `bun test` on `pre-write-gates-law3.test.ts`,
  `law3-credit-mechanism.test.ts`, and `transition-phase.test.ts` → **30
  pass / 0 fail**; full `bun test src/echo/` → **348 pass / 0 fail** (40
  files, before the ceiling split); `bun run --cwd=packages/agent-runtime
  typecheck` → **exit 0**. The executor dispatch (`native.ts`) is
  byte-identical to its pre-change state (the factory-based approach needed
  no executor threading — verified by `git diff
  src/tools/tool-executor/native.ts` = empty).
- Quality-ceiling split: the extended `pre-write-gates-law3.test.ts` crossed
  300 lines (346); the pre-existing credit-mechanism describe block moved
  verbatim to `law3-credit-mechanism.test.ts` (245 + 112 lines, 30/0 across
  the three files re-verified after the move).

Missed questions answered at implementation time:

1. **Why not thread `enforcement` through the handler params?** The handler
   slot type (`SavantCodeToolHandlerFunction`) is a fixed contract; adding a
   field type-errors at the dispatch site (measured: `TS2353`). The factory
   cache returns the same instance per `agentState`, so reading it inside the
   handler is the Law 13-compliant one-truth route with zero dispatch changes.
2. **Does the green advisory weaken the escalation ladder?** No — the ladder
   keys on `recordLawBlock`, which the green path never calls (it returns an
   advisory). Outside green, blocks feed the ladder exactly as before.
3. **Can a run game the P5 guard by ordering a green run before its writes?**
   No — that is precisely the `write-after-run` pin: any write after the run
   revokes the flag, and the edge refuses again.

## Resolution

- **Closed Date:** 2026-10-08
- **Fix Description:** P1 — the Law 3 other-dirty branch is advisory in the
  `green` phase (operator ruling 2026-10-08, verbatim "verify once seems
  optimal"): an N-file batch costs ONE verification round-trip instead of
  N+1. Law 3 still holds at the batch boundary three ways — the target-dirty
  leg hard-blocks in every phase including `green`, turn-end Law 15 refuses
  to end a turn with unverified files, and outside `green` the branch
  remains the hard block Ruling 1 restored (an undefined phase fails
  closed). P5 — the `green → complete` edge is added and guarded: the
  transition handler reads the enforcement layer's cumulative
  `hasVerifiedSinceLastDirty` through the SAME cached
  `getOrCreateEnforcement(agentState)` instance the EHEL gate uses; no
  credit → the edge is refused with remediation text, and any write after
  the run revokes the flag.
- **Tests Added:** Yes — 5 pins in `pre-write-gates-law3.test.ts` (the
  batch-verify-once suite), 5 pins in `transition-phase.test.ts` (the P5
  guard suite), and the credit-mechanism suite relocated verbatim to
  `law3-credit-mechanism.test.ts` (no content change).
- **Verification Evidence:** implementation commit `4eaf57cc`; gates 5/5
  exit 0 — receipt `sha256:ac2056d9…`, re-verified live
  2026-10-08T23:45:56Z and re-stamped at the archived path. Loop 3 records
  30 pass / 0 fail across the three suites and 348 pass / 0 fail across
  `src/echo/` (40 files); `typecheck` exit 0.
- **Source:** `dev/build-orders/BO-2026-09-16-atria-friction.md`
- **Archived:** 2026-10-08 — moved to `dev/fids/archive/` on the operator's
  closure authorization; register item T164-F complete and evicted from
  `SCOPE.md`.

### Code Verification Evidence

Status is `closed` (was `fixed`) — both frictions implemented and gate-verified (Loop 3).
The original RED evidence is retained below for the record; both quoted sites
have changed as described in Loop 3, and the suites pin the new behavior in
both directions.

Original RED (2026-10-07): both findings are presence
checks with quoted code, reproduced in Evidence so a reader can confirm the
friction reproduces: `pre-write-gates-law3.ts:183-195` (the other-dirty
block) and `transition-phase.ts:40` (`green: ['audit', 'idle']`). The P6 fix at
`enforcement/tool-pipeline.ts:277` is quoted alongside so the contrast between a
resolved and an unresolved friction point is inspectable in one place.

## Lessons Learned

**A handoff with no register line is a note, not a work item.** Six problems were
catalogued carefully with file-level evidence; one was fixed within days, two are
still reproducible seven months later, and none became tracked work — because
"left to the next engineer" is a disposition no register line ever received.
