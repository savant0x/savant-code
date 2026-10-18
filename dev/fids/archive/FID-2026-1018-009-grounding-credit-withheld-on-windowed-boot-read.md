# FID: Session-init grounding never clears when the protocol file is read with a `limit`

**Filename:** `FID-2026-1018-009-grounding-credit-withheld-on-windowed-boot-read.md`
**ID:** FID-2026-1018-009
**Severity:** high
**Status:** closed
**Created:** 2026-10-18 19:35
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

A live CLI turn ended without performing the work it was asked to do. The trace
shows the model was told to spawn three bashers, answered with one sentence and
made **no tool call at all**; the UI returned to idle as if the turn had
completed. The cause is not a hang: the agent loop ran three corrective
iterations of the session-init grounding gate, then the completion gate
disarmed and let the ungrounded turn end. Grounding never cleared because the
boot read of `ECHO.md` carried `limit: 2000`, and the credit path treated the
mere PRESENCE of `limit` as a partial read — even though the 923-line file came
back whole. The required set therefore stayed permanently incomplete.

## Environment

- **OS:** Windows 11, 31.1 GB physical memory
- **Language/Runtime:** TypeScript, Bun 1.3.14, OpenTUI 0.5.3
- **Tool Versions:** pinned repository dependencies
- **Commit/State:** `main` at `e88b4f3d`, clean tree, model
  `river/deepseek-ai/DeepSeek-V4.1-Flash`, agent template `savant`

## Detailed Description

### Problem

The operator ran the LIVE-003 / FID-2026-1018-008 reproduction (a prompt that
spawns three 45-second bashers). The assistant replied:

> I'll transition to GREEN first (basher commands require GREEN/AUDIT/SELF-CORRECT), then spawn exactly three bashers in one call.

and then nothing happened: no `transition_phase`, no `spawn_agents`, no error,
no further output. The run was reported as "freezing before even reaching the
basher step".

### Expected Behavior

The turn either performs the requested tool call or reports why it cannot. A
model that has read the boot set must not be treated as ungrounded, and a turn
must never be silently allowed to end because the *gate's bookkeeping* failed.

### Root Cause

Grounding credit is recorded only when `completeGroundingReads()` accepts the
response, and that function refused every entry of a call that carried a
`limit` key:

```ts
// packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts (before)
const reads = completeGroundingReads({
  output: toolResult.content,
  hasWindow: 'offset' in toolCall.input || 'limit' in toolCall.input,
})
```

The harness grounding set is `ECHO.md`, `ARCHITECTURE.md`,
`protocol.config.yaml`, `docs/embedded-learnings.md`
(`common/src/constants/learnings-boot.ts:3`, `packages/agent-runtime/src/echo/grounding.ts:12`).
The live run read those four across two calls, and the first carried a limit:

```text
step=14 #3 read_files {"paths":["ECHO.md"],"limit":2000}
step=14 #4 read_files {"paths":["ARCHITECTURE.md","protocol.config.yaml","docs/embedded-learnings.md"]}
```

`ECHO.md` is 923 lines, so `limit: 2000` returned the whole file
(`extractLineWindow` returns the file's own tail once the range runs past EOF,
`common/src/util/read-window.ts:29`) — but the key-presence test classified it
as a window, so `ECHO.md` never joined `completedPaths`. The other three
credited. `isGroundingCompleteOp()` requires exact set equality
(`packages/agent-runtime/src/echo/enforcement/grounding-ops.ts:61`), so
`protocolRead` never became true.

The loop then did what it is designed to do with a model that "has not read the
protocol": `evaluateUngroundedTurnEndImpl` blocked the turn end and injected
the steering message (`packages/agent-runtime/src/echo/enforcement/turn-end.ts:263`).
The model re-issued the same two calls (identical window included), so the
retry could never succeed; after `COMPLETION_GATE_MAX_RETRIES = 3` the gate
disarmed with its notice and allowed the turn to end
(`packages/agent-runtime/src/echo/enforcement/helpers.ts:68`).

The tool's own schema teaches the failing call shape, so this is not an
operator misuse: `read_files`' `offset` parameter is described as "Use with
`limit` to read a window of a large file (e.g. ECHO.md) without loading it
whole" (`common/src/tools/params/tool/read-files.ts:46`).

### Evidence

