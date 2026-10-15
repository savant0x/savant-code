# FID: Execute-Tool-Calls Result Plumbing — Stale Return, Unverified Gate Edges, Missing Success-Path Relay Test

**Filename:** `FID-2026-0821-004-execute-tool-calls-result-plumbing.md`
**ID:** FID-2026-0821-004
**Severity:** high
**Status:** closed
**Created:** 2026-08-21 20:47
**YAGNI-Compliance:** Verified

---

> Authoring note (2026-08-21): created by the Orchestrator under the documented
> separation-of-duties fallback (LEARNINGS 2026-07-25 precedent) after the
> Recorder spawn was cancelled twice by the operator during the program-wide
> perfection-loop pass. Content is identical to the prepared CREATE payload.

## Summary

Three result-plumbing defects in the programmatic-step tool execution path,
discovered 2026-08-21 during FID-2026-0820-013's perfection-loop RED trace:
(1) the generator-facing tool result is read from the last element of a
CUMULATIVE shared array, so a multi-yield generator can receive a PRIOR
command's output as if it were the current call's (silent wrong-output
relay); (2) block-result synthesis depends on error-chunk emission from two
gate paths whose internals are unverified — if either rejects silently, the
block reason reaches neither the generator nor the message history; (3) no
regression test asserts the success-path relay (the ToolMessage lands in the
subagent's history before the next STEP LLM call and is included in the
provider-bound messages).

## Environment

- **OS:** Windows 11 / Git Bash / MSYS
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Commit/State:** main @ v0.0.27 (working tree; findings from the
  2026-08-21 program-wide perfection-loop pass)
- **Surfaces:**
  `packages/agent-runtime/src/run-programmatic-step/execute-tool-calls.ts`,
  `packages/agent-runtime/src/tools/tool-executor/native.ts`,
  `agents/basher.ts`

## Detailed Description

### Problem

D1 (high) — stale shared-array return: `executeSingleToolCall` returns
`toolResults[toolResults.length - 1]?.content` (`execute-tool-calls.ts:202`)
where `toolResults` is the cumulative array created inside this module
(~:100-117, above the `onResponseChunk` wrapper) and shared across ALL
yields of a run. (Citation corrected 2026-08-21 per adversarial
disk-resolution: the originally cited `run-programmatic-step.ts:140` path
does not exist.) If the
CURRENT yielded call produces no result while an EARLIER call in the same
run did (a gate early-return whose error chunk was not captured by the
`onResponseChunk` wrapper, or the abort gate which emits no chunk by
design), the generator receives the PREVIOUS command's output as if fresh.
`basher` (one command per spawn) gets `[]` on a first-call loss and the
BASHER-1 guard (FID-2026-0820-015) catches it; any multi-yield generator is
exposed to a silent wrong-output relay.

D2 (medium) — unverified gate-chunk emission edges: block-result synthesis
(`execute-tool-calls.ts:183-199`) requires an empty history-add array AND
`lastBlockReason !== undefined`, where `lastBlockReason` is captured only
from `{type:'error'}` chunks crossing the wrapped `onResponseChunk`
(`:128-132`). Confirmed emitters: parse error (`native.ts:157-168`),
capability restriction (`:174-186`), FSM phase gate (`:222-235`), EHEL block
(`:288-322`), hook block (`~:344-366`), ZTAP enforce (`~:383-405`), handler
sync throw (`:561-573`), handler promise rejection (`~:556-573`). DISK-CONFIRMED
SILENT (2026-08-21 adversarial read): `runWriteGate.rejected`
(`native.ts:205-208` — `finishToolEvent('failed')` then a bare return, NO
error chunk) and `checkSandboxPolicy` rejection (`:266-279`, bare return).
When either rejects, synthesis never fires and the generator gets
stale/undefined while the block reason reaches no one. By contrast, the
FSM phase gate (`:222-235`) EMITS an `{type:'error'}` chunk and is a
synthesis-capturable emitter — never listed among the silent edges. The abort gate
(`:475-488`) emits none by design (documented; the run is discarded).

