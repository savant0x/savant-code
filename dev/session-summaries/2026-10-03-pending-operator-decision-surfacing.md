# Pending operator decision surfacing — 2026-10-03

Resumed from a crashed Freebuff session (`dev/scratchpad/archive/2026-10-03-freebuff-crash-dump.txt`)
and completed the in-flight work: `FID-2026-1003-007`, the mechanism that surfaces register items
blocked on an operator ruling.

Intent before implementation: finish what the crash left half-done, and treat every gate failure as
a work item rather than a report. Nothing in the register was re-scoped, trimmed, or reclassified.

## What was already on disk

The implementation, the FID, the register rewrite, and the CHANGELOG entry had all landed before
the crash. The register's T119 and T62-followups normalization was already present. Verified rather
than assumed: the suite ran 11/11, and `SCOPE.md` read 0-EOF.

## What the crashed session had not done

The FID was marked `closed` but still sat in the active queue — auto-archive never ran, which
`validate:repository` caught as a non-active status in the active directory. The crash dump itself
was also sitting in the scratchpad root, which the same gate flags as clutter.

## Two defects the live run exposed that the pins did not cover

**The mechanism surfaced itself.** The first live run reported `FID-2026-1003-007` as a pending
decision with the blocker "operator ruling for weeks because nothing presented them". That item's
register entry *quotes* the `**Blocker:**` convention mid-sentence to describe the very failure the
mechanism fixes, and the parser could not tell a quotation from a declaration. This is worse than
silence: the mechanism would have asked the operator for a ruling it was itself delivering, on every
session end. Fixed by requiring a **declaration** — a line-leading `**Blocker:**` on the item's own
continuation line, which is the register's actual convention — with capture starting at that
declaration so an item that quotes first and declares later still reads its own blocker. Third pin
added: a quoting item yields no decision while a genuinely blocked sibling still surfaces.

**A fixed character budget ignored its own prefix.** The blocker line sliced to 110 characters and
then prefixed 15 more, rendering 125 columns against MD013's 120 bound — `lint:md` failed on the
real agenda. The budget is now computed as the remainder after each line's own rendered prefix, so
a longer id shortens the summary rather than overflowing. Fourth pin asserts every agenda line stays
within the bound, using an over-long id as the case that would have overflowed.

Neither was visible from a passing suite. The pins used fixture prose that never quoted the
convention, so only a run against the real register could catch the first; the second was only ever
reachable through a markdown gate on generated output.

Closing the width pin also forced a real refactor rather than a trim: the new fixtures repeated the
same root-and-write scaffolding, and the test file crossed the 300-line `quality` cap at 308. Per
Law 13 the repeated scaffolding became one `reviewRegister(items)` helper, so all four pins survived
intact (13/13) instead of one being cut to satisfy the cap.

## Register-correction gate

The first `scope-register-check` failed on 4 issues: the FID's evidence section and the register
prose cited completed ruling ids (`T94`, `T83-E`, `T95-B`, `T97`, `T87-B`, `Task 62`) bare. The
completeness module treats an inline-code reference as a quotation of history and a bare one as a
claim on current scope — these were completed items that already left the register on the standing
rule, so they are now written as quotations. PASS, 0 issues.

## Verification

- `scripts/__tests__/session-end-review.test.ts` — 13 pass / 0 fail (4 pins for this FID).
- `typecheck:scripts` — exit 0.
- `scope-register-check` — PASS (0 issues).
- `validate:repository` — PASS.
- `quality:report` — PASS.
- `lint:md` — clean after the line-budget fix.
- Prettier — clean on every touched file.
- ESLint `--max-warnings 0` — clean on the touched sources.
- `learnings:check` — PASS.
- `fid:verify --write` — receipt stamped, both declared gates PASS
  (`test scripts/__tests__/session-end-review.test.ts`, `quality`).

The live agenda now surfaces exactly the three genuine blockers: T119 (xKiro paid-plan access and
the fourth provider's identity), T62-followups (tokenharbor allowance + tokenrouter top-up), and
T122 (savant-free disposition). All three are blocked on operator action external to the repository,
and all three are presented for the next intake.

## Durable records

Two lessons were promoted into `dev/LEARNINGS.md` with catalog entries in
`dev/LEARNING-RULES.md`: a prose parser must separate *describing* a convention from *using* one,
and a truncation budget must include the prefix that renders before it. Both are recorded as
canonical rules because each one cost a live-run defect that no existing pin or unit-level check
could have caught.

## Closure

FID-2026-1003-007 moved to `dev/fids/archive/` with its `- **Archived:**` line; register count
corrected to three open items; CHANGELOG entry added under `Unreleased — 2026-10-03`. Per the
standing 2026-09-28 rule a completed item leaves `SCOPE.md` entirely, so its register line and
machine-readable target were removed.

No commit, push, tag, or release was performed — G2 commit authority is not granted. A
path-scoped staging plan is available on request.

## Note on the test gate

`gate: test scripts/__tests__/session-end-review.test.ts` runs from the repo root, where `bun test`
path arguments are substring filters and the gitignored `resources/` tree makes the sweep exceed
three minutes. Running the suite from `scripts/` resolves the filter to exactly one file and
completes in ~100ms. Same T67 class already recorded in `AGENTS.md`; the gate is left as declared
because it passed, but a future FID making this a routine gate should scope it to the workspace root.
