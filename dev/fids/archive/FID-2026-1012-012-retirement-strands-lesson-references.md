# FID: Retirement strands every by-title reference to a lesson

**Filename:** `FID-2026-1012-012-retirement-strands-lesson-references.md`
**ID:** FID-2026-1012-012
**Severity:** high
**Status:** closed
**Created:** 2026-10-12 19:05
**Closed:** 2026-10-13
**Commit:** 6b847099fcdcc9c9b8e1660b86bf31c3b68311f7
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-011

---

## Summary

Retirement is the only mechanism that keeps `dev/LEARNINGS.md` inside its boot-read budget, and
it works by moving whole lessons out of the live ledger into `dev/LEARNINGS-RETIRED.md` verbatim.
Every other artifact that cites a lesson does so **by title** — a display string — so a move
silently breaks the reference. The measurable consequence is already on the tree: `bun run
lessons:features --check` fails with 7 admission issues because the lesson titles cited by
`LF-001`, `LF-003`, `LF-005` and `LF-006` in `dev/feature-pipeline/candidates.json` now exist
only in the retired archive. Nothing resolves a title across the live+retired pair, and the only
audit trail of what moved is git history. This record is the index and the move record that
close the pair (review §3 D1, E3; features F3, F6).

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** repo scripts as of `main` @ `14d48820`
- **Commit/State:** `main` @ `14d48820` (the retirement that stranded the references landed in
  `ac4bad20`)

## Detailed Description

### Problem

Lesson identity is a title string. `dev/feature-pipeline/candidates.json` stores each
candidate's `lessons[]` as titles, and the admission check in
`scripts/lesson-feature-pipeline.ts` (`reviewFeaturePipeline`) treats a title that is absent
from the live ledger as an admission issue. When retirement moved 972 lines out of the ledger
into `dev/LEARNINGS-RETIRED.md`, seven cited titles left the live file with them, and the
pipeline went red with no code change on either side.

The retired file is the correct destination — retirement is move-only and appends verbatim, so
nothing was lost. The defect is that the *reference* cannot follow the move: there is no index
spanning the two files, and no consumer reads the retired file at all. `LF-006` is worth
noting on its own: it is the draft candidate titled "Detect stale lesson guidance against
current executable authority", reded by an instance of the very class it proposes to fix.

### Expected Behavior

A by-title reference to a lesson resolves wherever that lesson lives. Retirement remains
move-only and lossless, but it becomes *auditable*: what moved, when, why, and where to is
recorded in a machine-readable form rather than only in git history. A reference to a lesson
that is both retired and superseded fails closed and names the replacement rather than
reporting the title as missing.

### Root Cause

References between artifacts are by title, and retirement is a file-to-file move. There is no
mapping from a title to its location, so a consumer can only search one file, and a move is
observable only by the absence it leaves behind. The pipeline's evidence pinning
(`sha256` over each evidence path) makes its *source* snapshots drift-detectable, but its
`lessons[]` array — a list of display strings — participates in no such check.

### Evidence

```text
$ bun run lessons:features --check
lesson-features: FAIL (37 lessons, 6 candidates)
LF-001: Missing lesson: Files over the 100k-character tool read limit break every in-place edit path
LF-003: Missing lesson: A retry that re-emits the same oversized tool call is not recovery
LF-003: Missing lesson: A suppression key that can legitimately be null cannot distinguish "inactive" from "active with no identity"
LF-005: Missing lesson: The test renderer is not a proxy for the production renderer
LF-005: Missing lesson: A FID's Verification section is a contract — each promised test must exist before "verified"
LF-006: Missing lesson: A ledger ruling inherits the freshness of its evidence
LF-006: Missing lesson: A policy scrub must sweep the rule text and its generator anchors, not just the artifacts
exit 1

# every one of the seven titles, located by file
$ grep -cF "<title>" dev/LEARNINGS.md; grep -cF "<title>" dev/LEARNINGS-RETIRED.md
Files over the 100k-character tool read limit break every in-place edit path   live=0 retired=1
A retry that re-emits the same oversized tool call is not recovery             live=0 retired=1
A suppression key that can legitimately be null cannot distinguish "inactive"… live=0 retired=1
The test renderer is not a proxy for the production renderer                   live=0 retired=1
A FID's Verification section is a contract — each promised test must exist…     live=0 retired=2
A ledger ruling inherits the freshness of its evidence                         live=0 retired=1
A policy scrub must sweep the rule text and its generator anchors, not just…    live=0 retired=1

# the move itself (today)
$ git show --stat --oneline ac4bad20 -- dev/LEARNINGS.md dev/LEARNINGS-RETIRED.md
 dev/LEARNINGS-RETIRED.md | 1057 ++++++++++++++++++++++++++++++++++++++
 dev/LEARNINGS.md         |  972 ------------------------------------------
$ grep -c '^## Lesson:' dev/LEARNINGS.md            → 37
$ grep -c '^## Lesson:' dev/LEARNINGS-RETIRED.md    → 37   (74 headings before the move)

# a reference that could have followed the move, and did not
$ grep -rn 'LEARNINGS-RETIRED' scripts/*.ts
(no matches — no consumer reads the retired file)
```

