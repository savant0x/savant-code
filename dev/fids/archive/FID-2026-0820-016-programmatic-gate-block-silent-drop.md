# FID: Programmatic Gate Blocks Silently Drop Results — Orphaned Tool-Calls and Evidence-Free NO-OUTPUT

**Filename:** `FID-2026-0820-016-programmatic-gate-block-silent-drop.md`
**ID:** FID-2026-0820-016
**Severity:** high
**Status:** closed
**Created:** 2026-08-20 23:20
**Author:** Savant (Orchestrator)
**Parent:** FID-2026-0820-013 (output-injection family, Round 3 open item)

---

## Summary

When any execution gate blocks a programmatic (handleSteps-generator) tool
call — FSM phase gate, sandbox policy, EHEL enforcement, capability check —
the executor returns early WITHOUT creating or pushing a tool result. Three
compounding failures result:

1. **Silent evidence drop:** the generator receives an empty toolResult. For
   the basher this surfaced as the silent "no command output in my context"
   relay loss from FID-2026-0820-013 (pre-FID-015-fix instances fabricated
   output; post-fix instances reply NO-OUTPUT with zero diagnosability).
2. **Orphaned tool-call in history:** the assistant tool-call part was pushed
   BEFORE execution, but no matching tool-result follows — an invalid
   call/result pairing in the subagent's message history.
3. **The block reason never reaches the model:** the gate's error chunk
   streams to the parent's response channel only. The subagent model is told
   nothing about why its command never ran.