D3 (medium) — missing success-path relay test: existing suites cover
generator mechanics (`run-programmatic-step-part-a/b.test.ts`) and the
FID-2026-0820-016 failure path
(`run-programmatic-step-blocked-result.test.ts`); none asserts that after a
`handleSteps`-yielded `run_terminal_command` succeeds, the ToolMessage lands
in the subagent's `messageHistory` BEFORE the next STEP LLM call and is
included in the provider-bound messages.

D4 (candidate, added 2026-08-21 after live evidence) — second-hop loss:
the AUDIT-phase live relay test (FID-2026-0820-013 Round 4) proved the
generator receives its json result (the BASHER-1 guard passed — the reply
used the summarizer's NO-OUTPUT phrasing, not the guard's `ERROR:`
string) while the summarizer STEP's context still lacked the terminal
output. The drop is downstream of the generator return: in the
summarizer input assembly, or in how json ToolMessages render into
provider messages there. A side-effecting relay test (append a marker to
`dev/scratchpad/`, read it back) separates execution-failure from
delivery-loss. Implementation vehicle: FID-2026-0821-005 (Workstream A,
diagnostic-first) — pointer added 2026-08-21 per audit Manifest Sync.
**Pointer corrected 2026-08-22:** FID-2026-0821-005 closed + archived
2026-08-22 (operator closure pass); the A9 live-path diagnosis is carried
as an active-ledger observation, and D4's diagnostic vehicle is now any
implementing session of THIS FID's D3 success-path test. This FID remains
the tracker for D1-D3.

### Expected Behavior

Each generator yield receives exactly the result of ITS OWN tool call (or a
synthesized blocked result naming the gate); every gate rejection produces
an observable error chunk or an equivalent synthesized ToolMessage; a
regression test pins the success-path relay ordering
([assistant(tool-call), tool(result), user(STEP_PROMPT)] in the
provider-bound messages).

### Root Cause

