# FID: The recurrence-to-fix loop is open — a class is detected, then routed away from a fix

**Filename:** `FID-2026-1012-021-recurrence-to-fix-loop.md`
**ID:** FID-2026-1012-021
**Severity:** high
**Status:** converged
**Created:** 2026-10-12 20:15
**Automation level:** 2
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-017, FID-2026-1012-018, FID-2026-1012-019, FID-2026-1012-020

---

## Summary

The repository records every tool failure mechanically, detects which classes recur, and then
routes what it learned to artifacts that are **not fixes** — a draft skill, a product
candidate, an advisory agenda line. Nothing turns a recurring class into an owned repair, and
nothing ever checks that a class **stopped** recurring. The evidence is in the numbers: 27 of
68 recorded classes sit at or above the repository's own promotion bar, the agenda has carried
`read_files 41 / read_url 24 / web_search 19` while none of those three has a lesson, an
owning FID or a fix, and every governed lesson in the ledger names an owning FID — which
proves the lesson is written *after* a fix rather than driving one. The ledger therefore
documents the past instead of driving the next change, and its length measures how many
classes are still running unfixed. This record is the **machinery** of the remediation program
`FID-2026-1012-022`: the master holds the census and the per-class allocation (all 68 classes across
six lanes), while this record holds the loop that keeps a class open until it stops recurring.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `ai` 5.0.122
- **Commit/State:** `main` @ `bee0610d`

## Detailed Description

### Problem

Recurrence is detected and then consumed by the wrong consumers. The mechanical capture writes
one immutable record per tool failure to `dev/experiences/raw-traces.jsonl`; `experiences:dedup`
(`scripts/experiences-dedup.ts` — `computeRecurrences`, `DEFAULT_MIN_SESSIONS`) computes
recurrences and requires three failures across **distinct sessions** before a pattern counts;
`scripts/session-end-review.ts` publishes the result as `dev/agenda.md`; and from there the two
downstream producers reach for artifacts that are not defect fixes —
`scripts/lessons-to-skills.ts` drafts a **skill** from a lesson that carries a canonical rule,
and `scripts/lesson-feature-pipeline.ts` drafts a **product candidate** into
`dev/feature-pipeline/candidates.json`. A class can therefore be detected, ranked, published and
acted on without the defect behind it ever acquiring an owner.

Two consequences are measured rather than argued:

- **The ledger covers the wrong population.** Five of the six highest-volume classes have zero
  mention in `dev/LEARNINGS.md` (`grep -ci` returns 0 for `Failed to fetch URL`, `ripgrep`,
  `old string`, `No readable text`, `No change to the file`). The ledger records the
  *interesting* findings — process, architecture, agent behaviour — and misses the *frequent*
  ones, which is why it grows with narrative while the top class runs 114 times unseen.
