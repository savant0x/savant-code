# FID: The lessons ledger's size ceiling is enforced by nothing

**Filename:** `FID-2026-1012-011-learnings-size-ceiling-ungated.md`
**ID:** FID-2026-1012-011
**Severity:** high
**Status:** fixed
**Created:** 2026-10-12 19:05
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)

---

## Summary

`dev/LEARNINGS.md` has a documented size ceiling — `DEFAULT_LINE_CAP = 1200` in
`scripts/learnings-retire.ts:29` — and a repository-wide grep for that constant returns only
the retirement tool itself (lines 29, 82, 212). No gate reads it, and `bun run learnings:check`
(PASS today) carries no size rule of its own, so the ceiling can only be discovered by the
component that runs when a human asks it to. The ledger is at 1,174 lines, **26 lines under
the ceiling**: the next lesson written into it breaches the cap, and nothing would say so.
Retirement is operator-run and manual, and its only output is an append to the archive, so the
cheapest available control on an unbounded boot-read artifact is also its least observable one.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `bun run learnings:check`; `bun run learnings:retire [--dry-run] [--cap <lines>]`
- **Commit/State:** `main` @ `14d48820`

## Detailed Description

### Problem

Three properties compound into an ungated ceiling:

1. **The ceiling lives in the tool that acts on it.** `DEFAULT_LINE_CAP` is defined in and read
   only by `scripts/learnings-retire.ts` (lines 29, 82, 212). A value that only the repair tool
   knows cannot announce a breach; the gate battery, `learnings:check`, and
   `validate:repository` all pass over a ledger of any length.
2. **The ceiling is nearly reached.** 1,174 of 1,200 lines, i.e. 26 lines of headroom, against
   a 16-day accumulation of 34 governed lessons (2026-09-27 → 2026-10-12).
3. **Relief is manual and coarse.** The retirement run in `ac4bad20` moved 972 lines out of the
   live ledger into `dev/LEARNINGS-RETIRED.md` (2,146 → 1,174 lines, 1,057 lines added to the
   archive). It works, but it is a whole-entry move performed by a human, and its only record
   is the archive append plus git.

The consequence is that the repository's own count of lessons is not a controlled quantity: it
grows until someone notices, and the notice arrives as a boot read that is either truncated
(FID-2026-1012-010) or paid for in context by every session.

### Expected Behavior

A ledger past either ceiling fails the repository gate that already exists for the ledger
(`learnings:check`, and therefore `validate:repository`), and the failure message names the
headroom and the command that restores it. Retirement is still the operator's decision, but it
leaves a machine-readable record of what moved, when and why, so the ledger's size has an
audit trail instead of only a git history.

### Root Cause

The ceiling was placed on the *tool* rather than on the *artifact*. `scripts/learnings-retire.ts`
is a move-only executor with an operator-facing CLI; encoding the limit there made it a
parameter of the operation instead of an invariant of the file. And because the ledger is
boot-read (FID-2026-1012-010), the artifact's size is a correctness property of the harness,
not a housekeeping preference — which is exactly the class of property this repository
otherwise gates.

### Evidence

```text
$ grep -rn 'DEFAULT_LINE_CAP' scripts/*.ts
scripts/learnings-retire.ts:29:export const DEFAULT_LINE_CAP = 1200
scripts/learnings-retire.ts:82:  const cap = opts.cap ?? DEFAULT_LINE_CAP
scripts/learnings-retire.ts:212:  if (index === -1) return DEFAULT_LINE_CAP
# ^ the only three references in the repository: the ceiling is known only to the tool

$ bun run learnings:check
learnings: PASS (34 structured entries; 3 narrative entries below boundary — unvalidated by design)
# ^ no size rule fires; the check is green at 1,174 lines and would be green at 5,000

$ wc -l < dev/LEARNINGS.md
1174
$ wc -c < dev/LEARNINGS.md
77195
# headroom: 1200 - 1174 = 26 lines; 100000 - 77195 = 22,805 chars

$ git show --stat --oneline ac4bad20 -- dev/LEARNINGS.md dev/LEARNINGS-RETIRED.md
ac4bad20 chore(release): bump to v0.0.36 and land the operator decision round
 dev/LEARNINGS-RETIRED.md | 1057 ++++++++++++++++++++++++++++++++++++++++++++++
 dev/LEARNINGS.md         |  972 ------------------------------------------
# 2,146 -> 1,174 lines in one operator-run pass; whole entries moved, none merged or trimmed
```

The governed-entry dates in the ledger run from 2026-09-27 to 2026-10-12: 34 entries in 16
days, with no ceiling in the loop that would have stopped at 1,200.

## Impact Assessment

