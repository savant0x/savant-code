# FID: Edit-path friction is reported, not diagnosed

**Filename:** `FID-2026-1012-020-edit-path-friction.md`
**ID:** FID-2026-1012-020
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-12 20:15
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-024

---

## Summary

The editing path is the second-largest recorded surface in the mechanical trace ledger and the
only one where the tool tells the model *that* it failed and not *why*: `str_replace` reports
`The old string "…" was not found in the file, skipping. Please try again with a different
string` 29 times across 13 sessions, and `No change to the file` a further 19 times across 12
sessions (last seen 2026-10-11). Neither message carries the evidence needed to repair the
call — no nearby match, no whitespace or line-ending diagnosis, no check against the content the
session last read — so the model's only move is to guess again, and the retry loop spends its
next tool call regenerating the same edit. No lesson covers either class (`grep -ci 'old string'
dev/LEARNINGS.md` returns 0), which is why the lane runs to **13 classes and 72 records** in the
`FID-2026-1012-022` census and has produced no fix.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `@savant-code/agent-runtime` at the recorded `main` line
- **Commit/State:** `main` @ `bee0610d`

## Detailed Description

### Problem

Two distinct classes on one tool, both recorded as friction rather than as diagnosis:

- **The old string was not found.** The report names the failure and prescribes the wrong
  recovery: "try again with a different string" asks the model to guess which part of its
  instruction was wrong. The three reproducible causes — a whitespace or line-ending difference,
  a stale view of the file, and a genuinely wrong target — need three different repairs, and the
  message distinguishes none of them.
- **No change to the file.** A no-op edit is reported through the same error channel as a
  mismatch, so a call that was *structurally correct and simply unnecessary* reads as a failure.
  On a Windows checkout with mixed line endings this is the expected outcome of an edit that
  would have been a no-op, not a defect in the request.

Both classes are mechanical friction on the most frequently used write tool, and both are
absent from the ledger, so nothing has ever asked for them to be fixed.

### Expected Behavior

A failed edit returns the evidence required to repair it in one step: the closest match with its
line number and the difference that prevented the match (whitespace, line ending, or the bytes
actually present), and — when the session has read the file earlier — an explicit statement
that the view is stale together with what changed. A no-op is reported as its own outcome, not
as an error, because the model's correct next move differs: for a mismatch it must re-read, for
a no-op it must proceed.

### Root Cause

The tool receives the failure from the text-matching layer and forwards it, keeping no
diagnostic work of its own: it does not locate the nearest candidate, does not compare the
request against the content the session last read, and does not classify the cause. Because the
message is the only channel the model has, the tool's error path is effectively the model's
debugger, and it was written as a status line. The no-op case compounds it by sharing that
channel with genuine failures.

### Evidence

```text
# Volumes and recency, aggregated from dev/experiences/raw-traces.jsonl (2026-10-12)
records=559  classes=70  distinct sessions=195

  29 hits / 13 sessions  last 2026-10-11  str_replace | The old string "…" was not found in the file,
                                          skipping. Please try again with a different string
  19 hits / 12 sessions  last 2026-10-11  str_replace | No change to the file
  ------------------------------------------------------------------------------------------
  48 recorded failures on the editing path

# Ledger coverage of either class in the live file
$ grep -ci 'old string' dev/LEARNINGS.md
0
$ grep -ci 'No change to the file' dev/LEARNINGS.md
0
```

## Impact Assessment

### Affected Components

- The `str_replace` tool's mismatch and no-op paths (recovery messages, in
  `@savant-code/agent-runtime`; the exact emission site **NEEDS-REVIEW** — it was not located by
  the searches this record cites)
- Every agent that edits files, including the Forge implementation path and the Scribe's
  documentation writes
- The session's tool budget: each un-diagnosed mismatch consumes at least one re-read and one
  regenerated edit call

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Medium: nothing is lost and every case has a workaround (re-read then retry), but the
workaround is discovered by the model through repetition, across 25 distinct sessions.

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Make the failure path carry its own diagnosis. The tool already holds everything needed — the
current file content, the text the session last read, and the requested old string — so it can
answer "which of the three causes is this" instead of asking the model to find out.

### Steps

1. Re-measure both classes from `dev/experiences/raw-traces.jsonl` at implementation time and
   locate the exact emission site for each (this record's RED is a 2026-10-12 snapshot, and the
   message site is currently NEEDS-REVIEW).