- **A class can be archived while it is still firing.** The one large class the ledger did
  learn, the incomplete-tool-call family, is dated 2026-08-16 ("A retry that re-emits the same
  oversized tool call is not recovery"), was retired out of the boot read into
  `dev/LEARNINGS-RETIRED.md:1373` in `ac4bad20` on 2026-10-12, and fired 16 more times that
  same day. The lesson left the boot read and the defect did not leave the product.

### Expected Behavior

A class that reaches the promotion bar and has no owning FID becomes a defect FID, and the
record stays open until the class **stops recurring** — proved by the capture, not by a test
suite that passes. The lesson is written last, once the assertion holds, so the ledger records
what was fixed rather than what failed. A top-N recurring class with no owner fails the
repository gate, so the gap cannot sit invisible.

### Root Cause

The pipeline has producers for *guidance* and *features* and none for *repairs*. Recurrence is
treated as a signal to write something down; it is never treated as a commitment to change
code. And because nothing re-reads the capture after a fix, the loop cannot close even when a
fix lands: there is no assertion anywhere that a class stopped, only a lesson asserting that it
was understood. The ledger's own contract reinforces the direction — every governed lesson
carries `**Owning FID:**` (34/34), so a lesson cannot exist before the fix that owns it.

### Evidence

Measured 2026-10-12 from the mechanical capture. The aggregation groups records by
`toolName` + the first line of the error.

```text
$ # recurrence, the bar this repository already uses (FID-2026-1005-003)
$ bun -e '<group dev/experiences/raw-traces.jsonl by toolName+errorFirstLine>'
records=559  classes=70  distinct sessions=195
classes at the repo's own >=3-distinct-session promotion bar: 27

$ # the three classes the agenda has carried, and their ownership
$ grep -n 'read_files\|read_url\|web_search' dev/agenda.md | sed -n '1,6p'
read_files  recurrences: 41 (total 41) — promote via FID when resolved+verified
read_url    recurrences: 24 (total 24) — promote via FID when resolved+verified
web_search  recurrences: 19 (total 22) — promote via FID when resolved+verified
$ # not one of the three has a lesson, an owning FID or a fix

$ # the incomplete-arguments family, the class the ledger DID learn
$ grep -c 'Incomplete arguments for tool' dev/experiences/raw-traces.jsonl
193                       # 35% of all 559 recorded failures
$ grep 'Incomplete arguments for tool' dev/experiences/raw-traces.jsonl \
    | grep -c '2026-10-12'
16                        # still firing on the day the lesson was retired
$ sed -n '1373p' dev/LEARNINGS-RETIRED.md    # the '## Lesson:' heading line
Lesson: A retry that re-emits the same oversized tool call is not recovery

$ # ledger coverage of the top classes (live file, case-insensitive)
Failed to fetch URL   ledger=0
ripgrep               ledger=0
old string            ledger=0
No readable text      ledger=0
No change to the file ledger=0

$ # every governed lesson names the fix that preceded it
$ grep -c '^- \*\*Owning FID:\*\* FID-' dev/LEARNINGS.md
34                        # 34 of 34 governed entries
```

## Impact Assessment

### Affected Components

- `dev/experiences/raw-traces.jsonl` — the capture the loop reads and never re-reads
- `scripts/experiences-dedup.ts`, `scripts/session-end-review.ts`, `dev/agenda.md` — detection
  and publication
- `scripts/lessons-to-skills.ts`, `scripts/lesson-feature-pipeline.ts` — the two producers that
  consume recurrence without filing a repair
- `dev/LEARNINGS.md` — the ledger whose growth is the symptom this record removes the cause of
- `scripts/validate-repository.ts` — where a class-coverage check belongs

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

The dog-fooding loop is the mechanism that is supposed to make this repository improve from its
own failures. It runs daily, produces artifacts, and closes nothing: the top recorded class has
run 114 times without a lesson, and the one class it learned was archived while still firing.
Every session pays for that.

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Treat a class at the promotion bar as a work item, not a note. Draft a FID for any class at or
above the bar with no owning FID; require every fix to declare a **recurrence assertion** in the
capture's own terms; keep the class open until the assertion holds; write the lesson only then;
and gate the coverage so an unowned top-N class fails the repository validation.
Auto-drafting a record is mechanical (automation level 2); approving one is not.

### Steps

1. Classify the capture: one class identity per `toolName` + error class, derived where the
   capture stores enough to derive it.
2. Generate the owner list: every class at or above the ≥3-distinct-session bar, joined to
   `**Owning FID:**` (from the ledger) and to any open FID that names the class.
3. Draft a defect FID for each unowned class at the bar, carrying the class id, the record
   count, the first/last seen dates and the evidence pointer — mechanically, then route it.
4. Require a **recurrence assertion** in the fix's verification: the class must not appear in
   `dev/experiences/raw-traces.jsonl` over the declared window, checked by a probe that reads
   the capture rather than by a unit test.
5. Keep the class open while the assertion is unproven; on proof, write the lesson, with the
   class id and the assertion as its Verification.
6. Add the coverage check to `scripts/validate-repository.ts`: a class at the bar with no owner
   is an issue, named with its count and its last-seen date.
7. Record the operator boundary: drafting and detection are automatable; approving a record and
   closing a class are not.

### Verification

Planned, not yet run: the coverage check must fail on a fixture whose top class has no owner
and pass on the real capture once classes 1, 2, 7 and 12 are owned; the recurrence-assertion
probe must fail while a class is still being recorded and pass once the window is clear —
demonstrated by replaying a captured class over the real ledger rather than by a synthetic
record; and the drafted record for an unowned class must be reproducible from the capture
alone. The test artifacts this fix would add do not exist yet, so no `- gate:` bullet is
declared here and none is claimed.

## Verification Gates

This record is pre-implementation and `converged`, so **no gates are declared**. Gates are
added when the status reaches `fixed`/`verified` and the artifacts they prove exist; declaring
a path now would be a false declaration. Per the contract, a `converged` record is outside the
fixed/verified set that `validate:repository` live-runs.

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** recurrence is detected and routed away from repair. 27 of 68 classes sit at the
  ≥3-distinct-session bar; the agenda's three carried classes have no owner; 193 records (35%
  of the capture) belong to a family the ledger learned on 2026-08-16 and whose lesson was
  retired out of the boot read while the class fired 16 times on 2026-10-12; and 5 of the 6
  highest-volume classes have zero ledger coverage.
- **GREEN:** make the class the unit of work — draft an owned FID for each unowned class at the
  bar, require a recurrence assertion in the capture's terms, write the lesson only after the
  assertion holds, and fail the repository gate on an unowned top-N class.
- **AUDIT:** every figure above is a command over the real capture and the real ledger, run at
  `bee0610d`; the counts, the session counts and the last-seen dates are reproducible with the
  aggregation reproduced in the evidence block.
