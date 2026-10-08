# FID: Atria handoff friction P1 and P5 — Law 3 batch-edit collision and the missing green→complete edge

**Filename:** `FID-2026-1007-015-atria-harness-friction-p1-p5.md`
**ID:** FID-2026-1007-015
**Severity:** low
**Status:** created
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

None — `created` status; gates declared at implementation time.

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

## Resolution

- **Closed Date:** pending
- **Fix Description:** pending
- **Tests Added:** pending
- **Verification Evidence:** pending
- **Source:** `dev/build-orders/BO-2026-09-16-atria-friction.md`
- **Archived:** pending

### Code Verification Evidence

Status is `created` — no implementation exists. Both findings are presence
checks with quoted code, reproduced in Evidence so a reader can confirm the
friction still reproduces: `pre-write-gates-law3.ts:183-195` (the other-dirty
block) and `transition-phase.ts:40` (`green: ['audit', 'idle']`). The P6 fix at
`enforcement/tool-pipeline.ts:277` is quoted alongside so the contrast between a
resolved and an unresolved friction point is inspectable in one place.

## Lessons Learned

**A handoff with no register line is a note, not a work item.** Six problems were
catalogued carefully with file-level evidence; one was fixed within days, two are
still reproducible seven months later, and none became tracked work — because
"left to the next engineer" is a disposition no register line ever received.