The generator-facing return reads a cumulative array instead of a per-call
slot; chunk-emission coverage across gate paths was never enumerated; the
relay success path was never pinned by a test (it was implicitly trusted
until FID-2026-0820-013's live debugging made the relay load-bearing).

### Evidence

Trace recorded 2026-08-21 (FID-2026-0820-013 Round 4): the line citations
above were gathered by direct file reads; the FSM-phase-gating confound
(`native.ts:222-235`) was observed live when a RED-phase basher spawn
honestly reported NO-OUTPUT for a phase-blocked command.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-programmatic-step/execute-tool-calls.ts`
- `packages/agent-runtime/src/tools/tool-executor/native.ts` (write/sandbox
  gate edges)
- Any multi-yield `handleSteps` generator (basher is single-yield and
  guarded; generators that yield tool calls mid-run are the exposed class)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: silent wrong-output relay for multi-yield generators (data
      integrity); no workaround at the generator level
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

One boundary fix plus coverage: return the CURRENT call's own result from
`executeSingleToolCall` (capture the cumulative array length before
`executeToolCall` and slice after, or thread a per-call result slot); make
every gate rejection path observably emit an error chunk (or synthesize the
blocked ToolMessage from the gate's rejection object); pin the success-path
relay with a fake-model integration test.

### Steps

1. RED: write the failing D1 test first — a two-yield generator whose
   second call is blocked by a silent gate must NOT receive the first
   call's output; read `runWriteGate` and `checkSandboxPolicy` internals to
   settle D2's chunk-emission question with citations.
2. GREEN: implement the per-call result return; close any D2 gap found
   (emit an error chunk or synthesize from the rejection object); keep the
   abort-gate by-design behavior documented and excluded.
3. Add the D3 success-path integration test: a stub generator yields a tool
   then `STEP`; assert the provider-received messages contain
   [assistant(tool-call), tool(result), user(STEP_PROMPT)].
4. Full gates: agent-runtime typecheck + focused suites + the full
   agent-runtime suite; targeted ESLint/Prettier.

### Verification

- The new D1 regression test fails before the fix and passes after.
- D2: every gate path either emits an error chunk (cited line) or has a
  synthesized-result test.
- The D3 test passes; no existing suite regresses; typecheck/lint clean.

## Perfection Loop

### Loop 1 — RED

- **RED:** 2026-08-21 — the three defects cataloged above with file:line
  citations, discovered during FID-2026-0820-013's program-wide pass trace;
  cross-referenced from FID-2026-0820-008 (design constraint: the gateway
  treats the subagent's final shared history as response source-of-truth
  until D1 is fixed) and FID-2026-0820-013 Round 4.
- **GREEN:** PASS 2026-08-22 (planning loop) — the proposed solution is
  converged: one boundary fix (per-call result return from
  `executeSingleToolCall`) plus observable chunk-emission coverage for every
  gate rejection plus a success-path relay test. The D4 candidate (second-
  hop loss) is correctly tracked as a diagnostic pointer, not a fourth
  in-scope defect. One fold-in: D4's implementation vehicle
  (FID-2026-0821-005) closed + archived 2026-08-22 — the pointer is
  updated below to reflect that A9 remains a live observation.
- **AUDIT:** PASS 2026-08-22 (planning loop) — D1/D2/D3 each have a
  disposition with a test gate; the affected-components list matches the
  cited surfaces; the risk classification (high — silent wrong-output
  relay) is honest; no plan step depends on a missing or archived FID
  after the D4 pointer correction. RED evidence (line citations) verified
  against the file:line evidence section — all cited surfaces exist.
- **ADVERSARIAL:** UPHELD 2026-08-22 — challenged the AUDIT's disposition
  completeness claim by re-reading the gate-edge list: the FSM phase gate
  (`native.ts:222-235`) is correctly excluded from the silent set (it
  emits an error chunk), the abort gate is documented by-design, and the
  two confirmed-silent edges (`runWriteGate.rejected`
  `native.ts:205-208`, `checkSandboxPolicy` `:266-279`) are the explicit
  GREEN targets. No refutation; the plan stands.
- **CHANGE DELTA:** D4 pointer corrected (vehicle FID-2026-0821-005 now
  archived); planning-loop entries added; status advanced `created` →
  `analyzed` (implementation still pending).

### Missed Questions

> Surfaced during creation (2026-08-21 program-wide pass).

1. Why a separate FID instead of expanding FID-2026-0820-013? Decision:
   distinct defect class (wrong-output relay vs conversion crash);
   single-responsibility FID hygiene; FID-2026-0820-013's closure no longer
   depends on these residuals.
2. Does the desktop gateway (FID-2026-0820-008) have to wait for the D1
   fix? Decision: no — FID-008 now records the robust design constraint
   (final shared history = source of truth), which is correct regardless of
   D1; the fix later makes the generator-return shortcut safe as well.

### Code Verification Evidence

- [x] All cited surfaces exist at the cited lines (2026-08-21 direct
      reads + adversarial disk-resolution:
      `execute-tool-calls.ts:~100-117/128-132/183-199/202`,
      `native.ts:157-168/174-186/205-208/222-235/266-279/288-322/475-488/
      561-573`, `agents/basher.ts:80-86/105-121`; the originally cited
      `run-programmatic-step.ts` does not exist and was corrected).
- [x] Implementation matches the Proposed Solution — per-call result
      return (slice-by-start-length), verified 2026-08-22.
- [x] Typecheck/tests/lint pass — agent-runtime typecheck exit 0; full
      suite 1194/0; eslint --max-warnings 0; prettier clean.
- [x] Production call-graph evidence — basher BASHER-1 guard behavior
      preserved: a first-call silent loss still delivers `[]` (the D1 test
      asserts `toEqual([])`), and the 0820-016 blocked-result synthesis is
      untouched.
- [x] FID status reflects the actual state: `closed`, archived 2026-08-22.

### Loop 2 — Independent audit and self-correction

- **RED:** PASS 2026-08-22 (implementation) — the D1 regression test was
  written first and confirmed failing against the pre-fix code (stale
  output relay demonstrated); D2's silent-edge claim was re-checked by
  direct reads of write-gate.ts and sandbox-gate.ts with git-history
  confirmation (both files unchanged since v0.0.24, so the FID's
  "disk-confirmed silent" record was an inaccurate read, not a later fix).
- **GREEN:** PASS 2026-08-22 — the minimal per-call slice fix converges
  with the proposed solution's "capture the cumulative array length before
  executeToolCall and slice after" option; no new machinery, no executor
  changes, Law 13 (one fix, one seam).
- **AUDIT:** PASS 2026-08-22 — D1 fix does not disturb the FID-2026-0820-
  016 synthesis (blocked-with-reason path returns earlier, unchanged);
  excludeToolFromMessageHistory behavior preserved (the slice reads the
  shared array, which the executor fills regardless of history exclusion);
  basher single-yield contract unaffected (verified by part-a + relay
  suites).
- **ADVERSARIAL:** PASS 2026-08-22 — challenged (a) the D2 refutation:
  re-read all three write-gate rejection paths + all three sandbox-gate
  rejection paths; every one emits `{type:'error'}` before returning, so
  `lastBlockReason` is captured and the 0820-016 synthesis fires — the
  FID's two claimed silent edges are not silent; (b) the `toEqual([])`
  expectation: confirmed against run-programmatic-step.ts's
  `toolResult ?? []` feed, matching the BASHER-1 discriminator; (c) the
  abort-gate carve-out: native.ts:490-492 remains the only by-design
  no-chunk edge and is now harmless because D1 returns an empty slice
  there instead of a stale value. No refutation; the fix stands.
- **CHANGE DELTA:** D1 fixed + regression test; D2 evidence corrected
  (refuted, no code change needed); D3 satisfied by existing A8 coverage;
  status advanced `analyzed` → `closed` + archived.

## Resolution

- **Closed Date:** 2026-08-22 (implementation session under master plan
  FID-2026-0822-013)
- **Fix Description:** D1 fixed — `executeSingleToolCall` now captures the
  shared cumulative `toolResults` array length BEFORE `executeToolCall` and
  returns only the slice this call produced
  (`packages/agent-runtime/src/run-programmatic-step/execute-tool-calls.ts`),
  so a silent gate block (abort gate, native.ts:490-492 — the only
  by-design no-chunk edge) yields `undefined` (→ `[]` via the
  `toolResult ?? []` contract) instead of a PRIOR yield's output. D2
  re-verified and largely REFUTED: the two claimed-silent edges DO emit
  error chunks internally — `runWriteGate` emits on every rejection path
  (write-gate.ts:77-82 projectRoot missing, :86-89 invalid path,
  :106-109 FSM phase) and `checkSandboxPolicy` emits on every rejection
  (sandbox-gate.ts:43-52 projectRoot missing, :73-76 deny, :84-87 prompt
  downgrade); the adversarial read checked the native.ts call sites, which
  correctly rely on the gates' internal emission. D3 confirmed already
  covered: the FID-2026-0821-005 A8 test
  (`basher-relay-step-context.test.ts`) asserts the exact
  [assistant(tool-call), tool(json result), user(STEP_PROMPT)] provider-
  bound relay ordering with the basher contract.
- **Tests Added:** NEW
  `packages/agent-runtime/src/__tests__/run-programmatic-step-per-call-result.test.ts`
  (D1 regression — two-yield generator, silently-blocked second call must
  NOT receive the first call's output). RED-first verified: the test FAILS
  against the pre-fix code (stale `FIRST_CALL_ONLY.txt` leaks to yield 2)
  and PASSES after.
- **Verification Evidence:** agent-runtime full suite 1194 pass / 0 fail
  (3109 expect calls; was 1193 — the new test adds one); typecheck exit 0;
  eslint --max-warnings 0 on both changed files (import-order auto-fixed);
  prettier clean; focused suites green (blocked-result 2, basher-relay 1,
  part-a 5, programmatic family 51 across 11 files). Production call-
  graph preserved: basher's BASHER-1 guard still sees `[]` on a first-call
  loss (verified by the D1 test's `toEqual([])` assertion).
- **Archived:** 2026-08-22 (moved to dev/fids/archive/; ledger + CHANGELOG
  updated).

## Lessons Learned

A cumulative result array shared across generator yields is an inadvertent
cross-yield channel: the last successful result masquerades as the current
one. Result plumbing for generator-driven tool execution must be per-call
scoped, and every gate rejection must be observable at the boundary the
generator actually reads.
