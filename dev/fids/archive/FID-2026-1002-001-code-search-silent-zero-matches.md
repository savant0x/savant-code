# FID: code_search silently reports "Found 0 matches" when the run actually failed or dropped events

**Filename:** `FID-2026-1002-001-code-search-silent-zero-matches.md`
**ID:** FID-2026-1002-001
**Severity:** high
**Status:** closed (implemented + verified, 2026-10-02)
**Created:** 2026-10-02 02:23
**Automation level:** 2
**YAGNI-Compliance:** Verified — the fix accounts and reports; it adds no
speculative layer (one outcome classifier, one optional formatter param,
one collector field pair).

---

## Summary

`code_search` intermittently returns `"Found 0 matches"` for patterns that
provably exist. The observed instances carried `Exit code: 0` — but ripgrep
exits 0 only when it FOUND matches, so "exit 0 with zero collected matches" is
internally inconsistent and points at silent event loss in the collector, not
at a clean no-match run. Because the display layer collapses any empty stdout
into "Found 0 matches", a failed or partially-dropped run is
indistinguishable from a genuine absence — an evidence tool lying by omission,
which is the exact failure class FID-2026-1001-003 exists to eliminate.

## Environment

- **OS:** Windows 11 (Git Bash)
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14
- **Tool Versions:** vendored ripgrep resolved via `getBundledRgPath`
  (`sdk/src/native/ripgrep.ts`); `rg` is not on PATH on this host

> **Operator action, 2026-10-02 — add ripgrep to PATH.** `rg` is resolved via
> the vendored `getBundledRgPath` on this host and is not on PATH. Every
> archive-wide or repo-wide claim in this record therefore had to be
> established with real `grep`, not `code_search` — which is recorded elsewhere
> in this file as `code_search` silently reporting zero matches. Installing
> ripgrep on PATH removes the divergence between the evidence tool and the
> ground truth, and makes the exit-0-with-zero-collected contradiction
> diagnosable at the source rather than inferred downstream. This is an
> environment fix, not a code fix: it closes the gap that made this defect
> hard to observe, and does not substitute for steps 1-5 above.

- **Commit/State:** `main` working tree with the FID-2026-1001-003 Batch-1
  changes uncommitted (2026-10-02)

## Detailed Description

### Problem

1. `code_search` returned `"Found 0 matches"` with `message: "Exit code: 0"`
   for a pattern that real `grep` proved exists in 65 files.
2. The same tool call shape worked minutes later (16 matches for a different
   pattern) — the failure is intermittent, so it cannot be dismissed as a
   missing binary alone.
3. The 2026-10-01 session recorded a separate, loud failure mode: `ENOENT`
   on the vendored binary path (that path is already handled — see Root
   Cause).

### Expected Behavior

- A genuine no-match run (`rg` exit 1, zero events, zero parse failures) may
  report `Found 0 matches`.
- Anything else — spawn failure, non-zero/non-1 exit, dropped event lines,
  or the exit-0-with-zero-collected-matches inconsistency — must surface as
  an explicit error or anomaly notice naming the run outcome. Absence-shaped
  evidence must be provably produced by a successful run.

### Root Cause

RED-phase findings by inspection (not yet confirmed by reproduction):

- **Silent event loss (primary):** `sdk/src/tools/code-search/match-collector.ts
  → addEventLine` returns `'ok'` when `parseRipgrepEventLine` fails. Every
  unparseable event line is dropped with no counter, no notice, and no
  effect on the settled result. If all events for a run drop, the run
  settles with zero collected matches — while `rg` still exited 0 because it
  HAD produced matches.
- **Display conflation (amplifier):** `common/src/util/format-code-search.ts
  → formatCodeSearchOutput` maps ANY empty stdout to `'Found 0 matches'`,
  regardless of the run's exit code, stderr, or drop count.
- **Spawn failure is handled separately:** `sdk/src/tools/code-search/executor.ts
  → childProcess.once('error')` (FID-2026-0918-007) settles an explicit
  `errorMessage` for ENOENT, so the 2026-10-01 ENOENT observation is a
  different, already-addressed path.

### Evidence

```text
2026-10-02 (this session):
  code_search { pattern: "## Step Status", cwd: "dev/fids/archive" }
  -> stdout: "Found 0 matches"   message: "Exit code: 0"

  $ grep -rl 'Step Status' dev/fids/archive | wc -l
  -> 65                          (ground truth: the pattern exists)

  code_search { pattern: "hasWiringDeclaration" }        (minutes later)
  -> "Found 16 matches"          (same tool, same session)

2026-10-01 (recorded in dev/session-summaries/2026-10-02-0009):
  ENOENT: C:\Users\spenc\.config\manicode\rg.exe         (loud path, handled)
```