2. On a mismatch, return the nearest candidate: its line number, the local context, and the
   normalised comparison (whitespace run, line ending, and the differing bytes).
3. Classify the cause where it is decidable — line-ending difference (the Windows checkout
   reality), whitespace-only difference, or no near match — and name the classification in the
   message.
4. When the session has previously read the file, compare the request against that view and say
   so explicitly when it is stale, so a correct-but-outdated edit is not reported as a wrong one.
5. Report a no-op (`No change to the file`) as its own outcome, distinct from failure, with the
   instruction to proceed rather than to retry.
6. Declare the recurrence assertion required by FID-2026-1012-021: both classes must be absent
   from the trace ledger for the following window before any lesson is written about them.

### Verification

Re-aggregate both classes over the window that follows implementation and report the counts and
last-seen dates beside this record's baseline; assert in a focused test that a line-ending-only
difference, a whitespace-only difference and a genuinely absent target each produce their own
named classification with a locatable candidate; and assert that a no-op edit is distinguishable
from a mismatch in the result the model receives. The gate declarations, the test paths and the
receipt are added when this record reaches `fixed`/`verified` — asserting them now would be a
false declaration.

## Verification Gates

- gate: test packages/agent-runtime/src/__tests__/edit-diagnostics.test.ts
- gate: test packages/agent-runtime/src/__tests__/process-str-replace-outcomes.test.ts
- gate: test packages/agent-runtime/src/__tests__/process-str-replace.test.ts
- gate: typecheck packages/agent-runtime
- gate: typecheck sdk
- gate: quality

### Verification Receipt

- fingerprint: sha256:238b94a06906160f02651e9580f99214e3402d90bf5a3edf02dd81042d743431
- verified: 2026-10-13T05:41:29.800Z
- test packages/agent-runtime/src/__tests__/edit-diagnostics.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/process-str-replace-outcomes.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/process-str-replace.test.ts: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck sdk: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** 48 recorded failures across 25 distinct sessions on one tool, both classes uncovered
  by the ledger, and the mismatch message prescribing a recovery ("try a different string") that
  the evidence in the same call contradicts — a line-ending or staleness cause makes the
  instruction wrong, not merely unhelpful.
- **GREEN:** carry the diagnosis in the failure: nearest candidate with context, a named cause
  among the decidable ones, an explicit staleness statement when the session's view is old, and
  a no-op reported as its own outcome rather than a failure.
- **AUDIT:** both counts and dates are re-read from the ledger and pasted above; the ledger
  coverage greps are pasted; the emission site is marked NEEDS-REVIEW instead of guessed.
- **ADVERSARIAL:** (a) does a richer message make edits *less* safe by encouraging blind
  retries? No — the point is to convert a guess into a decision: a named line-ending cause
  prescribes the fix, while today's text guarantees another guess. (b) Could returning the
  nearest candidate leak content? No: the file has already been read by the same session, so the
  candidate context is already in the model's context; the message adds no new exposure. (c) Is
  the no-op class even a defect? Yes, as a *reporting* defect: it shares the error channel with
  real failures, so it trains the model to retry work that is already done.
- **CHANGE DELTA:** 0% — pre-implementation. The record converged on a design; no source file
  has been touched.

### Loop 2 — Current-tree review and self-correction (2026-10-12)

- **RED:** All 13 classes / 72 records remain owned. Exact mismatch/no-op sites are
  `process-str-replace.ts:254` / `:133`. Injecting a frozen successful client result into
  `handleStrReplace` reproduces `Attempted to assign to readonly property.`
- **GREEN:** Apply `docs/design/perfection-loop-2026-10-12.md`: copy rather than mutate
  client results; separate identical-success from failed/partial replacements; bound
  diagnostics and preserve containment. Include SDK `change-file.ts` and apply-patch
  boundaries plus directory/path failures. Current CRLF/whitespace rescue stays intact.
- **AUDIT:** A valid identical replacement returns `No change to the file` through
  the error channel. A missing target has no candidate line. The latest-content promise
  is not a previous-read snapshot, so staleness is unknown without a revision receipt.
- **ADVERSARIAL / missed question:** Does a flat readonly error name its mechanism?
  Not alone; the injected production handler now supplies that reproduction. Do not
  leak file bodies through diagnostics/logging. Planned tests/window are in the review.
- **CHANGE DELTA:** Planning correction only; no edit behaviour was changed.

### Loop 3 — Implementation (2026-10-13)