## Impact Assessment

### Affected Components

- `dev/feature-pipeline/candidates.json` (candidate `lessons[]` references)
- `scripts/lesson-feature-pipeline.ts` (admission check; `reviewFeaturePipeline`)
- `scripts/lessons-to-skills.ts` (`loadLessons` / `parseLessons` read the live file only)
- `scripts/learnings-retire.ts` (the move, and its only audit trail)
- `dev/LEARNINGS.md` + `dev/LEARNINGS-RETIRED.md` (the pair a resolution must span)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

The pipeline is red today and the workaround (hand-editing the candidate store to restore dead
titles) loses the reference's meaning: the lesson still exists, so re-pointing at a *different*
title would silently change what the candidate claims.

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Give lesson titles one authoritative locator that spans the live ledger and the retired archive,
have every consumer resolve through it, and make retirement emit a record of the move so the
locator's own history is auditable without git.

### Steps

1. Add a title→location index spanning `dev/LEARNINGS.md` and `dev/LEARNINGS-RETIRED.md`
   (title, file, line, date, status, canonical rule) as one authority both scripts import —
   the retirement path and the two consumers must share it rather than each parsing a file.
2. Resolve through the index in `lessons:features` (`reviewFeaturePipeline`) and
   `lessons:to-skills` (`loadLessons` / `parseLessons`), so a retired lesson is found and
   annotated as retired instead of reported as missing.
3. Make `learnings-retire` emit a machine-readable move record per retired entry (title, date,
   reason, destination) appended beside the archive, so the move is auditable without reading
   git history.
4. Decide and record the behaviour for a reference to a lesson that is both retired and
   superseded: fail closed, naming the replacement title (the ledger already carries
   `Superseded by` for exactly this), never report it as missing.
5. Pin all of it: a retired title resolves; a superseded-and-retired title fails with the
   replacement named; a move record is written for each retired entry; the candidate store
   re-admits cleanly.

### Verification

- `bun run lessons:features --check` reports PASS over the current store, with the four
  affected candidates (`LF-001`, `LF-003`, `LF-005`, `LF-006`) re-admitted rather than
  re-pointed by hand.
- A pin asserts that a title present only in `dev/LEARNINGS-RETIRED.md` resolves to that file
  and is reported `retired`, and that the same lookup for an absent title still fails closed.
- A pin over `learnings-retire` asserts one move record per retired entry, with the destination
  path, and that a re-run over an already-retired entry adds no duplicate record.
- Test artifacts (paths and gates) are named when this record's repair lands.

## Verification Gates