Live-confirmed root cause for the basher: the sandbox gate's prompt-mode
downgrade. `run_terminal_command` under the default `'prompt'` permission
mode returns `{ type: 'prompt' }` from `evaluateToolCall`, which
`checkSandboxPolicy` downgrades to deny ("Phase 1: no interactive TUI
permission modal yet") because a subagent has no approval channel. The
command never executes in any FSM phase.

## Environment

- **OS:** Windows 11 / Git Bash; Bun 1.3.14 monorepo
- **Harness:** `bun dev` from the working tree (operator-confirmed; NOT a
  stale binary — see FID-2026-0820-013 Live Verification Round 2)
- **Permission mode:** default `'prompt'` (protocol.config.yaml sandbox
  block; actual mode controlled by --permission-mode / /permissions)

## Detailed Description

### Problem

All 11 early-return block sites in
`packages/agent-runtime/src/tools/tool-executor/native.ts` (lines 170, 188,
208, 235, 280, 324, 361, 382, 459, 472, 573) follow the same pattern:
`onResponseChunk({ type: 'error', ... })` + `finishToolEvent('failed')` +
`return previousToolCallFinished`. For the MAIN agent's stream-parser path
this is handled — the parser converts error chunks into user messages for
API compliance (native.ts:183-186 comment). For the PROGRAMMATIC path
(`executeSingleToolCall` in
`packages/agent-runtime/src/run-programmatic-step/execute-tool-calls.ts`)
nothing compensates: the assistant tool-call part was already pushed to
history (execute-tool-calls.ts:76-88), the executor returns without pushing
a tool result (native.ts:603 push never runs), and
`agentState.messageHistory.push(...toolResultsToAddToMessageHistory)`
(execute-tool-calls.ts:160) pushes an empty array.

### Root Cause (live-confirmed with probes)

RED experiment matrix (basher artifact probes, 2026-08-20 22:50-23:10):

- **Probe under parent FSM phase RED:** command never executed (artifact
  `dev/scratchpad/basher-relay-probe.txt` absent) — the FSM gate
  (native.ts:225-239) blocks `run_terminal_command` for RED/idle phases.
  Subagents inherit `fsmPhase: parentAgentState.fsmPhase`
  (spawn-agent-utils.ts:199), so RED-phase spawns are hard-blocked by
  design.
- **Probe under parent FSM phase GREEN:** command STILL never executed
  (artifact `dev/scratchpad/basher-relay-probe-green.txt` absent) — the FSM
  gate passes (green inherited), but the SANDBOX gate fires:
  `checkSandboxPolicy` (sandbox-gate.ts:73-87) downgrades the prompt-mode
  decision to deny because subagents have no approval channel
  ("Phase 1: no interactive TUI permission modal yet. Downgrade to deny in
  headless mode."). Block site native.ts:280 returns early — no tool result.

Both probes: basher replied exactly `NO-OUTPUT: result not delivered`
(FID-2026-0820-015's fabrication fix working as designed) — with zero
diagnosability because the block reason never reached the model.

### Expected Behavior

- A blocked programmatic tool call produces a COMPLETE call/result pair in
  history; the tool result carries the block reason.
- The generator receives the blocked result so the agent can report,
  retry, or escalate honestly.
- The FSM gate's RED/idle-phase block remains (correct governance) — but
  becomes VISIBLE to the agent instead of silent.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-programmatic-step/execute-tool-calls.ts`
  — the single programmatic boundary (Law 13 fix site)
- Every programmatic agent whose generator yields a gate-blockable tool:
  basher (run_terminal_command), and any agent hitting FSM/sandbox/EHEL
  blocks

### Risk Level

- [ ] Critical
- [x] High: silent evidence drop in the verification chain; the basher — the
      harness's command-execution service — cannot run at all under the
      default permission mode, and the failure is invisible to the agent
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor or cosmetic issue

## Proposed Solution

### Approach

Synthesize the blocking tool result at the single programmatic boundary
(Law 13) rather than at each of the 11 block sites. Refined per the Thinker
missed-questions pass (Loop 1 GREEN): the generator-return channel and the
history-push channel are split, synthesis is scoped to the gate-block
signature (a captured error chunk), and the synthesized result reuses the
pre-execution toolCallId for pair correlation.

### Steps (implemented as refined)

1. In `executeSingleToolCall` (execute-tool-calls.ts), capture `error`-type
   chunks in the existing `onResponseChunk` wrapper into a
   `lastBlockReason` local (the wrapper already exists for parentAgentId
   wiring). The write-gate site emits through the callback passed INTO
   `runWriteGate`, so the same wrapper captures it.
2. After the `executeToolCall` await and the existing
   `messageHistory.push(...toolResultsToAddToMessageHistory)` spread:
   if `toolResultsToAddToMessageHistory.length === 0 && lastBlockReason !==
   undefined`, synthesize a ToolMessage `{ role: 'tool', toolName,
   toolCallId, content: [{ type: 'json', value: { blocked: true, reason:
   lastBlockReason } }] }` — reusing the SAME `toolCallId` local assigned to
   the pre-execution assistant tool-call part (pair correlation at
   standardizePrompt depends on it).
3. Split the channels: ALWAYS return the synthesized content to the
   generator (ephemeral channel, no pairing obligation — excluded calls
   need the reason too); push to history ONLY when
   `!excludeToolFromMessageHistory`. The synthesis condition (empty results
   array) is mutually exclusive with the spread push — no double-push.
4. Scope: `lastBlockReason !== undefined` fires only on the gate-block
   signature (all 11 block sites emit an error chunk — verified 11/11 in
   AUDIT/ADVERSARIAL; the abort gate at native.ts:468-473 is the one silent
   site, by design). Result-less programmatic tools (end_turn, set_output)
   emit no error chunks and are byte-identical to today.
5. Regression test (new focused suite): deterministic FSM-gate block (an
   idle-phase agentState + `run_terminal_command` yield) — asserts (a) the
   history contains the assistant tool-call part FOLLOWED BY the
   synthesized result (complete pair, shared toolCallId), (b) the returned
   content carries `{ blocked: true, reason }` matching the gate message,
   (c) a clean execution produces no synthesized result.
6. Q8 check: verified — `recordEchoComplianceActivity`
   (echo-record.ts:24-31) credits verification from `effectiveInput.command`
   (the INPUT) and its call site (native.ts ~480) sits AFTER all gates; a
   blocked call never reaches it. The enforcement ledger credits from the
   input inside `afterToolCall` (enforcement.ts:331-337, invoked only in
   post-gate handler paths; `verifiedFiles.add` has exactly one writer,
   input-driven). The synthesized history-only result cannot corrupt either
   ledger.
7. Gates: agent-runtime typecheck, focused suite, full agent-runtime suite,
   targeted ESLint + Prettier.

### Out of Scope (recorded, not fixed here)

- An approval channel for subagents under prompt mode (sandbox-gate.ts
  comments: "Future work will surface a permission request event") — the
  functional gap remains; this FID fixes the evidence-integrity layer and
  makes the block reason actionable ("Run with permission mode `unsafe`").
- The main-agent stream-parser path — already converts error chunks to
  user messages for API compliance (native.ts:183-186).

### Verification

- New regression test passes; full agent-runtime suite 0 fail.
- agent-runtime typecheck exit 0; ESLint 0 warnings; Prettier clean.
- Q8 check: the EHEL tracker does not credit synthesized blocked results.
- Live (post-relaunch): a basher spawn under prompt mode reports the sandbox
  block reason instead of NO-OUTPUT.

## Perfection Loop

### Loop 1 — RED

- **RED:** PASS 2026-08-20 23:20 — root cause live-confirmed with the probe
  matrix above (RED-phase artifact absent → FSM gate; GREEN-phase artifact
  absent → sandbox prompt-mode downgrade); all 11 block sites enumerated
  (native.ts lines 170/188/208/235/280/324/361/382/459/472/573, each
  `return previousToolCallFinished` with no result push); the programmatic
  boundary's compensation gap cited (execute-tool-calls.ts:76-88 push,
  :160 empty push, :162 undefined return).
- **GREEN:** PASS 2026-08-20 23:30 (Thinker missed-questions pass,
  converged in 6 thoughts) — answers folded into the refined Steps above.
  Key refinements: (Q1) split return/push channels — excluded calls still
  get the reason returned; (Q2) `lastBlockReason` scoping confirmed safe
  for result-less tools; (Q3) synthesized shape is schema-valid and MUST
  reuse the pre-execution toolCallId; (Q4) basher interaction clean —
  hasDeliveredResult sees the json block result and reports honestly,
  NO-OUTPUT reserved for genuine relay loss; (Q5) executeSingleToolCall is
  the single funnel — both direct yields and STEP_TEXT segments covered;
  (Q6) sandbox approval channel out of scope (Phase-1 product limitation);
  (Q7) no double-push — synthesis condition is mutually exclusive with the
  spread push. New audit item (Q8): EHEL tracker must not credit blocked
  results as verification. Test design (Q9): deterministic FSM-gate block.
- **AUDIT:** PASS 2026-08-20 23:35 (Verifier, planning-phase spec audit) —
  PASS on (b) toolCallId reuse, (c) split return/push for excluded calls
  (the inverse orphan — result without call — would be equally invalid),
  (d) schema/sanitize compatibility (primitives are identity through the
  FID-2026-0820-013 sanitize). Two NEEDS-REVIEW raised and resolved at
  source: (a) chunk-emission for sites 324/361/382/459/472 unverified at
  audit time — resolved by direct reads + the Adversary pass (all four
  emit error chunks; site 459 emits via the onResponseChunk callback
  passed into validateSpawnAgentsInput; site 472 is the one silent site);
  the spec's "fallback reason for future silent-return sites" was DEAD
  LOGIC as written (a silent site never satisfies the lastBlockReason
  condition) and was DROPPED. (e) Q8 tracker-credit risk confirmed real —
  resolved by reading echo-record.ts and the call site (input-based
  credit, post-gate; see Step 6).
- **ADVERSARIAL:** CLEAN 2026-08-20 23:40 (Adversary, source-verified) —
  all resolutions CONFIRMED at source with file:line citations: sites
  324/361/382/459 emit error chunks (native.ts:317-325, 357-364, 378-385;
  spawn-validation.ts:38-63); site 472 rationale ADJUSTED (abort surfaces
  as an LLM AbortError before any STEP completes — the orphan is transient
  and discarded; spec decision unchanged); resolution (e) fully CONFIRMED
  (`verifiedFiles.add` has exactly one writer, input-driven,
  enforcement.ts:337; no ledger scans history). Omission sweep: single
  production caller (run-programmatic-step.ts:236); no test asserts
  empty-result-on-block for executeSingleToolCall; the sandbox deny test
  calls executeToolCall directly and is unaffected. 11/11 emission matrix
  complete.
- **CHANGE DELTA:** N/A — planning FID

## Implementation Evidence (2026-08-20 23:45)

- **Fix:** `packages/agent-runtime/src/run-programmatic-step/execute-tool-calls.ts`
  — `lastBlockReason` captured in the onResponseChunk wrapper (error chunks
  from all gate sites); after the executor await and the spread push, a
  synthesized ToolMessage `{ role: 'tool', toolName, toolCallId,
  content: [{ type: 'json', value: { blocked: true, reason } }] }` is built
  with the shared pre-execution toolCallId when the results array is empty
  and a block reason was captured; ALWAYS returned to the generator; pushed
  to history only when `!excludeToolFromMessageHistory`.
- **Regression test:**
  `packages/agent-runtime/src/__tests__/run-programmatic-step-blocked-result.test.ts`
  (new, 2 tests): (1) the FSM-gate-blocked run_terminal_command yield
  synthesizes the result — complete pair in history (assistant tool-call →
  tool result with `blocked: true` + reason containing 'only available
  during'), and the generator receives the blocked content; (2) a clean
  set_output execution produces no synthesized blocked result.
- **Gate output (all real, this session):** agent-runtime typecheck exit 0;
  focused suite 2 pass / 0 fail / 15 expect(); full agent-runtime suite
  1130 pass / 0 fail / 2988 expect() across 129 files (up from 1128 — the
  2 new tests); `bun x eslint` on both changed files exit 0 (--max-warnings
  0); `bunx prettier --check` on both changed files exit 0.
- **Q8 evidence:** echo-record.ts:24-31 credits from
  `effectiveInput.command` (input-based); call site native.ts ~480 sits
  after all gates; enforcement.ts:331-337 `afterToolCall` credits from
  `params.input.command` with `verifiedFiles.add` having exactly one
  writer — blocked calls never reach either credit point.
- **Live-behavior caveat:** the running `bun dev` process loaded the
  pre-fix `execute-tool-calls.ts` module at startup (process-lifetime
  module caching — FID-2026-0820-013 Round 2). Live confirmation (a basher
  spawn under prompt mode reporting the sandbox block reason instead of
  NO-OUTPUT) requires the next session relaunch.

## Code Verification Evidence

- [x] Files referenced in Affected Components exist and contain the fix
      (execute-tool-calls.ts synthesis block; new regression test).
- [x] Implementation matches the refined Proposed Solution (Adversary
      CONFIRMED the spec at source before implementation).
- [x] Typecheck/tests/lint pass with pasted tool output (above).
- [x] Production call-graph evidence: executeSingleToolCall's single
      production caller (run-programmatic-step.ts:236); the conversion path
      callers (sdk/src/impl/llm/stream.ts:99, prompts.ts:57/115).
- [x] FID status reflects the actual implementation state (`closed` with
      unit/gate evidence; live-behavior check documented above).

## Resolution

- **Closed Date:** 2026-08-20 23:50 EDT
- **Fix Description:** gate-blocked programmatic tool calls now synthesize
  the blocking tool result at the single programmatic boundary — the
  call/result pair stays complete in history, the block reason is returned
  to the generator (which reports it honestly instead of NO-OUTPUT), and
  the silent evidence drop is eliminated for all 11 gate sites.
- **Tests Added:** Yes — 2 regression tests in
  `run-programmatic-step-blocked-result.test.ts` (blocked-call synthesis
  + clean-execution non-interference).
- **Verification Evidence:** See Implementation Evidence (typecheck 0;
  1130/0 full suite; ESLint 0; Prettier clean; Q8 source-verified).
- **Archived:** 2026-08-20 (moved to `dev/fids/archive/`)

## Lessons Learned

- A gate that returns early must still close the tool-call/tool-result
  contract it opened — an unpaired assistant tool-call is an invalid
  history shape, and an empty generator result is indistinguishable from a
  lost relay.
- Error chunks streamed to the parent's response channel are not visible
  to the subagent model — any fact the subagent needs must travel in the
  tool result itself.
- Process-lifetime module caching means in-session fixes are never live
  in-session: verify at the unit level, and schedule the live spawn test
  for the next relaunch (the corrected deployment mechanism per
  FID-2026-0820-013 Round 2 — `bun dev` from the working tree, not a
  stale binary).
- The sandbox prompt-mode downgrade is a documented Phase-1 limitation:
  until subagents have an approval channel, terminal commands in prompt
  mode are blocked in every phase — the fix makes that visible instead of
  silent.
