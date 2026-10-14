# FID: The recurrence-to-fix loop is open — a class is detected, then routed away from a fix

**Filename:** `FID-2026-1012-021-recurrence-to-fix-loop.md`
**ID:** FID-2026-1012-021
**Severity:** high
**Status:** verified
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

- gate: test scripts/__tests__/experiences-coverage.test.ts
- gate: test scripts/__tests__/experiences-learning-order.test.ts
- gate: test scripts/__tests__/experiences-repair-drafts.test.ts
- gate: test scripts/__tests__/session-end-review.test.ts
- gate: test scripts/__tests__/experiences-class-horizon.test.ts
- gate: test common/src/util/__tests__/experience-classes.test.ts
- gate: typecheck common
- gate: probe scripts/experiences-recurrence.ts
- gate: probe scripts/experiences-repair-drafts.ts
- gate: probe scripts/learnings.ts
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:feefd3c15a8912a6e90d86e70e5e65839a29370d0a337cc246a61327e7515130
- verified: 2026-10-14T00:54:19.675Z
- test scripts/__tests__/experiences-coverage.test.ts: exit 0
- test scripts/__tests__/experiences-learning-order.test.ts: exit 0
- test scripts/__tests__/experiences-repair-drafts.test.ts: exit 0
- test scripts/__tests__/session-end-review.test.ts: exit 0
- test scripts/__tests__/experiences-class-horizon.test.ts: exit 0
- test common/src/util/__tests__/experience-classes.test.ts: exit 0
- typecheck common: exit 0
- probe scripts/experiences-recurrence.ts: exit 0
- probe scripts/experiences-repair-drafts.ts: exit 0
- probe scripts/learnings.ts: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

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

### Loop 3 — Implementation (2026-10-13)

- **RED (re-measured at implementation time, `main` @ `0e7b3414`):** the capture holds **563 records /
  56 stable classes**; with the bounded window applied, **21 classes are eligible** (≥3 distinct
  sessions inside 14 days, not an expected outcome). Before this pass, eligibility was in no gate:
  `dev/agenda.md` carried the classes and nothing failed when one had no owner.
- **GREEN:** the coverage check now runs inside the repository gate.
  `scripts/experiences-coverage.ts` reads `FID-2026-1012-024`'s stable class identity and the owner
  manifest (never re-deriving either), and reports every eligible class with no owner, named with its
  record count, its session count, its tool and its last-seen date; `scripts/hygiene.ts` surfaces it as
  `hygiene.experience-coverage` on every `validate:repository` run. `experiences:recurrence` is now a
  named entry point (`bun run experiences:recurrence`) so a fix can declare the probe as its gate.
- **AUDIT — the gate was demonstrated failing and passing, not assumed:**
  - `bun run experiences:recurrence` exit 0 at this state (all classes owned, no boundary declared).
  - With the top eligible class's owner temporarily removed from `dev/experiences/class-owners.json`,
    `bun run validate:repository` **exits 1** with exactly one new failure:
    `[hygiene.experience-coverage] dev/experiences/class-owners.json: unowned recurring class
    v1:read_url:http-404:undetermined (read_url, 114 records across 14 sessions in the last 14 days,
    last seen 2026-10-10) — add it to dev/experiences/class-owners.json with the record that owns the
    fix.`
  - The manifest was restored byte-identically (`git diff --stat` clean) and `validate:repository`
    exits 0 again. This is the record's own Verification requirement ("must fail on a fixture whose top
    class has no owner and pass on the real capture") demonstrated on the real gate path, with the
    fixture confined to a manifest edit that was reverted.