## Impact Assessment

### Affected Components

- `sdk/src/tools/code-search/match-collector.ts` — silent parse-drop
- `sdk/src/tools/code-search/executor.ts` — close-path settlement
- `common/src/util/format-code-search.ts` — empty-stdout conflation
- `sdk/src/tools/code-search/format.ts` — partial/close formatting callers
- Every agent that consumes "Found 0 matches" as NO-MATCH evidence
  (Verifier absence-shaped PASSes, Adversary citation resolution, Detective
  catalogs)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: evidence tooling silently lies by omission; a NO-MATCH PASS can
      be produced from a run that actually found matches
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Fail loud at both layers: the collector must account for every event line it
cannot parse, and the display layer must only render "Found 0 matches" when
the run outcome is a verified clean zero (exit 1 or exit 0 with a consistent
collected-match count). Keep `rg` exit semantics as the ground truth:
0 = matches existed, 1 = no matches, 2 = error.

### Steps

1. Reproduce deliberately: feed malformed ripgrep JSON event lines into
   `RipgrepMatchCollector` and capture the current settled output
   (`Found 0 matches` + `Exit code: 0` expected).
2. Count dropped event lines in the collector; expose the count (and first
   parse error) in the settled result.
3. In `executor.ts`, settle an explicit anomaly when exit is 0 but zero
   matches were collected, or when exit is not 0/1, or when drops occurred —
   carrying stderr and the drop count.
4. In `formatCodeSearchOutput`, accept the run status and refuse to render
   `Found 0 matches` for a non-clean run; render the anomaly instead.
5. Regression tests covering: clean no-match (exit 1) still says
   `Found 0 matches`; malformed event stream surfaces the anomaly; exit 2
   with stderr surfaces the error; exit 0 with zero collected matches
   surfaces the inconsistency.

### Verification

Suite: `sdk/src/__tests__/code-search-fail-loud.test.ts` (declared in
Verification Gates below). Run from the workspace root per T67:
`cd sdk && bun test src/`.

## Verification Gates

- gate: typecheck sdk
- gate: test sdk/src/__tests__/code-search-fail-loud.test.ts
- gate: typecheck common
- gate: test common/src/util/__tests__/format-code-search.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:6a937b4917830d65490a8a5641e50e42178a1ceeae766a4f32fbbf5f73376378
- verified: 2026-10-02T18:20:54.694Z
- typecheck sdk: exit 0
- test sdk/src/__tests__/code-search-fail-loud.test.ts: exit 0
- typecheck common: exit 0
- test common/src/util/__tests__/format-code-search.test.ts: exit 0
- quality: exit 0

## Implementation Record (2026-10-02)

> Implemented under the operator's "resume and complete all work" directive
> (T110 is automation level 2 — within approved scope). The declared gate is
> the planned suite from Verification.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (verified by direct read
      2026-10-02: `match-collector.ts`, `executor.ts`, `format-code-search.ts`,
      `format.ts` — all read 0-EOF before the fix)
- [x] Implementation matches the Proposed Solution (all five steps; see
      below)
- [x] Typecheck/tests/lint pass with pasted tool output: sdk typecheck exit
      0; `sdk/src/__tests__/code-search-fail-loud.test.ts` 14 pass / 0 fail;
      full sdk suite 551 tests / 0 fail (1 pre-existing skip); common
      typecheck exit 0; format-code-search suite 4 pass / 0 fail; eslint 0
      warnings + prettier clean on all touched files; quality-report PASS
- [x] Production call-graph evidence is present for new or repaired wiring:
      `executor.ts → childProcess.once('close')` now calls
      `classifyCodeSearchOutcome` (`sdk/src/tools/code-search/anomaly.ts →
      classifyCodeSearchOutcome`) BEFORE `buildCloseOutput`, and threads
      `emptyResultText` through it so the settled `stdout` can never carry a
      false "Found 0 matches"; anomalies settle via the `errorMessage`
      channel (the same visible channel the FID-2026-0918-007 ENOENT path
      uses, observed in the 2026-10-01 transcript)
- [x] FID status reflects the actual implementation state (`fixed`; the
      receipt contract applies at closure)

### Implementation record (all five steps)

1. **Reproduction:** the suite's first pin feeds the malformed stream the
   old collector silently swallowed — under the old code all three lines
   returned `'ok'` with zero accounting; the pin now asserts the count.
