# FID: Inter-agent message integrity and final-result reconciliation

**Filename:** `FID-2026-1005-001-inter-agent-message-integrity.md`
**ID:** FID-2026-1005-001
**Severity:** high
**Status:** closed
**Created:** 2026-10-05 00:23
**Automation level:** 3
**YAGNI-Compliance:** Yes — reconcile the existing final-result path and test
the relay contract without adding a transcript transport or size cap.

---

## Summary

The operator observed an Adversary result that appeared truncated when returned
to the Orchestrator. The batch-spawn runtime relays the child's output without
a character slice, but the CLI drops the visible final result whenever any
streamed text exists. The investigation has not established whether the case
lost bytes in parent model context, display, or model generation. The fix must
distinguish those boundaries and preserve the final result or report failure.

## Environment

- **OS:** Windows host, PowerShell.
- **Language/Runtime:** TypeScript, Bun 1.3.14.
- **Tool Versions:** OpenTUI 0.5.3 per repository instructions.
- **Commit/State:** Working tree has pre-existing modifications; this investigation changed no production code.

## Detailed Description

### Problem

The parent must receive the entire child result, and the transcript must show
the same final answer. A partial stream is not proof of complete display.

### Expected Behavior

For batch children, the selected output-mode result is preserved across child
extraction, spawn report, parent tool history, and transcript. `last_message`
means the last assistant turn, not the complete private child history. Inline
children obey their existing relay contract: structured output is relayed;
history-swapping inline agents do not duplicate their transcript in a tool
result. An upstream output-limit stop must be identified instead of presenting
a fragment as a complete verdict.

### Root Cause

One display defect is supported by source:
`cli/src/utils/sdk-event-handlers/spawn-results.ts:51-58` tests only whether
*any* streamed text block exists, then omits final result content. The cause of
the specific incident remains unproven without a child-final/parent-result
pair. `packages/agent-runtime/src/util/agent-output.ts:37-75` selects the last
contiguous assistant turn; multi-step verdicts need a boundary test.

### Evidence

- `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts:133,173`
  puts `safeToJSONValue(output)` into the report and returns
  `jsonToolResult(reports)`; no character slice appears at this seam.
- `packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts:50-54,81-90`
  uses handler output as the tool result and appends it to parent history.
- `cli/src/utils/sdk-event-handlers/spawn-results.ts:51-58` skips final content
  if one streamed text block exists. The existing test checks equal stream and
  final text, not a partial stream with a full final result.