- **An omission in this record's own gate set, found while gating the next lane (2026-10-13) and
  corrected here.** This record's test file shipped a type error (`triggerType: 'tool-failure'` instead
  of `'tool_failure'`) that **passed all three declared gates**; the root `typecheck` caught it. My first
  reading of that — that `scripts` has no declarable typecheck because it is not a bun workspace — was
  **wrong, and the repository says so**: `scripts/scripts-typecheck-check.ts` exists precisely as the
  declarable `probe` form of the chain's 14th leg, and `scripts/gate-declarability-registry.ts:106-112`
  pairs it with the root `typecheck` gate for that reason ("the chain's 14th leg: `scripts` is not a bun
  workspace, so it has no `typecheck <workspace>` form"). The gate list above now declares it, and the
  receipt below is stamped **with** it, and the leg was proved in both directions: with the type error
  reintroduced `bun run fid:verify <this record>` exits 1 with `[FAIL] probe
  scripts/scripts-typecheck-check.ts (exit 2)`, and with the file restored byte-identically it passes
  again. The surviving finding is narrower and worse: nothing required this record's gate set to cover
  the surfaces it touched, so a *plausible-sounding* explanation for a missing gate was as good as a
  check. `FID-2026-1012-027` owns that gap.
- **ADVERSARIAL / missed question:** **Has the loop closed? No — it now cannot stay open silently.**
  Three honest limits: (a) the coverage check proves an *owner exists*, not that the owner fixed
  anything — repair is still proved by the child's own recurrence assertion, and no boundary can be
  declared until a class stops firing, so `dev/experiences/fix-boundaries.json` stays empty;
  (b) **lesson-last ordering is not yet enforced**: the probe already reports `unsupported repair` when
  a boundary exists but the horizon is not `observed`, but mapping a governed lesson to its class needs
  `FID-2026-1012-014`'s evidence-backed rule links, which is Chain B work not yet done — so a lesson
  cannot yet be prevented from being written early; (c) auto-drafting a defect FID for an unowned class
  (step 3) is **not implemented** — the check reports rather than files, and filing a record is the
  operator-routed step the record itself puts at the operator boundary. All three are stated as open.
- **CHANGE DELTA:** +1 collector module, +1 test file, +3 lines in the hygiene collector, one new
  package script. No capture record was fabricated or appended (the fixtures are in memory), no lesson
  was written, and no class is claimed to have stopped recurring.

### Missed Questions

### Loop 6 — The no-commit hold is lifted (2026-10-13)

- **RED:** Loop 5's count-reporting work was held uncommitted by an explicit operator
  hold. The hold could not be worked around: the held change and the observation-path
  fix that follows it share two files (`common/src/util/experience-classes.ts`,
  `scripts/experiences-recurrence.ts`), and `git commit <path>` stages a whole file.
- **GREEN:** Operator ruling 2026-10-13 lifts the hold. The held work was committed on
  its own at `2a34e558`, after re-running its declared gates on the final bytes: shared
  class suite 14 PASS, five scripts suites 39 PASS, `typecheck common` exit 0, and all
  three declared probes exit 0.
- **AUDIT:** The commit is path-scoped to the seven files that carried the held change
  plus the continuation summary; no unrelated dirty path was staged.
- **ADVERSARIAL:** The ruling changes no count, owner, class key, promotion threshold or
  repair assertion, and it implies no class closure: observation is still unproved, so
  this record stays `verified` and no lesson is written against it.

### Loop 5 — Count semantics (2026-10-13, recorded before implementation)

- **RED:** The live recurrence probe reports 589 rows / 58 stable classes / zero
  ownership issues, but renders each row count as `Nx`. FID-024 Loop 6 established
  that a response may contribute multiple rows. The ledger has no response id;
  a 60-second gap cannot establish a response boundary or an occurrence count.
- **GREEN:** Extend the shared class summary with per-class, per-session time
  clusters using a declared 60,000 ms consecutive gap. Report rows, time clusters,
  largest cluster and the gap in text and JSON. Preserve counts, owners, stable
  keys, promotion thresholds and every horizon assertion. Sort copied timestamps
  so input order cannot affect clusters; keep invalid timestamps as isolated rows.
- **AUDIT plan:** Pin unordered input, session/class separation, exact gap edges,
  long chains, input preservation and unchanged post-fix recurrence rejection.
  Declare the shared-class and horizon suites plus common/scripts typechecks.
- **ADVERSARIAL:** A cluster may contain multiple responses or distinct failures.
  These are descriptive time clusters only, never response counts or repair proof.
  No ledger rewrite, boundary, exposure receipt or lesson is authorized by them.
- **CONVERGENCE:** The correction addresses the handoff's next step without
  claiming correlation the stored data cannot prove. Implementation may proceed
  under the master's existing authorization; this FID remains open.
- **Implementation audit:** `summarizeExperienceClasses` now supplies
  `timeClusters`, `largestTimeCluster` and `clusterGapMs` to `recurrenceReport`;
  both the JSON projection and text CLI expose them. Shared-class suite: 14 PASS;
  five scripts suites: 39 PASS; full common suite: 879 PASS / 4 SKIP / zero FAIL.
  Full root typecheck, scoped ESLint, scoped Prettier, quality and diff checks
  pass. The expanded declared gate set is re-stamped after the final record edit.
- **Live re-measure:** 589 rows / 58 classes / zero issues. `read_url:http-404`
  has 114 rows / 40 time clusters / largest 17; `suggest_followups` incomplete
  arguments has 23 rows / 7 clusters / largest 17. These are consecutive-gap
  clusters, not the response estimates in the prior measurement.
- **Adversarial audit:** Gap equality starts a new cluster; different sessions
  and classes never merge; arbitrarily long chains remain timing clusters.
  Invalid timestamps are isolated, and the closure ledger still rejects them.
  A clustered post-fix pair still reports two failures and state `recurred`.
  No production closure or release action follows this count correction.

### Loop 4 — Recorded completion contract (2026-10-13)

- **RED:** Coverage is enforced but active class-linked lessons can still claim
  repair before qualified observation. FID-014 now exposes exact class links.
  Unowned eligible classes are reported but produce no durable repair draft.
- **GREEN:** Add lesson-last validation to the real learning validator, joining
  explicit canonical class links to the existing owner/horizon/proof authorities.
  An active class-repair lesson requires observed exposure and its actual owning
  FID; historical guidance and proven expected outcomes do not claim repair.
  Draft unowned eligible repairs idempotently as complete proposed FID documents
  inside an append-only proposal JSONL, not active records or source-write grants.
  New proposals have automation level 1 and require operator routing into the
  active register/master/owner manifest. SessionEnd may draft, never approve.
- **AUDIT:** Pin unproved/recurred/wrong-owner rejection, observed eligibility,
  and the disk-backed validator caller. Pin repeat-run draft idempotence and
  absence of active-queue/register mutation in isolated fixtures. Declare both
  suites and independent read-only learning/draft probes.
- **ADVERSARIAL:** Quiet capture is not observation, and a proposed document is
  not an owner. Coverage remains red until real routing. Do not append synthetic
  failures to production capture, invent fix boundaries, or write lessons early.
- **CHANGE DELTA:** Recorded before source writes; actual observation and the
  operator's commit/routing holds remain independent of machinery verification.

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

Current machinery completion evidence (2026-10-13) supersedes the older open limits below.

- [x] `validateLearnings` calls `validateLearningRepairOrder`; explicit class links
      require observed repair, validated exposure receipts and the actual owning FID.
      Unresolved/recurred/wrong-owner claims fail; historical and proven expected
      guidance do not claim class repair.
- [x] `runSessionEndReview` calls `repairDraftRoutingNotes`. Drafts are append-only
      complete proposed records with an exclusive writer lock and class-key deduplication.
      They grant no active ownership, register mutation or source-write authority;
      operator routing remains required.
- [x] Combined coverage/order/draft/SessionEnd suites: 23 pass, 0 fail. Fixtures
      prove idempotence and no active-queue/register/raw-capture mutation.
- [ ] Actual class observation and formal closure remain open: no fix boundary or
      clean production window is invented, and the no-commit hold prevents G2 closure.

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

**Machinery implemented — `Status: verified`; class recurrence assertions OPEN.**

The earlier limits (a)/(b) below are superseded by Loop 4: lesson-last ordering is
now enforced, and unowned eligible classes draft proposed FID documents idempotently
for operator routing. Proposal storage is not active ownership. The class lanes
still require genuine qualified observation, and the explicit no-commit hold
prevents formal closure. No production failure or exposure was fabricated.

- **Closed Date:** 2026-10-13 (machinery pass; the loop cannot be *closed* until the class lanes
  observe clean windows — this record supplies the mechanism, not the proof).
- **Fix Description.** An eligible failure class with no owner is now a repository-gate failure.
  `scripts/experiences-coverage.ts` consumes `FID-2026-1012-024`'s stable class identity and the owner
  manifest, applies the bounded eligibility rule (≥3 distinct sessions inside 14 days, expected
  outcomes excluded) and names each unowned class with its count, sessions, tool and last-seen date;
  `scripts/hygiene.ts` surfaces it as `hygiene.experience-coverage` inside `validate:repository`, so the
  gap cannot sit invisible between sessions. `bun run experiences:recurrence` is the declared probe a
  fix points its recurrence assertion at; `dev/experiences/fix-boundaries.json` remains the place a fix
  records its window, and the probe already refuses an `unsupported repair`.
- **Tests Added:** `scripts/__tests__/experiences-coverage.test.ts` (5 cases: fails on an unowned
  class above the bar with count/sessions/last-seen rendered; passes with an owner; ignores a class
  below the session bar or outside the window; never demands an owner for an expected outcome; groups
  by stable class identity rather than by tool). Fixtures are in memory — no fabricated failure was
  appended to the production capture.
- **Verification Evidence:** `bun test scripts/__tests__/experiences-coverage.test.ts` 5 pass / 0 fail ·
  `bun run scripts/experiences-recurrence.ts` exit 0 (56 stable classes, all owned) ·
  `bun run validate:repository` PASS, and **FAILS** with one named `hygiene.experience-coverage` issue
  when the top class's owner is removed and PASSES again once it is restored (manifest byte-identical,
  `git diff --stat` clean) · `quality:report` PASS (1,502 baselined files) · ESLint `--max-warnings 0`
  and Prettier clean.
- **Archived:** not archived. The master (`FID-2026-1012-022`) closes last.
- **Open, and why this record is not `closed`:** (a) lesson-last ordering is not enforced until
  `FID-2026-1012-014` supplies the evidence-backed rule links that map a lesson to its class;
  (b) auto-drafting a defect FID for an unowned class is deliberately not implemented — the check
  reports, the operator routes; (c) no class has a clean observation window, so no lesson is written
  and no claim is made.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's line.
- **Design record:** `docs/design/learnings-root-cause-matrix.md` §3 (the matrix) and §4 RC5
  (the root cause), feature E5.
- **Ordering:** `FID-2026-1012-017`, `-018`, `-019` and `-020` are the first consumers — their
  recurrence assertions are what this loop must be able to record and check; the coverage check
  cannot be added to `scripts/validate-repository.ts` before those classes have owners, or the
  repository reds on a known-open set.