Live trace, `debug/trace.jsonl`, run `09d02e45-da90-4e1b-911a-657bff29bdde`:

```text
23:21:51.492 Start agent savant step 14 … messageCount 14
23:21:53.075 MSG assistant #3 read_files {"paths":["ECHO.md"],"limit":2000}
23:21:53.075 MSG assistant #4 read_files {"paths":["ARCHITECTURE.md","protocol.config.yaml","docs/embedded-learnings.md"]}
23:21:53.078 EVT step_finished step=1 completed
23:21:53.079 MSG user #13 "<user_message>Session-init grounding req…"   <- steering 1
23:21:54.693 MSG assistant #3/#4  (identical reads, step 15)
23:21:54.696 EVT step_finished step=2 completed                          <- steering 2
23:21:56.222 MSG assistant #3/#4  (identical reads, step 16)
23:21:56.225 EVT step_finished step=3 completed                          <- steering 3
23:21:58.071 MSG assistant #17..#30 (one sentence, split per delta, no tool block)
23:21:58.073 EVT step_finished step=4 completed
23:21:58.075 EVT terminal step=5 completed
23:21:58.080 [finish-logic] UI reset to idle
```

`debug/cli.exit.log` shows no exit record after that run: the process was alive
and idle, not dead. The earlier `process-exit@renderer-cleanup.ts:122` entry at
23:20:04 belongs to the previous session (uptime 689 s).

Both test suites that cover the seam pass with the repaired rule, and the
pre-fix behaviour is what the live trace already recorded:

```text
$ cd packages/agent-runtime && bun test src/echo/__tests__/enforcement-protocol-gate.test.ts \
    src/tools/tool-executor/grounding-read.test.ts src/tools/tool-executor/result-lifecycle.test.ts
 27 pass
 0 fail
 75 expect() calls
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/tool-executor/grounding-read.ts`
- `packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts`
- `packages/agent-runtime/src/echo/__tests__/enforcement-protocol-gate.test.ts`
- `packages/agent-runtime/src/tools/tool-executor/grounding-read.test.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

A model that keeps a large protocol file read windowed (the documented shape
for `ECHO.md`) can never complete grounding, so every turn of such a session
burns three loop iterations, replays the full boot reads, and then ends without
the requested work. There is no operator-side workaround: the steering message
tells the model to read the file it has already read.

## Proposed Solution

### Approach

Judge the window by its EFFECT on the response instead of by the presence of a
key. `windowIsPartial()` treats an `offset` past line 1 as always partial, and
a `limit` as partial only when the response actually used it up — a slice
shorter than the limit provably reached EOF, because `extractLineWindow`
returns the file's own tail once the range runs past it. The window is parsed
once, in the same module as the predicate (`readLineWindow`), so the executor
call site cannot drift.

### Steps

1. `grounding-read.ts` — add `ReadLineWindow`, `countRenderedLines`,
   `windowIsPartial` and `readLineWindow`; `completeGroundingReads` takes
   `lineWindow` and evaluates partiality **per entry**. `implemented`
2. `result-lifecycle.ts` — pass the parsed window instead of a boolean from key
   presence. `implemented`
3. Tests — helper-level coverage of the generous limit, the used-up limit and
   input parsing; gate-level coverage of the same seam the executor uses
   (`completeGroundingReads` → `recordSuccessfulGroundingRead` →
   `evaluateUngroundedTurnEnd`). `implemented`

### Verification

`bun test` on the two touched suites, `tsc --noEmit -p .` for
`packages/agent-runtime`, ESLint and Prettier on the touched files, and the
repository validator.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/tools/tool-executor/grounding-read.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/enforcement-protocol-gate.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** The live trace names the mechanism: four boot reads (one windowed),
  three identical retries, a disarm and a text-only turn end. The credit path
  and the required-set equality are cited above with `file:line`.
- **GREEN:** Effect-based window predicate, parsed once and applied per entry.
- **AUDIT:** 27 tests pass across the three suites; `tsc` exit 0; ESLint 0;
  Prettier clean; `validate:repository` PASS.
- **ADVERSARIAL:** The new rule must not credit a genuinely partial read. It
  cannot do so on an `offset > 1`; on `limit` it credits only a response
  shorter than the limit. The one shape it cannot distinguish from text alone
  is a file whose line count equals the limit exactly — documented in the
  function's comment, and left with the previous (conservative) no-credit
  verdict. The alternative, comparing against the file on disk in the executor,
  would add I/O and a path-resolution surface to the hot seam for that single
  edge, so it was rejected.
- **CHANGE DELTA:** new FID, no prior text to diff.

### Missed Questions

1. *Should the credit predicate be per call or per file?* Per file — a batch can
   mix a 5-line and a 5,000-line file, one reaching EOF and the other cut at the
   limit. The old call-level boolean could not express that; the new code
   evaluates each returned entry.
2. *Does the tool, or the harness, own the definition of "complete read"?* The
   harness owns the verdict, but the tool owns the fact: `extractLineWindow`
   already returns the tail at EOF, so the fact is observable from the response
   and needs no new plumbing.
3. *Should the completion gate stop disarming when the retry is hopeless?* Out
   of this FID's scope and unchanged here, but the disarm notice is what makes
   the failure silent — a follow-up should consider surfacing the disarm in the
   transcript rather than only appending history.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `59d6226f` — `fix(runtime): credit a windowed boot read
      that reached EOF (FID-2026-1018-009)`.
- [x] **File:line ranges:** `grounding-read.ts:17-60` (line counting, window
      predicate, window parsing), `grounding-read.ts:83` (per-entry rejection),
      `result-lifecycle.ts:4,134` (call site),
      `enforcement-protocol-gate.test.ts:225,242` (seam tests).
- [x] **Gate output:** 27 pass / 0 fail on the three suites; `tsc` exit 0;
      ESLint exit 0; Prettier clean; `validate:repository` PASS.
- [x] **Reproducibility:** `grep -rn "windowIsPartial" packages/agent-runtime/src`
      matches `grounding-read.ts:45,83`.
- [x] **Step statuses:** all three Proposed Solution steps `implemented`.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence: `result-lifecycle.ts:134` calls
      `readLineWindow`, which `grounding-read.ts:55` defines; `windowIsPartial`
      is consumed at `grounding-read.ts:83` in the same module.
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** First run of the touched files failed the repo gates on import order
  (2 warnings) and Prettier on two files — my own new imports, not existing
  debt.
- **GREEN:** Import order fixed with `eslint --fix`; Prettier applied; both
  re-run clean afterwards.
- **AUDIT:** Tests re-run after the fixes (files had changed, so the earlier
  green run did not cover them): 27 pass / 0 fail.
- **ADVERSARIAL:** Confirmed no other caller depends on the removed
  `hasWindow` contract (`grep -rn "hasWindow" packages/agent-runtime sdk cli` →
  no matches).
- **CHANGE DELTA:** small, confined to four files.

### Loop 3 — Final convergence

- **RED:** Residual risk is the exact-line-count edge described above.
- **GREEN:** Documented in the predicate's comment and covered by the
  "used-up limit" test.
- **AUDIT:** Gate set green on the final tree.
- **ADVERSARIAL:** The live outcome (a turn that reaches the basher step) is
  **not** claimed here; it needs an operator run and is tracked separately.
- **CHANGE DELTA:** none after the audit.

## Resolution

- **Closed Date:** 2026-10-18 19:40
- **Fix Description:** Grounding credit now follows the window's effect. A
  `limit` the response never used up no longer withholds credit for a fully
  returned file, so the harness grounding set can complete and the session-init
  gate clears instead of stalling the turn into the completion-gate disarm.
- **Tests Added:** Yes — two helper-level tests (generous limit credits;
  used-up limit does not) and two gate-level tests through the executor seam
  (generous limit clears the gate for all four boot files; a real 50-line
  window still blocks).
- **Verification Evidence:** 27 pass / 0 fail; `tsc --noEmit` exit 0; ESLint 0;
  Prettier clean; `validate:repository` PASS; Markdown lint 0.
- **Archived:** 2026-10-18 19:40

## Lessons Learned

- A gate's *bookkeeping* failure is indistinguishable, to the operator, from a
  hang: the loop spins, no tool runs, and the screen just stops. When a
  completion gate disarms, that disarm belongs in the transcript.
- Key-presence is not behaviour. `'limit' in input` describes what the caller
  typed, not what the tool did; every "was this a windowed read?" decision must
  be made from the response, which carries the fact.
- The tool description and the gate must agree. The schema tells the model to
  pass `limit` when reading `ECHO.md`; the gate used that same parameter as
  evidence of an incomplete read.