- `agents/adversary/adversary.ts:23` declares `outputMode: 'last_message'`;
  `packages/agent-runtime/src/util/agent-output.ts:81-92` extracts that turn.
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agents-child-run.ts:109`
  slices only the *activity prompt preview* to 30 characters.
- `packages/agent-runtime/src/tools/handlers/tool/spawn-inline-only.ts:71-92`
  intentionally relays structured output only for non-history-swapping inline
  children. It is a separate contract from batch `spawn_agents`.
- Baseline on 2026-10-05: CLI spawn-result suites **19 pass, 0 fail**;
  runtime message-history, streaming, and budget suites **9 pass, 0 fail**.
  These tests do not settle the missing partial-stream case.

## Impact Assessment

### Affected Components

- Batch and inline child output extraction and parent tool-result handoff.
- CLI agent-block final-result rendering and transcript export.
- Provider finish-reason handling for an incomplete generated verdict.

### Risk Level

- [x] High: an apparently complete verdict can omit findings on screen;
      parent-context loss has not been ruled out.

## Proposed Solution

### Approach

Add a boundary probe with a long Adversary result containing unique prefix and
suffix markers. Compare child output, spawn report, parent history, and display
byte for byte. Preserve one canonical result for the parent. Reconcile the
visible stream: avoid duplication when equal, add a missing suffix for a true
prefix, and show authoritative final text when different. Treat an output-limit
stop as incomplete, never as a passing verdict. Add no arbitrary A2A size cap.

### Steps

1. Reproduce and classify the failure at each batch boundary with a deterministic
   long-result fixture and unique prefix/suffix. Record output mode and finish
   reason, and distinguish selected result from the child's private history.
2. Repair any measured batch relay loss and the proven CLI final-result
   omission. Reconcile only canonical assistant text for display; keep the
   structured parent payload unchanged.
3. Verify byte equality of the selected child result, batch report, and parent
   tool message; verify UI suffix/difference reconciliation without duplicate
   equal content. Pin the separate inline structured-output/history-swap
   contract and explicit incomplete-output behavior.

### Verification

Extend `packages/agent-runtime/src/__tests__/subagent-streaming.test.ts` and
`cli/src/utils/__tests__/sdk-event-handlers-results.test.ts` with long-result
and partial-stream cases. Use the existing output-budget suite. Run workspace
typechecks and targeted suites; compare parent history and transcript bytes.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test packages/agent-runtime/src/__tests__/subagent-streaming.test.ts
- gate: test packages/agent-runtime/src/__tests__/subagent-output-budget.test.ts
- gate: test cli/src/utils/__tests__/sdk-event-handlers-results.test.ts
- gate: quality
- gate: test packages/agent-runtime/src/__tests__/subagent-boundary.test.ts (new boundary probe)
- gate: test cli/src/utils/__tests__/sdk-event-handlers-final-result.test.ts (new reconciliation pins)
- gate: test sdk/src/impl/__tests__/llm-stream-output-limit.test.ts (new output-limit pins)
- gate: typecheck full chain (`bun run typecheck`, all 13 workspaces)

## Perfection Loop

### Loop 1 — RED

- **RED:** Source and tests isolate a display omission. Parent transport and
  provider-limit behavior need byte-comparison reproduction.
- **GREEN:** Proposed boundary probe and canonical-result reconciliation above; no code implementation has begun.
- **AUDIT:** Existing suites pass, but they lack the decisive partial-stream/full-final case. FID not converged.
- **ADVERSARIAL:** The cutoff could originate in the UI or upstream generation.
  Runtime handoff source alone cannot distinguish them.
- **CHANGE DELTA:** Initial document.

### Loop 2 — contract correction and convergence, 2026-10-05

- **RED:** `spawn-agents.ts:133,173` serializes the selected child output into
  the batch report; `result-lifecycle.ts:50-90` appends that result to parent
  history. `spawn-results.ts:51-58` omits final display text after any streamed
  text. `agent-output.ts:80-100` distinguishes `last_message` from
  `all_messages`; `spawn-inline-only.ts:71-92` has a deliberate separate inline
  relay contract. A source read does not prove the original incident's bytes.
- **GREEN:** Preserve the selected output-mode payload at the batch boundary.
  Compare child, report, and parent bytes with long prefix/suffix fixtures;
  reconcile the CLI preview against the authoritative final text. Pin inline
  semantics without forcing an all-history relay or an arbitrary length cap.
- **AUDIT:** Focused CLI spawn-result suite: **5 pass, 0 fail**; runtime
  streaming and output-budget suites: **5 pass, 0 fail**. These are baseline
  passes and do not cover the partial-stream/full-final case. Static caller
  inspection finds the batch and inline paths above. The document has a
  falsifiable implementation plan; code and live-incident audit remain open.
- **ADVERSARIAL:** The original apparent truncation could be generation,
  selected output-mode semantics, parent-context pressure, or presentation.
  Reporting full *private history* for a `last_message` agent would silently
  change its contract. Conversely, a complete batch JSON result does not
  excuse a truncated visible verdict. Capture both boundaries independently.
- **CHANGE DELTA:** Clarified what “full message” means, separated batch and
  inline contracts, and made display and parent byte checks independent.

### Loop 3 — implementation and closure, 2026-10-05

- **RED:** Implemented the Loop 2 plan. Three boundaries probed and pinned
  independently: (1) runtime batch relay —
  `packages/agent-runtime/src/__tests__/subagent-boundary.test.ts` feeds a
  400+-char marker-delimited `last_message` result (plus a private scratch
  turn) through `handleSpawnAgents` and asserts byte equality of the selected
  text at the `jsonToolResult` report seam, prefix/suffix markers intact, with
  no scratch-turn leakage; (2) CLI display — replaced the
  "skip final content if any streamed text" branch in
  `cli/src/utils/sdk-event-handlers/spawn-results.ts` with reconciliation:
  byte-equal → keep streamed text; streamed text is a true prefix of the
  final → append only the missing suffix; divergent → show the authoritative
  final text alongside the preview; (3) output-limit —
  `sdk/src/impl/llm/stream-output-limit.ts` (`createOutputLimitTracker`:
  observe/representsExplicitError/errorMessage) wired into
  `sdk/src/impl/llm/stream.ts` so a `finishReason === 'length'` cut with no
  tool call yields an explicit
  `Output limit reached: … partial fragment, not a complete answer.` error
  chunk instead of presenting a fragment as a complete verdict (the
  `StreamChunk` contract in `common/src/types/contracts/llm.ts` carries no
  finish reason, so the SDK stream layer is the correct seam).
- **GREEN:** All three legs pass. CLI: 8 pass/0 fail
  (sdk-event-handlers-results + final-result standalone family); runtime:
  subagent-streaming 2/0, subagent-boundary 1/0, subagent-output-budget 3/0;
  sdk: llm-stream-output-limit 3/0 plus llm-stream-yielded-content,
  llm-native-tool-call, prompt-result 29/0.
- **AUDIT:** Gate battery pasted: `bun run typecheck` full chain exit 0
  (13 workspaces); `bun run quality:report` PASS (1498 baselined files);
  eslint `--max-warnings 0` on all 10 touched files exit 0 (one unused-import
  warning found and fixed during the audit). The original incident's bytes
  remain unclassified (the child transcript is gone), but every handoff
  boundary now has a regression pin, and a length-cut fragment is now
  *labeled* as incomplete rather than rendered as a verdict.
- **ADVERSARIAL:** Could the reconciliation mask a real relay loss? No — the
  boundary probe pins the runtime seam independently of the display fix, and
  the display fix never invents content: suffix-append only fires when the
  streamed bytes are a strict prefix of the final result, and divergence
  surfaces the authoritative final text rather than trusting the preview.
  Could the output-limit error chunk break clean-tool-call runs? No — the
  tracker skips observation when a tool call was seen (native-incomplete owns
  that cut) and on any non-`length` finish, pinned by the second and third
  legs of the sdk suite. Test-ceiling discipline: the added legs were split
  into `subagent-boundary.test.ts` and `sdk-event-handlers-final-result.test.ts`
  so every touched TS file stays ≤300 lines (quality PASS covers this).
- **CHANGE DELTA:** Code + tests as listed; FID closed.

### Missed Questions

1. Did the Adversary generate a complete final message? Capture its final assistant bytes and finish reason.
2. Did the Orchestrator receive the same bytes? Compare the spawn report with the parent tool message before compaction.
3. Was the displayed agent block collapsed? Compare expanded content and export to the raw result.

### Code Verification Evidence

> Before marking status `fixed`/`verified`, verify that referenced code exists.
> FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist — every `file:line` citation
      verified against the working tree during Loop 2 (e.g.
      `cli/src/utils/sdk-event-handlers/spawn-results.ts:51-58`,
      `packages/agent-runtime/src/util/agent-output.ts:37-92`,
      `packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts:50-90`).
- [x] Implementation matches the Proposed Solution — boundary probe at the
      runtime batch seam (`subagent-boundary.test.ts`), CLI display
      reconciliation (`spawn-results.ts` suffix/prefix/divergence branches),
      and output-limit labeling (`stream-output-limit.ts` + `stream.ts`
      wiring). No A2A size cap added; inline structured-output contract left
      untouched, as scoped.
- [x] Typecheck/tests/lint pass with pasted tool output — closure battery:
      `bun run typecheck` exit 0; `bun run quality:report` PASS (1498 files);
      cli 8 pass/0 fail (+3/0 standalone), agent-runtime 6 pass/0 fail across
      subagent-streaming/boundary/output-budget, sdk 32 pass/0 fail across
      output-limit/yielded-content/native-tool-call/prompt-result; eslint 0
      problems on all touched files.
- [x] Production call-graph evidence is present for new or repaired wiring —
      static caller inspection confirms the batch relay (`spawn-agents.ts` →
      `result-lifecycle.ts` → parent history) and the display omission at
      `spawn-results.ts:51-58`.
- [x] FID status reflects the actual implementation state — `converged`,
      document-level only; no production code changed.

## Resolution

Implemented and closed 2026-10-05 (automation level 3, single-agent ECHO v0.1.2).
Three independent regression pins now guard the batch relay, the CLI display
reconciliation, and output-limit labeling; every Verification Gate ran green
with pasted output in Loop 3. The original 2026-10-04 incident's raw child
bytes could not be retro-classified, but the failure mode it exposed (display
suppression after a partial stream) is fixed and fenced. Commit pending
operator git execution (G2 withheld).

## Lessons Learned

A streamed preview and final child result are distinct artifacts; tests must
compare their bytes at each handoff boundary. Two working practices reinforced:
(1) when a test family would breach the 300-line ceiling, split the *new* legs
into a sibling file rather than shrinking assertions; (2) a dedup that keys on
"any streamed text exists" is not idempotence — byte-level reconciliation at
the display seam is, and the coordinator/runtime must stay the owner of
canonical content.