- gate: test scripts/__tests__/learnings-locator.test.ts
- gate: test scripts/__tests__/lesson-feature-pipeline.test.ts
- gate: test scripts/__tests__/learnings-retire.test.ts
- gate: test scripts/__tests__/lessons-to-skills.test.ts
- gate: test scripts/__tests__/lessons-to-skills-drafting.test.ts
- gate: probe scripts/lesson-feature-pipeline.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b3e31d0a3f0e6e5ce373f75354dac222e9116df1b2568e755477b5a5d56f83ec
- verified: 2026-10-13T15:03:18.137Z
- test scripts/__tests__/learnings-locator.test.ts: exit 0
- test scripts/__tests__/lesson-feature-pipeline.test.ts: exit 0
- test scripts/__tests__/learnings-retire.test.ts: exit 0
- test scripts/__tests__/lessons-to-skills.test.ts: exit 0
- test scripts/__tests__/lessons-to-skills-drafting.test.ts: exit 0
- probe scripts/lesson-feature-pipeline.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** `lessons:features --check` fails with 7 admission issues across `LF-001`, `LF-003`,
  `LF-005` and `LF-006`; all seven cited titles verified `live=0, retired≥1`; no script in
  `scripts/` reads `dev/LEARNINGS-RETIRED.md`; the move that caused it (`ac4bad20`, 972 lines,
  74 headings → 37 + 37) is recorded only in git.
- **GREEN:** one title index spanning live + retired; both consumers resolve through it;
  retirement emits a machine-readable move record; a retired-plus-superseded reference fails
  closed naming the replacement.
- **AUDIT:** the failure was reproduced from the shipped command rather than inferred, and each
  title's location was measured with `grep -cF` in both files; the absence of a retired-file
  reader is a scoped grep returning 0 matches. The move's volume and heading counts are read
  from `git show --stat` and a heading census, not from the commit message.
- **ADVERSARIAL:** (a) Could the fix hide a genuinely deleted lesson? No — the index is built
  from the two files; a title absent from both still fails closed. (b) Would resolving retired
  titles silently resurrect guidance the retirement demoted? Resolution reports `retired` and
  does not re-admit a retired entry as boot guidance; only the reference resolves. (c) Is an
  index a second source of truth? It is derived, and the pins assert it agrees with both files,
  so a divergence fails rather than drifting.
- **CHANGE DELTA:** ~0%. This record adds a FID and no code; the reviewed artifacts are
  untouched.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** `lessons:features --check` reproduces exit 1 and seven missing titles.
  The live and retired stores each parse 37 lessons; retired heading titles are unique.
  The former `retired=2` observation counted textual mentions, not duplicate entries.
- **GREEN:** Use the shared locator contract in `docs/design/perfection-loop-2026-10-12.md`:
  preserve all locations for identical duplicate bodies, fail conflicting duplicates,
  and resolve supersession with cycle detection and an explicit replacement notice.
  FID-011 owns move-receipt writing; this record owns resolution and its consumers.
- **AUDIT:** `reviewFeaturePipeline` reads only the live catalogue; the existing
  admission suite passes while the real store fails. Report both, never substitute one.
- **ADVERSARIAL / missed question:** Does resolving a retired title promote it?
  No. Reference reachability and eligibility stay separate; current active issues are
  not demoted. Exact planned locator/admission tests are in the shared artifact table.
- **CHANGE DELTA:** Planning correction only; citations and ledger bodies are preserved.

### Missed Questions

### Loop 3 — Recorded implementation contract (2026-10-13)

- **RED:** Real `bun run lessons:features --check` still exits 1 with seven missing
  retired titles. `reviewFeaturePipeline` imports `parseLessons` from the skill
  script and reads only the live catalog; `loadLessons` does the same. Retirement
  has a separate block parser. FID-011 already implements move receipts and pins
  their idempotence, so this pass preserves that writer.
- **GREEN:** Extract the shared entry parser and implement an in-memory locator
  with all locations, date, status, rule, retired/governed flags and heading line.
  Identical duplicate bodies resolve with all locations; conflicting bodies fail.
  Supersession follows replacements with missing-target and cycle diagnostics.
  Feature references annotate retirement and reject obsolete superseded links with
  a replacement notice; skill eligibility remains live/active only. Retirement
  consumes the same parser without changing the operator's retirement decision.
- **AUDIT:** Pin locator boundaries in `scripts/__tests__/learnings-locator.test.ts`,
  retired admission in `scripts/__tests__/lesson-feature-pipeline.test.ts`, and
  rerun existing skill and retirement suites plus scripts typecheck and quality.
- **ADVERSARIAL:** Resolving historical evidence must never promote it. Missing
  archives are allowed for fixtures/new repositories; present but unsafe or
  unreadable sources fail. No candidate title or actual ledger body is rewritten.