### Affected Components

- `dev/LEARNINGS.md` — the artifact whose size is uncontrolled
- `scripts/learnings-retire.ts` — the only holder of the ceiling, and the retirement executor
- `scripts/learnings.ts` / `scripts/learnings-validation.ts` — the validator that should carry
  the rule and does not
- `scripts/validate-repository.ts` — the repo gate that would surface it
- Every boot read (via FID-2026-1012-010) and every whole-file consumer (review §3 A2)

### Risk Level

- [x] High: the boot-read artifact can breach its ceiling with no gate, no error and no record
- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Move the ceiling from the tool to the validator, and give retirement a durable record. Both
ceilings matter: the line ceiling is the ledger's own invariant, and the char ceiling protects
the boot boundary (FID-2026-1012-010), which truncates on characters rather than lines.

### Steps

1. Move the line ceiling (and add a char ceiling, matching the boot boundary's unit) into the
   validator so `learnings:check` — already wired into `validate:repository` — fails on a
   breach of either.
2. Make the breach message specific: the measure breached, its current value, the headroom (or
   overrun), and the command that restores the ledger.
3. Add the headroom to the pass output as well, so the approaching limit is visible while the
   gate is green rather than only when it fails.
4. Have retirement emit a machine-readable move record (`title`, `date`, `reason`,
   `destination`) as its own durable artifact, so a retired lesson's location is resolvable and
   the ledger's size has an audit trail (also consumed by FID-2026-1012-012).
5. Keep the operator-run boundary explicit: the gate reports, the operator retires; no
   automated deletion of lesson content, ever.

### Verification

How the fix will be confirmed, all of it at implementation time:

- A pin asserting a synthetic ledger one line over the ceiling fails, and one at the ceiling
  passes — proven in both directions, not just the green case.
- A pin asserting a synthetic ledger over the **char** ceiling fails independently of the line
  count, so the boot boundary is protected on its own unit.
- A pin asserting the failure message names the measure, the value and the restoring command.
- A pin asserting a retirement run produces a move record whose entries resolve back to the
  destination, and that `learnings:check` passes after retirement.
- `bun run validate:repository` fails with the gated ledger and passes with the current one.

Exact artifact paths and their `- gate:` declarations are recorded when the artifacts exist.

## Verification Gates

- gate: test scripts/__tests__/learnings-size-policy.test.ts
- gate: test scripts/__tests__/learnings-retire.test.ts
- gate: probe scripts/learnings.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:ef35ba484253b5bd854f8974cdf5c29d0671cfcd2dc77d2fd4a90f6e6c4f2c4d
- verified: 2026-10-13T05:04:13.889Z
- test scripts/__tests__/learnings-size-policy.test.ts: exit 0
- test scripts/__tests__/learnings-retire.test.ts: exit 0
- probe scripts/learnings.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** the 1,200-line ceiling exists only inside `scripts/learnings-retire.ts` (three
  references, all in that file); `learnings:check` passes at 1,174 lines and has no size rule;
  the ledger is 26 lines from the cap after 34 entries in 16 days; the only relief is a
  manual, whole-entry, operator-run retirement that moved 972 lines in `ac4bad20`.
- **GREEN:** move both ceilings into the validator (line + char), report headroom on pass,
  name the measure and the restoring command on failure, and emit a machine-readable move
  record from retirement.
- **AUDIT:** the three `DEFAULT_LINE_CAP` references are cited from a repository-wide grep; the
  green-check transcript is from `bun run learnings:check` on this tree; the line and char
  counts are from `wc`; the retirement volume is from `git show --stat` of `ac4bad20`.
- **ADVERSARIAL:** (a) Does gating the ceiling block legitimate work? It blocks writing past
  the ceiling without retiring — the operator can raise `--cap` explicitly, which is a recorded
  decision rather than a silent overrun. (b) Is a char ceiling redundant with the line ceiling?
  No: entries vary by an order of magnitude in line length (up to ~30-line `Failure` prose), so
  the two limits fail on different inputs. (c) Does this fight FID-2026-1012-010? No — they
  meet at the same boundary from opposite sides: 010 bounds what is *booted*, 011 bounds what
  is *stored*, and the digest makes the ledger's own size less load-bearing over time.
- **CHANGE DELTA:** n/a — pre-implementation record; no ledger content was edited by this pass.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** `DEFAULT_LINE_CAP` still has only three production references, all inside
  retirement. `learnings:check` exits 0. The retirement unit is 1,175 split-line
  segments, not 1,174 newline characters; current headroom is 25 segments.
- **GREEN:** Apply the shared review contract in `docs/design/perfection-loop-2026-10-12.md`:
  one policy for 1,200 logical lines and 100,000 JavaScript characters, exact unit labels,
  and an operator-run character-aware repair. Append move receipts only after verified
  archival; interruption and retry preserve content and idempotency.
- **AUDIT:** Existing retirement suite passes within the 45-test scripts baseline;
  it proves current move behaviour, not the proposed ceiling or receipt transaction.
- **ADVERSARIAL / missed question:** Does raising `--cap` raise the validator policy?
  No. Does a byte count prove the character ceiling? No. Pin independent breaches and
  real write-interruption recovery at the planned paths in the shared artifact table.
- **CHANGE DELTA:** Planning correction only; no retirement or source edit occurred.

### Loop 3 — Implementation (2026-10-13)

- **RED (re-measured at implementation time, `main` @ `a827de8d`):** `grep -rn 'DEFAULT_LINE_CAP'
  scripts/*.ts` still returned only `scripts/learnings-retire.ts`; `bun run learnings:check` exited 0;
  the ledger measured **1,175 logical lines (newline-delimited segments) and 76,775 JavaScript
  characters** — **25 lines and 23,225 characters** of headroom, exactly the split-line unit Loop 2
  recorded. Both ceilings were unreachable by either gate.
- **GREEN:** the policy moved to the artifact. `scripts/learnings-size-policy.ts` owns the line ceiling
  (1,200 logical lines, the unit retirement measures) and the character ceiling (100,000 JavaScript
  characters — UTF-16 code units — the unit the boot boundary truncates on); `validateLearnings`
  carries its issues, so `learnings:check` — already wired into `validate:repository` — fails on either
  breach; the pass output now reports headroom; and retirement appends a machine-readable move record
  (`dev/learnings-move-log.jsonl`: `title`, `date`, `reason`, `destination`, `retiredAt`,
  `linesBefore`, `linesAfter`) **after** the archive and the ledger rewrite have both succeeded, so a
  receipt never describes a move that did not finish.
- **AUDIT — both directions were run on the real gate, and reverted:**
  - Green: `bun run learnings:check` exits 0 and now prints `1,175/1,200 logical lines, 76,775/100,000
    JavaScript characters (25 lines, 23,225 characters of headroom)`.
  - Red: with 30 blank lines temporarily appended to `dev/LEARNINGS.md`, `bun run learnings:check`
    **exits 1** with `[learning.size.line-ceiling] dev/LEARNINGS.md is 1,205 logical lines
    (newline-delimited segments) against a ceiling of 1,200 — 5 over. Restore headroom with
    \`bun run learnings:retire\` (operator-run, move-only: nothing is deleted).`
  - Restored: the file was copied back byte-identically (`git diff --stat` clean), `learnings:check`
    exits 0 again.
  - The move record is pinned by a fixture run: the JSONL resolves each title back to the archive, and
    a second run under the cap appends no further receipt.
- **ADVERSARIAL — what the gate still does not do:** (a) it cannot make the operator retire; it makes a
  breach impossible to miss, which is the whole finding; (b) `--cap` remains a retirement-only override
  and does **not** move the validator's ceilings — raising the limit is now a source change, i.e. a
  recorded decision; (c) the character ceiling is measured in JavaScript characters, not bytes (Loop 2's
  warning), so the two measures fail on different inputs by construction.
- **Also found, while gating this lane:** `fid:verify` accepts `typecheck <workspace>` only for workspaces
  in `VALIDATION_WORKSPACE_POLICY`, and **`scripts/` is not one of them**. A change in the scripts tree
  can therefore pass every declarable gate while failing the root `typecheck`'s scripts leg — which is
  exactly what happened here: `scripts/__tests__/experiences-coverage.test.ts` (FID-2026-1012-021) used
  `triggerType: 'tool-failure'` instead of `'tool_failure'`, its declared gates passed, and the root
  `typecheck` caught it. Fixed here; recorded in `-021`'s Loop 3 as a gate-vocabulary gap rather than
  left for the next lane to rediscover.
- **CHANGE DELTA:** +1 policy module and +1 test file; the validator, the check's output and the
  retirement tool changed. Nothing was retired, no ceiling value changed, and no ledger content was
  edited by this pass.

### Missed Questions

1. Should the ceiling rise instead of being enforced? → Enforcement first. Raising a limit
   whose breach is invisible moves the discovery to the next truncation; the review records the
   boot cost as the reason the ceiling exists. A different number is a separate, evidenced
   decision once the boot budget (FID-2026-1012-010) is pinned.
2. Who retires, and can it be automated? → The operator, per AGENTS.md. The gate can only
   report; an automated retire would silently delete the repository's own incident history.
   The machine-readable move record is what makes the manual step auditable rather than opaque.
3. Does the ledger need a *lower* bound — a rule against retiring too much? → Yes, implicitly:
   retirement is move-only and append-only in the archive, and FID-2026-1012-012 makes a
   retired title resolvable, so a lesson moved out of the boot read is still findable. The
   guard against over-retirement is that nothing is ever deleted, which the existing archive
   contract already states.

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing in this
> record has been implemented, so what follows records what was CHECKED at the cited
> `HEAD` — not what was built.

- [x] Every cited path exists at `main` @ `14d48820`, read directly at review time; the raw
      measurements live in `docs/design/learnings-boot-loading-and-lifecycle-review.md` §2/§3,
      which this record expands.
- [x] Measurements re-checked: `grep -rn DEFAULT_LINE_CAP scripts/*.ts` returns only
      `scripts/learnings-retire.ts` (lines 29, 82, 212) — no gate reads it;
      `bun run learnings:check` passes today with no size rule of its own; the ledger stands at
      1,174 lines against the 1,200-line ceiling (26 lines of headroom); the retirement in
      `ac4bad20` moved 972 lines into `dev/LEARNINGS-RETIRED.md`.
- [x] **Not yet true, and deliberately not claimed:** the repair itself, its gates and its
      receipt. Gates are declared when the status flips to `fixed`/`verified` and the
      artifacts exist; declaring them now would be a false declaration.

## Boundaries

- This record does not retire anything, does not change the ceiling's value, and does not
  claim the ledger is over a limit today — it is 26 lines under, which is the finding.
- No gate output is claimed: the record is pre-implementation and declares no gates.
- The dependencies are recorded rather than resolved here: FID-2026-1012-010 (a boot digest
  changes what the char ceiling protects) and FID-2026-1012-012 (which consumes the move
  record this record introduces).

## Resolution

**Implemented — `Status: fixed` (deterministic gates green; the operator boundary unchanged).**

- **Closed Date:** 2026-10-13.
- **Fix Description.** The ceiling is no longer a parameter of the repair tool: it is an invariant of
  the artifact, enforced where the artifact is validated. `scripts/learnings-size-policy.ts` owns both
  measures — 1,200 **logical lines** (newline-delimited segments, the unit `learnings:retire` reports)
  and 100,000 **JavaScript characters** (UTF-16 code units, the unit the boot boundary truncates on) —
  and `validateLearnings` carries its issues, so `bun run learnings:check` (and therefore
  `validate:repository`) fails on either breach with a message naming the measure, the value, the
  overage and the restoring command. The pass output reports headroom so the limit is visible while the
  gate is green. Retirement remains operator-run and move-only, but now emits
  `dev/learnings-move-log.jsonl` — one JSON object per completed move with `title`, `date`, `reason`,
  `destination`, `retiredAt` and the before/after line counts — written after both file writes succeed.
- **Tests Added:** `scripts/__tests__/learnings-size-policy.test.ts` (6 cases: the segment unit; at the
  ceiling passes; one line over fails naming measure/value/overage/command; the char ceiling fails
  independently of the line count; both breaches reported together; headroom in the summary) and one new
  case in `scripts/__tests__/learnings-retire.test.ts` (the move record is written with every field,
  resolves back to the archive, and is not appended again when nothing moves).
- **Verification Evidence:** `bun test scripts/__tests__/learnings-size-policy.test.ts
  scripts/__tests__/learnings-retire.test.ts` 15 pass / 0 fail · `bun run learnings:check` exit 0 with
  headroom printed, and **exit 1** with the named `learning.size.line-ceiling` message when 30 lines are
  temporarily appended (reverted byte-identically) · `bun run typecheck` (root, including the `scripts/`
  leg) exit 0 · `validate:repository` PASS · `quality:report` PASS · ESLint `--max-warnings 0` and
  Prettier clean.
- **Archived:** not archived; the master (`FID-2026-1012-022`) closes last.
- **Open, and stated rather than implied:** (a) `FID-2026-1012-012` still has to *consume* the move record
  — this record produces it; (b) `FID-2026-1012-010` owns the boot digest that will make the character
  ceiling less load-bearing; (c) the `fid:verify` gate vocabulary has no scripts-tree typecheck, so the
  root `typecheck` remains a hand-run check for scripts-lane records (recorded in `-021`).

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the review).
- **Design record:** `docs/design/learnings-boot-loading-and-lifecycle-review.md` §3 rows A3
  and A4, §4 feature F3.
- **Ordering:** Introduces the machine-readable move record that FID-2026-1012-012 consumes;
  shares its ceiling surface with FID-2026-1012-010.
