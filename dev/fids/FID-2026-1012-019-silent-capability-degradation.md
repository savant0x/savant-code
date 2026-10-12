# FID: Three tools degrade silently, breaking a rule the ledger already states

**Filename:** `FID-2026-1012-019-silent-capability-degradation.md`
**ID:** FID-2026-1012-019
**Severity:** high
**Status:** converged
**Created:** 2026-10-12 20:15
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Master FID:** FID-2026-1012-022 (The failure-class remediation program)
**Depends On:** FID-2026-1012-023, FID-2026-1012-024

---

## Summary

Four of the highest-volume classes in the mechanical trace ledger are the same failure: a
capability that is absent, broken or cut off is reported to the agent as if it had run and
found nothing. A missing research key becomes an empty result set
(`packages/agent-runtime/src/llm-api/research-sources.ts:125`, 24 hits / 7 sessions), a
code search whose binary cannot be spawned returns nothing (13 hits / 5 sessions) and a code
search that collected zero of the matches its own process found returns nothing (7 hits / 4
sessions), and a read-only command cut at a 30-second bound reports only that it timed out
(7 hits / 6 sessions). The ledger already carries the rule this breaks — *a control's
degradation path needs the same specificity as its success path* (lesson `A governance
control that degrades to an advisory needs a loud, specific degradation`, owning
FID-2026-1006-004) — and that rule was applied to one worktree control instead of to the tool
surface. The agent's next decision is therefore made on a false premise: "found nothing" and
"could not look" are indistinguishable.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `@savant-code/agent-runtime` at the recorded `main` line
- **Commit/State:** `main` @ `bee0610d`

## Detailed Description

### Problem

The trace ledger records one immutable row per tool failure. Aggregated over its 559 records
(68 classes, 195 distinct sessions), this lane's **six classes — 50 records** in the
`FID-2026-1012-022` allocation — share one shape: a capability that did not run, reported as a
capability that ran:

- **`web_search` returns an empty result set when no research key is configured.** The notice
  it returns instructs the *operator* to add a key; it does not tell the agent that the search
  did not happen, and it arrives after the agent has already committed to a research plan.
- **`code_search` returns nothing when its ripgrep process cannot be spawned.** The failure is
  visible only as a tool-level error line that names the missing binary — never as "search
  unavailable, use a different method", which is the decision the agent actually needs.
- **`code_search` returns nothing when its own process reported matches but none were
  collected.** This is the worst shape of the three: the process exited 0, so every signal
  available to the caller says success, and the agent concludes the codebase does not contain
  what the class of defect says it might.
- **`run_readonly_command` reports only "timed out after 30 seconds".** The bound is named but
  the work state is not: was it slow, blocked, or waiting on input, and what was it doing. The
  class itself is owned by `FID-2026-1012-023`; what this record keeps from it is the reading
  rule — a timeout must never read as "found nothing".

None of the four is covered by a lesson. The ledger's coverage of the general rule is real but
was written for a worktree control, not for the tool surface, so the class survived it.

### Expected Behavior

A capability that is missing, broken or cut off names itself, once per run, in the agent's own
terms, and never returns an empty success. "Could not look" and "looked and found nothing" are
different results and must stay different all the way to the decision that consumes them — the
same invariant the ledger already states for controls, applied to every capability a run
depends on. A run should also be able to learn the state of its capabilities *before* a plan
depends on them.

### Root Cause

Each tool's degradation path is written locally and independently, and every one of them
treats "no capability" as "no data". There is no shared contract for what a degraded result
looks like, no run-start capability check, and no producer-side rule that a search which could
not complete must not return the same value as a search that completed with zero hits. The
`code_search` anomaly makes the gap explicit: the caller cannot distinguish a genuine
zero-match from a result-collection failure, so it reports the benign one.

### Evidence