- **CHANGE DELTA:** Source implementation begins after this recorded presentation.
  The no-commit hold prevents formal closure under G2.

1. Should retirement *rename* rather than move? → No. Renaming the title to keep references
   valid would break the ledger's other by-title consumer (the candidate store) in the same
   way and would falsify a record that other lessons cite; a locator is the honest fix.
2. Should the candidate store cite lessons by a stable id instead of a title? → That is the
   better long-term shape and belongs to the rule-first tiering in `FID-2026-1012-014`; it is
   deliberately not required here, because a locator also fixes the references that already
   exist and cannot be re-keyed without changing what they claim.
3. Does this overlap `FID-2026-1012-015`? → No. 015 wires the pipeline check into the repo gate
   and owns its green state; this record supplies the index 015 depends on. Landing the gate
   first would freeze a red check, so 012 is a prerequisite of 015.

### Code Verification Evidence

Current implementation evidence (2026-10-13) supersedes the historical measurements below.

- [x] `scripts/learnings-locator.ts` owns parsing, location inventory and supersession
      resolution. `lesson-feature-pipeline.ts` calls `readLessonLocator` / `resolveLesson`;
      `lessons-to-skills.ts:loadLessons` uses both and retains live locations only;
      `learnings-retire.ts:splitEntries` calls `lessonSpans`.
- [x] Combined locator/admission/retirement/skill suites: 33 pass, 0 fail. Scripts
      typecheck exit 0; quality PASS (1,502 baselined files).
- [x] Real `bun run lessons:features --check`: PASS (74 lessons, 6 candidates).
      All seven retired references resolve without changing candidate links or ledgers.
- [x] Formal closure: closed 2026-10-13 at `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7`; local commits were authorized, push and release remain operator-owned.

- [x] Every cited path exists at `main` @ `14d48820`, read directly at review time; the raw
      measurements live in `docs/design/learnings-boot-loading-and-lifecycle-review.md` §2/§3,
      which this record expands.
- [x] Measurements re-checked: `bun run lessons:features --check` exits 1 with
      `lesson-features: FAIL (37 lessons, 6 candidates)` and 7 admission issues; all seven
      named titles were checked with `grep -cF` against both `dev/LEARNINGS.md` and
      `dev/LEARNINGS-RETIRED.md` and read `live=0 / retired≥1`; the moving retirement landed
      in `ac4bad20` (972 deleted / 1,057 inserted, 74 lesson headings → 37 live + 37 retired).

## Boundaries

- This record does **not** claim the references were lost: the lessons exist in
  `dev/LEARNINGS-RETIRED.md`, verified for all seven titles, and retirement is move-only.
- It does not repair the ledger, re-admit the four candidates, or change the size ceiling
  (`FID-2026-1012-011`) or the boot budget (`FID-2026-1012-010`).
- It does not claim a green pipeline today: `lessons:features --check` is red at `14d48820`
  with exit 1, and the acceptance above is what would prove the repair.
- The retire path's own line cap and its operator-run boundary remain owned by
  `FID-2026-1012-011`.

## Resolution

**Implemented; closed 2026-10-13 at `6b847099fcdcc9c9b8e1660b86bf31c3b68311f7`, once all 8 declared gates re-ran green.**

The shared in-memory locator preserves all matching locations and follows replacements
with explicit notices. Conflicting duplicates, missing replacements and cycles fail
closed. Feature admission resolves retired evidence; skills exclude retired entries.
Retirement shares the entry parser and keeps FID-011's idempotent move receipts.
The declared regression suites and real admission command pass. No ledger move or
candidate promotion was performed; local commits were authorized on 2026-10-13, and
push and release remain operator-owned.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the review).
- **Design record:** `docs/design/learnings-boot-loading-and-lifecycle-review.md` §3 rows D1 and E3,
  §4 features F3 and F6.
- **Ordering:** Prerequisite of FID-2026-1012-015, whose gate must not be wired until these
  references resolve; consumes the move record FID-2026-1012-011 introduces.
- **Archived:** 2026-10-13 — all 8 declared gates re-ran green on the closure tree before closure; the implementation commit is recorded in the metadata above.