- **ADVERSARIAL:** (a) does this duplicate `lessons:to-skills` or `lessons:features`? No — those
  consume a *lesson*, and a class with no lesson cannot reach either; this record creates the
  owner the lesson depends on. (b) Could auto-drafted FIDs flood the queue? The bar is
  ≥3 distinct sessions in a 14-day window and the draft is operator-routed, not auto-approved.
  (c) Is a recurrence assertion weaker than a test? It is a different claim: a test proves the
  code path is correct, the assertion proves the class left production, and this repository has
  been asserting the first while the second went unmeasured. (d) Could a fix legitimately
  raise a class? Yes — a new capability can produce new failures — which is why the assertion
  carries the window and the reason it is recorded rather than inferred.
- **CHANGE DELTA:** ~2% — one new record; no source change yet. The implementation touches the
  dedup/pipeline scripts, `scripts/validate-repository.ts` and the capture's class identity.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** 27 is the lifetime sliced-census bar; the current bounded 14-day window
  has 18 eligible patterns. Existing owners now cover all 68 recorded classes, but
  coverage, capture correctness and actual repair are three different properties.
- **GREEN:** Apply `docs/design/perfection-loop-2026-10-12.md`: consume 024's stable
  registry/probe and 014's evidence-backed rule links. Draft idempotently, never infer
  ownership from prose/token overlap, and gate every eligible unexpected class.
  Replay only isolated copies; do not append fabricated failures to production JSONL.
- **AUDIT:** `experiences:dedup` reports 23 frequency-qualified patterns, five below
  the session bar. The real skill scan links all 18 to one unrelated rule. Detector
  and pipeline PASSes cannot establish successful consumption or repair.
- **ADVERSARIAL / missed question:** Must coverage wait for every child to close?
  No: implementation dependencies differ from observation closure. Land the shared
  probe before consumers, wire coverage after ownership, and keep unresolved work open.
- **CHANGE DELTA:** Planning correction only. Planned artifacts/window are in the review.

### Missed Questions

1. Should the loop also consume the ledger's existing lessons? → Yes, in the same pass: a lesson
   whose owning FID is closed and whose class still recurs (the incomplete-tool-call family is
   the worked example) is evidence the fix did not hold, and the class should reopen rather
   than being credited to the closed record.
2. Does the coverage check belong in the repository gate or in the capture hook? → The gate.
   A hook that runs per failure cannot see a class's window, and a repo-gate check runs on every
   session boundary where the capture is already present.
3. What happens to classes that are not defects at all (an expected 404 during a search)? →
   The capture already distinguishes expected failures from unexpected ones, and the class
   identity must preserve that distinction, otherwise the coverage gate would demand an owner
   for behaviour that is correct.

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing in this record
> has been implemented, so what follows records what was CHECKED at the cited `HEAD` — not what
> was built.

- [x] Measured at `bee0610d` from the real capture: 559 records / 68 classes / 195 distinct
      sessions, 27 classes at the ≥3-distinct-session bar, 193 incomplete-argument records with
      16 dated 2026-10-12, and 34 of 34 governed lessons carrying `**Owning FID:**`.
- [x] The five zero-coverage greps were run against the live `dev/LEARNINGS.md`
      (`Failed to fetch URL`, `ripgrep`, `old string`, `No readable text`,
      `No change to the file`) and each returned 0; the retired lesson was read at
      `dev/LEARNINGS-RETIRED.md:1373`.
- [x] The two producers this record re-routes were read directly:
      `scripts/lessons-to-skills.ts` and `scripts/lesson-feature-pipeline.ts`.
- [x] **Not yet true, and deliberately not claimed:** the loop, its coverage check, its
      recurrence assertions, its gates and its receipt. No class is claimed to have stopped
      recurring.

## Boundaries

- This record proposes no change to `dev/LEARNINGS.md`'s contents or size. It removes the
  reason the file grows.
- The capture stores only each failure's **first line**, so classes are coarse: one record can
  stand for a class with several sub-causes, and the bar can over- or under-group. Finer
  classing needs the capture to record an error class, which is the follow-up
  `FID-2026-1012-009` recorded when it closed (storing `errorClass` and the truncation flag on
  the capture record); this record depends on it for precision but not for existence.
- Nothing here is implemented, and no class is claimed to have stopped recurring.

## Resolution

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so the finding has an owner, a converged design and a register item with
write authority; it made no source change. The work described above is implemented by whichever
pass flips the record to `fixed`, at which point this section is rewritten in the closure format
(Closed Date / Fix Description / Tests Added / Verification Evidence / Archived) and the declared
gates are added under `## Verification Gates`.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's line.
- **Design record:** `docs/design/learnings-root-cause-matrix.md` §3 (the matrix) and §4 RC5
  (the root cause), feature E5.
- **Ordering:** `FID-2026-1012-017`, `-018`, `-019` and `-020` are the first consumers — their
  recurrence assertions are what this loop must be able to record and check; the coverage check
  cannot be added to `scripts/validate-repository.ts` before those classes have owners, or the
  repository reds on a known-open set.
