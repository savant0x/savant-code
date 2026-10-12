# FID: Edit-path friction is reported, not diagnosed

**Filename:** `FID-2026-1012-020-edit-path-friction.md`
**ID:** FID-2026-1012-020
**Severity:** medium
**Status:** converged
**Created:** 2026-10-12 20:15
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)

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

This record is pre-implementation (`Status: converged`, FID-2026-0915-004), so **no gate
bullets are declared**. Gates are allowlisted shapes only and are declared when the status
reaches `fixed`/`verified`, together with the receipt that binds them to the document.

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
   preflight there, edit-content diagnosis here.

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

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so the finding has an owner, a converged design and a register item with
write authority; it made no source change. The work described above is implemented by whichever
pass flips the record to `fixed`, at which point this section is rewritten in the closure format
(Closed Date / Fix Description / Tests Added / Verification Evidence / Archived) and the
declared gates are added under `## Verification Gates`.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the root-cause matrix).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` §3 rows 3 and 9, §4 root
  cause RC4, §5 feature E4.
- **Ordering:** consumes the recurrence assertion defined by `FID-2026-1012-021` (the lesson is
  written only after the class stops); shares one result vocabulary with
  `FID-2026-1012-019`.