2. **Drop accounting:** `match-collector.ts` carries `droppedEventLines` +
   `firstDroppedLine` (bounded to 200 chars). `schema.ts → parseRipgrepLine`
   discriminates three outcomes — match/context event, benign protocol event
   (`begin`/`end`/`summary` are NOT drops; the old single-type parse treated
   them as unparseable), or unparseable (JSON failure OR schema drift — the
   drop source that previously vanished).
3. **Anomaly settlement:** `executor.ts → childProcess.once('close')` calls
   `anomaly.ts → classifyCodeSearchOutcome` (rg exit semantics are the ground
   truth: 0 = matches existed, 1 = no matches, 2+ = error). Hard anomalies:
   exit-0-with-zero-collected, drop-explained zeros, error exits, signal
   deaths — settled via `errorMessage` carrying stderr + the drop count.
   Drops alongside collected matches settle normally with a visible
   `— warning:` suffix on the exit-code message (Missed Question 3 default).
   The remainder flush moved onto the collector (`flushRemainder`) so every
   close-path line is accounted too.
4. **Display conflation removed:** `formatCodeSearchOutput` takes
   `options.emptyResultText` — an empty/whitespace stdout renders
   "Found 0 matches" ONLY by default (clean call sites unchanged); the
   executor threads the anomaly text through `buildCloseOutput` so an
   anomalous run's stdout cannot carry the false line.
5. **Regression suite:** `sdk/src/__tests__/code-search-fail-loud.test.ts`
   14 pass / 0 fail — reproduction pin ×1, accounting pins ×3, settlement
   pins ×6 (hard anomalies, warning, clean no-match), display pins ×3, and
   the preserved honest no-match pin.

**Accepted limit (stated):** the fix makes every loss LOUD; it does not
recover the lost lines. If the intermittent drop recurs in practice, the
anomaly message names the first dropped line — the reproduction evidence this
record could not produce before — and a decode-level fix (chunk-boundary
handling) becomes a follow-up with real evidence.

## Step Status

> Planning inventory (Anti-Deferral Gate, FID-2026-0817-005). All five
> steps implemented 2026-10-02 (see Implementation Record).

- [x] 1. Deliberate reproduction of the silent zero (collector-level)
- [x] 2. Drop accounting in `RipgrepMatchCollector`
- [x] 3. Anomaly settlement in `executor.ts`
- [x] 4. Display-layer conflation removed in `formatCodeSearchOutput`
- [x] 5. Regression suite written and green

## Perfection Loop

### Loop 1 — RED

- **RED:** Cataloged above from live observation plus source inspection. The
  decisive evidence is the exit-0-with-zero-matches inconsistency: `rg` only
  exits 0 when it found matches, so the collected set — not the search —
  lost them. Root-cause confirmation (deliberate reproduction) is step 1.
- **GREEN:** Not started — status `created`.
- **AUDIT:** Not started.
- **ADVERSARIAL:** One note recorded at creation: intermittency argues
  against retry-only fixes — the failure must be observable when it happens,
  and a retry would hide the evidence that it happened.
- **CHANGE DELTA:** n/a — initial authorship.

### Missed Questions

1. Does the CLI display surface `stderr` and `errorMessage` from a settled
   result, or only `stdout`? → Verify in step 1; the fix must ride the
   fields the display actually renders (the observed transcript showed
   `stdout` plus `message`, so at minimum `message` is visible).
2. Is `rg` invoked with `--json`, and can the JSON schema drift between
   bundled ripgrep versions? → Confirm in step 1; if schema drift is the
   drop source, the parse failure must name the schema mismatch.
3. Should a dropped-event anomaly be a hard error or a warning attached to
   partial results? → Default: hard anomaly when drops explain a zero or a
   count mismatch; warning when collected matches are non-empty and the run
   otherwise succeeded.

## Resolution

- **Closed Date:** 2026-10-02 (operator-directed closure; implemented
  `fixed` the same day)
- **Fix Description:** drop accounting in the collector, run-outcome
  classification at close (`anomaly.ts`), anomaly settlement through the
  error channel, and the empty-result override in the display formatter.
- **Tests Added:** `sdk/src/__tests__/code-search-fail-loud.test.ts` (14).
- **Verification Evidence:** sdk + common typecheck exit 0; fail-loud suite
  14/14; full sdk suite 551/0 (1 pre-existing skip); eslint 0 warnings;
  prettier clean; quality-report PASS.
- **Archived:** 2026-10-02 (moved to `dev/fids/archive/`)

## Lessons Learned

Provisional: absence-shaped evidence must be provably produced by a
successful run. "Exit 0 with zero matches" is self-contradictory for
ripgrep, and any consumer of a search tool must be able to distinguish
"searched and found nothing" from "could not search".