- **RED (re-measured at implementation time, `main` @ `09f0c892`, FID-2026-1012-024's instrument):**
  the lane's 13 classes are 8 stable causes / **71 records**: `str_replace` `edit-target-missing` 29/13
  (last 2026-10-11), `str_replace` `edit-noop` 19/12 (last 2026-10-11), `apply_patch` `patch-failed`
  12/6, `write_file` `patch-failed` 3/2, `str_replace` `patch-failed` 2/1, `str_replace`
  `immutable-result` 3/1 (last 2026-10-01), `str_replace` `edit-target-ambiguous` 2/2, `list_directory`
  `directory-missing` 1/1.
- **GREEN:** the mismatch carries its diagnosis, a mismatch is no longer reported as a no-op, and the
  handler stops assigning into the caller's result object.
- **AUDIT:** the five declared gates are listed above and stamped below; the re-measure is verbatim in
  this entry.
- **ADVERSARIAL — did the class move, or stop?** **Not stopped.** Every fix lands after the last
  record of every class, so this record makes no class claim and writes no lesson. Three sub-answers
  that were established rather than assumed:
  1. **The mismatch/no-op conflation is the bigger defect, and it is measured.** Loop 2 saw both
     classes arriving through one channel; the code confirms it: when every replacement failed to
     match, the old path pushed the match errors **and then appended `No change to the file`**, so
     `edit-noop` was receiving *mismatch* records and the model was told to treat a failure as done.
     The two are now separated (`process-str-replace.ts`), and the existing "one replacement fails
     while another applies" case still settles as a partial success carrying the diagnosis.
  2. **The no-op stays on the error channel, deliberately, with a cited reason.** A success shape
     would send the unchanged file through `postStreamProcessing`, which partitions on `'error' in
     result` and would rewrite the file and open a client round trip for nothing. What changed is the
     text the model acts on: "completed outcome, not a failure … proceed to the next step instead of
     retrying". The class identity is unchanged, so the capture will keep counting it until the
     outcomes are separated at the result-vocabulary level — which is `FID-2026-1012-021`'s machinery,
     not a rename.
  3. **The `immutable-result` fix is a real unsafe write; its production trigger is not claimed.**
     `str-replace.ts:131` assigned into `clientToolResult[0].value` — an object the handler does not
     own. Loop 2 reproduced the class by injecting a frozen client result; no `Object.freeze` on tool
     results exists in the runtime today (`grep -rn 'Object.freeze' packages/agent-runtime/src
     common/src` → fixtures and policy constants only), so the production path that froze that object
     in the 2026-10-01 session is **unproven**. The mutation is gone; the class is not claimed as
     explained.
  4. **Left open, not slipped:** the `apply_patch`/`write_file`/`str_replace` `patch-failed` classes
     (17 records) already report the path, the attempted strategies and the last error with the
     re-read action (`sdk/src/tools/apply-patch/diff.ts:157-179`); what they lack is a nearest-candidate
     diff, which is a larger change than this pass warranted and is listed under Resolution. The one
     `list_directory` `directory-missing` record is likewise untouched.
- **CHANGE DELTA:** +1 pure diagnostics module and +2 test files; `process-str-replace.ts`, the
  `str_replace` handler and one existing expectation changed. No production class claim, no lesson, no
  `fix-boundaries.json` entry.

### Missed Questions

1. **Which cause dominates — line endings, staleness, or wrong targets?** → This record does not
   know and does not claim to: the trace stores each failure's first line, so the split is
   unmeasured. Step 1 measures it before the fix is designed in detail, and the three causes are
   handled explicitly rather than assuming one.
2. **Should the tool auto-repair a whitespace- or line-ending-only mismatch?** → No by default:
   silently normalising the model's intent is a content change the model did not ask for. The
   tool classifies and names; it does not rewrite.
3. **Does this overlap with `FID-2026-1012-019`'s degradation contract?** → The reporting shape
   is shared (name the cause, once, with the action), and the two records should use one result
   vocabulary; they stay separate because the surfaces and the fixes differ — a capability
   preflight there, edit-content diagnosis here. Loop 3 kept them separate and reused neither
   module in the other: `capability-notice.ts` renders a capability's state, `edit-diagnostics.ts`
   renders the evidence for a failed edit, and each keeps its own stable first line.

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing in this record has
> been implemented, so what follows records what was CHECKED at `main` @ `bee0610d` — not what
> was built.

- [x] Measurements re-checked: both class counts, session counts and last-seen dates in the
      Evidence block, aggregated from the 559-record trace ledger on 2026-10-12.
- [x] Ledger coverage re-checked: the two greps pasted above, run against the live
      `dev/LEARNINGS.md` (both 0 — neither class has ever been recorded as a lesson).
- [x] **Not yet true, and deliberately not claimed:** the repair itself, its gates and its
      receipt; the exact emission site for either message (marked NEEDS-REVIEW above, to be
      located in step 1 rather than asserted here).

## Boundaries

- The trace stores each failure's **first line**, so the true split between whitespace,
  line-ending, staleness and wrong-target causes is **not measured** by this record; the classes
  are volumes, and step 1 re-measures.
- The emission site for both messages was not located in this pass; it is marked NEEDS-REVIEW
  rather than guessed from unrelated prose.
- No live editing run was instrumented to reproduce either failure; the classes are measured
  from recorded sessions, not observed live in this pass.
- Nothing here proposes changing what an edit does — only what a failed edit *reports*.

## Resolution

**Implemented — `Status: fixed` (deterministic gates green; recurrence assertion OPEN).**

- **Closed Date:** 2026-10-13 (implementation pass; the record stays open in the sense that no class
  window has run — no lesson is written).
- **Fix Description.** A failed edit now carries the evidence that repairs it. New pure module
  `packages/agent-runtime/src/edit-diagnostics.ts` classifies a missing target — `partial-line-match`
  (a line of the request appears verbatim, so the surrounding block differs), `whitespace-only-difference`
  (the non-whitespace characters occur but no contiguous block matches), or `no-near-match` — and
  renders it after the stable first line: the closest line with its number, the file's shape, and the
  repair action (re-read the region with `read_files offset/limit`, do not resend the same old string).
  The first line is unchanged on purpose: it is the failure ledger's class identity, so the diagnosis
  enriches the class instead of renaming it. `process-str-replace.ts` now separates the two outcomes the
  lane is made of: a run in which every replacement failed to match returns the match errors and its
  diagnosis and **never** the no-op text, and a run in which the requested edit simply changes nothing
  returns a message that says so and tells the model to proceed. The `str_replace` handler no longer
  assigns into the caller's result object — it builds a new value (`str-replace.ts`), removing the
  `Attempted to assign to readonly property.` path.
- **Tests Added:** `packages/agent-runtime/src/__tests__/edit-diagnostics.test.ts` (6 cases: verbatim
  candidate with its line number, whitespace-only classification, absent target, bounded snippet,
  rendered cause/candidate/action, no candidate line when there is none);
  `packages/agent-runtime/src/__tests__/process-str-replace-outcomes.test.ts` (3 cases: mismatch is
  diagnosed and is not a no-op; the closest verbatim line is named when the rescue cannot apply; a
  no-op reports a completed outcome with proceed advice). One existing expectation in
  `process-str-replace.test.ts` moved from exact-string equality to the stable first line plus its
  diagnosis — the message gained evidence by design.
- **Verification Evidence:** `packages/agent-runtime` **2,075 pass / 0 fail across 318 files** (this
  lane added 9 net cases) · `bun run --cwd=packages/agent-runtime typecheck` exit 0 · `quality:report`
  PASS (1,502 baselined files) · ESLint `--max-warnings 0` and Prettier clean on every touched file.
  Red-measure at `09f0c892`: 563 records / 56 stable classes, this lane's causes live and unstopped
  (29/19/12/3/3/2/2/1) — pasted verbatim in Loop 3.
- **Archived:** not archived. Per FID-2026-1012-022's closure condition a child closes only when its
  classes show no new records in the declared window; the window has not started.
- **Open, and why this record is not `closed`:** (a) the recurrence window has not run, so no class
  claim and no fix boundary exist; (b) the `patch-failed` classes (17 records) were not repaired —
  their message already carries path, strategies, last error and the re-read action, but not a
  nearest-candidate diff, which is a larger change than this pass warranted; (c) the single
  `list_directory` `directory-missing` record is untouched; (d) the `immutable-result` mutation is
  removed without a regression test at the handler boundary (no `handleStrReplace` test harness exists)
  and without a proven production trigger — both stated as open rather than counted as done.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the root-cause matrix).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` §3 rows 3 and 9, §4 root
  cause RC4, §5 feature E4.
- **Ordering:** consumes the recurrence assertion defined by `FID-2026-1012-021` (the lesson is
  written only after the class stops); shares one result vocabulary with
  `FID-2026-1012-019`.