```text
# Volumes and recency, aggregated from dev/experiences/raw-traces.jsonl (2026-10-12)
records=559  classes=70  distinct sessions=195
classes at the >=3-distinct-session promotion bar (FID-2026-1005-003): 27

  24 hits /  7 sessions  last 2026-10-10  web_search | No web search results were returned. Add a research API key …
  13 hits /  5 sessions  last 2026-09-17  code_search | Failed to execute ripgrep: ENOENT: no such file or directory,
                                          uv_spawn '<path>/rg.exe'. Vendored ripgrep not found; ensure
                                          @codebuff/sdk is up-to-date or set CODEBUFF_RG_PATH. …
   7 hits /  4 sessions  last 2026-10-10  code_search | Code search anomaly: ripgrep exited 0 (matches existed) but
                                          0 matches were collected — …
   7 hits /  6 sessions  last 2026-10-10  run_readonly_command | Command timed out after 30 seconds

# Ledger coverage of these classes in the live file
$ grep -ci 'ripgrep' dev/LEARNINGS.md
0
$ grep -ci 'timed out' dev/LEARNINGS.md
0
$ grep -ci 'web_search\|web search' dev/LEARNINGS.md
1        # an incidental prose mention, not a lesson about the degradation
```

Emission sites confirmed in the tree:

- `packages/agent-runtime/src/llm-api/research-sources.ts:125` — the empty-result notice for a
  missing research key.
- `sdk/src/native/ripgrep-path-fallback.ts` — savant's own ripgrep resolver (FID-2026-0918-007).
  **Attribution open:** the recorded ENOENT text names `@codebuff/sdk` and `CODEBUFF_RG_PATH`,
  so whether the failing resolver is savant's or the host's must be established before that leg
  is assigned. Nothing in this record claims it is savant's defect.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/llm-api/research-sources.ts` (the research/web-search surface)
- The `code_search` tool's spawn and result-collection path (ripgrep resolution — attribution
  open per the evidence above)
- The read-only command runner's timeout path (exact call site **NEEDS-REVIEW**: not located by
  the searches this record cites)
- Every agent plan that consumes a search result: the false premise propagates into synthesis,
  file edits and FID evidence

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

High because the failure is silent and directional: it does not stop work, it misdirects it,
and the four classes together account for 51 recorded failures across 22 distinct sessions.

## Proposed Solution

### Approach

One degradation contract, enforced at the producers rather than at each call site: a result
carries whether the capability ran, and a capability that did not run names itself once, with
the action that fixes it. Then a run-start self-check so a plan can see its capabilities before
depending on them, and the two `code_search` legs made producer-side explicit — no spawn, no
collect, and no ambiguity between them.

### Steps

1. Re-measure the four classes from `dev/experiences/raw-traces.jsonl` at implementation time;
   this record's RED is a 2026-10-12 snapshot and is not a claim about the current window.
2. Define the degradation contract (a typed result stating the capability, that it did not run,
   why, and the one action that resolves it) and its rendering, before touching any individual
   tool — one shape, not four local messages.
3. Make the research surface return that contract for a missing key instead of an empty result
   set, while keeping it a *named degradation* rather than a hard failure: a run that never
   searches must not break.
4. Fix the `code_search` legs: resolve the ripgrep failure attribution first (step 6), then make
   a spawn failure and a zero-collected-matches anomaly both explicit errors, distinguishable
   from a completed search with no hits.
5. Give the read-only timeout path a named outcome carrying the bound and the measured duration,
   so a cut is visible as a cut.
6. Establish the ENOENT attribution — run savant's `sdk/src/native/ripgrep-path-fallback.ts`
   resolver and the host's path against the recorded shape and record which one fails — before
   assigning that leg to either side.
7. Add the run-start capability check: report each capability's state once, before a plan
   depends on it, with no per-turn repetition.
8. Declare the recurrence assertion required by FID-2026-1012-021: each class must be absent
   from the trace ledger for the following window before any lesson is written about it.

### Verification

Re-aggregate the four classes from `dev/experiences/raw-traces.jsonl` over the window that
follows implementation and report their counts and last-seen dates beside this record's
baseline; assert in a focused test that a missing capability produces one named, actionable
notice and never an empty success; assert that a search which could not run is distinguishable
from a completed zero-hit search; and assert the timeout path reports its bound. The gate
declarations, the test paths and the receipt are added when this record reaches
`fixed`/`verified` — asserting them now would be a false declaration.

## Verification Gates

This record is pre-implementation (`Status: converged`, FID-2026-0915-004), so **no gate
bullets are declared**. Gates are allowlisted shapes only and are declared when the status
reaches `fixed`/`verified`, together with the receipt that binds them to the document.

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** four classes, 51 recorded failures across 22 distinct sessions, asserted to be one
  shape — a capability that did not run reported as a capability that ran; ledger coverage of
  the individual classes is zero, and the general rule the ledger does carry was applied to one
  control rather than to the tool surface.
- **GREEN:** one degradation contract at the producers, a run-start capability check, and the
  two `code_search` legs made explicitly distinguishable; the ENOENT leg is not assigned until
  its resolver is attributed.
- **AUDIT:** the counts and dates are re-read from the ledger and pasted above; the two emission
  sites named are the ones this record's searches returned; the third class's call site is
  marked NEEDS-REVIEW rather than guessed.
- **ADVERSARIAL:** (a) does a degradation notice risk becoming noise the model ignores? It is
  emitted once per run, with the resolving action, which is the shape the ledger's own rule
  prescribes — and noise is the current state, where the notice is indistinguishable from data.
  (b) Should a missing research key fail the run? No: a run may legitimately not need search, so
  it is a named degradation, not a hard failure. (c) Is the `code_search` anomaly a third
  defect rather than a leg of this one? It is the same defect observed at the consumer instead
  of the producer; both are fixed by the contract, and the record keeps them in one place so
  the invariant is stated once.
- **CHANGE DELTA:** 0% — pre-implementation. The record converged on a design; no source file
  has been touched.

### Missed Questions

1. **Is the ripgrep ENOENT savant's defect or the host's?** → Unestablished, and deliberately
   not claimed: the recorded text names `@codebuff/sdk`, while savant ships its own resolver.
   The step exists to measure it before assignment.
2. **Is a silent empty result ever the right answer?** → No, and the distinction is the whole
   finding. Zero hits is data; no capability is a missing prerequisite. Collapsing them is what
   the four classes have in common.
3. **Does this overlap with FID-2026-1012-017's incomplete-arguments class?** → They interact:
   an agent given a phantom empty result may spend its next tool call inventing inputs, which is
   the emission-side class. They stay separate records, but 017's budget work must preserve the
   difference between "could not run" and "ran and found nothing".

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing in this record has
> been implemented, so what follows records what was CHECKED at `main` @ `bee0610d` — not what
> was built.

- [x] Every cited path exists at the cited commit, read directly: the research notice at
      `packages/agent-runtime/src/llm-api/research-sources.ts:125` and savant's ripgrep resolver
      at `sdk/src/native/ripgrep-path-fallback.ts`.
- [x] Measurements re-checked: the four class counts, session counts and last-seen dates in the
      Evidence block, aggregated from the 559-record trace ledger on 2026-10-12, plus the three
      ledger-coverage greps against the live `dev/LEARNINGS.md`.
- [x] **Not yet true, and deliberately not claimed:** the repair itself, its gates and its
      receipt. Gates are declared when the status reaches `fixed`/`verified` and the artifacts
      exist.

## Boundaries

- The trace stores each failure's **first line**, so a class can stand for several sub-causes;
  the counts are volumes, not a root-cause attribution, and step 1 re-measures before any fix.
- The read-only timeout class's exact call site was not located in this pass — marked
  NEEDS-REVIEW rather than guessed.
- The ripgrep ENOENT attribution is unresolved by design; the record fixes nothing there until
  it is established.
- No live session was instrumented to reproduce a silent degradation; the classes are measured
  from recorded runs, not observed live in this pass.

## Resolution

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so the finding has an owner, a converged design and a register item with
write authority; it made no source change. The work described above is implemented by whichever
pass flips the record to `fixed`, at which point this section is rewritten in the closure format
(Closed Date / Fix Description / Tests Added / Verification Evidence / Archived) and the
declared gates are added under `## Verification Gates`.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's
  line (registered 2026-10-12 with the root-cause matrix).
- **Design record:** `docs/design/learnings-root-cause-matrix.md` §3 rows 7, 12, 14 and 15,
  §4 root cause RC3, §5 feature E3.
- **Ordering:** consumes the recurrence assertion defined by `FID-2026-1012-021` (the lesson is
  written only after the class stops); shares the research surface with `FID-2026-1012-018`
  (fetch taxonomy) and must preserve the "could not run" distinction that
  `FID-2026-1012-017` depends on.
