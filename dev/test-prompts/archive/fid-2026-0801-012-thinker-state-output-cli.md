# FID-2026-0801-012 — Thinker State Accumulation & Non-Null Output CLI Regression Test

**Purpose:** Verify in the live Savant-Code CLI that a Thinker child's `sequentialthinking` calls now **stack into a final non-null result**. FID-2026-0801-012 rebuilt the Thinker completion contract: a strict `ThoughtSession` accumulates accepted thoughts in order, and a runtime convergence gate builds a typed `FinalArtifact` (`status`, `synthesis`, `payload.message`, `metrics.totalThoughts`, `thoughts[]`) from the session snapshot when the final thought sets `nextThoughtNeeded: false`. A passing run proves (a) thoughts accumulate in order with increasing `thoughtNumber`, and (b) the parent receives a **non-null** structured result with the stacked thought stack — never `structuredOutput: null`, and never via the old `set_output` restart path.

**Run mode:** Start Savant-Code normally and paste the **Test Prompt** below as one user message. Run it through the CLI you intend to release. Do not treat a unit-test result or assistant claim as live CLI evidence.

**Scope:** This test covers Thinker spawning, thought stacking (the regression target), convergence (`nextThoughtNeeded: false`), the non-null FinalArtifact contract, the absence of the `set_output` restart message, parent-tool isolation, and the visible stream boundary. It does not test Markdown visual styling or general response quality.

---

## Test Prompt

```text
This is a focused live regression test for FID-2026-0801-012.

Do not answer the question yourself and do not simulate any child-agent output.
You MUST use the `think_deeply` capability to spawn a real Thinker child.

Give the Thinker this exact task:

“What are exactly three properties of a safe AI-agent tool-permission boundary? Return exactly three numbered items, `1.`, `2.`, and `3.`, with exactly one sentence explaining each item.”

The Thinker MUST use its actual `sequentialthinking` tool for at least THREE sequential steps before returning its answer, and its final `sequentialthinking` step MUST set `nextThoughtNeeded: false` and carry the complete conclusion in the thought text. Do not write, edit, delete, or create any files. Do not call `sequentialthinking` directly from the parent; it must execute inside the real Thinker child.

After the Thinker returns, provide a concise regression report using exactly these fields:

- THINKER_SPAWNED: PASS, FAIL, or INCONCLUSIVE — PASS requires a visible structured child-agent start/activity event; assistant text claiming that Thinker ran does not count.
- THINKER_CHILD_TOOL_EXECUTED: PASS, FAIL, or INCONCLUSIVE — PASS requires a visible structured `sequentialthinking` tool-call AND a tool-result event inside the Thinker child; narrated text, a tool name in prose, or XML-looking text does not count.
- SEQUENTIALTHINKING_CALL_COUNT: a number if visible, otherwise UNKNOWN.
- THOUGHTS_STACKED: PASS, FAIL, or INCONCLUSIVE — PASS requires at least three visible structured `sequentialthinking` calls inside the child whose `thoughtNumber` values increase in order (e.g. 1, 2, 3). This is the primary FID-012 regression target: thoughts must accumulate, not overwrite or vanish.
- FINAL_CALL_CONVERGED: PASS, FAIL, or INCONCLUSIVE — PASS requires the final visible `sequentialthinking` call to set `nextThoughtNeeded: false` (visible in the call's arguments or inferred from a clean completion with a stacked result).
- FINAL_ARTIFACT_RECEIVED: PASS, FAIL, or INCONCLUSIVE — PASS requires the parent to receive a NON-NULL structured result from the child (a structured child report carrying a result object). A null/empty result, or a result the parent says was missing, is FAIL.
- ARTIFACT_STATUS: report the visible `status` value if the CLI exposes it (expected `success`), otherwise UNKNOWN.
- PAYLOAD_MESSAGE_PRESENT: YES, NO, or UNKNOWN — YES if the final structured result includes a non-empty `payload.message` (the final answer).
- SYNTHESIS_PRESENT: YES, NO, or UNKNOWN — YES if the final structured result includes a `synthesis` field (concise explanation of how the conclusion was reached).
- METRICS_TOTAL_THOUGHTS: a number if visible, otherwise UNKNOWN — report the `metrics.totalThoughts` value if exposed; it should be >= 3.
- THOUGHTS_IN_ARTIFACT: a number if visible, otherwise UNKNOWN — report how many stacked thought entries appear in the final structured result.
- SET_OUTPUT_RESTART_MESSAGE: YES or NO — mark YES if any system/user message says “You must use the \"set_output\" tool” or “You must use set_output”. The gate must set output directly, so this must be NO.
- INVALID_PARAMETERS_ERROR: YES or NO — mark YES if any error contains “Invalid parameters for sequentialthinking”.
- EMPTY_ARGUMENTS_ERROR: YES or NO — mark YES if any error shows `received undefined` for `thought`, `thoughtNumber`, `totalThoughts`, or `nextThoughtNeeded` (the `{}` empty-arguments signature).
- TRUNCATED_STRING_ERROR: YES or NO — mark YES if any error contains “Unterminated string”, “JSON Parse error”, or “expected the tool arguments to be an object, but received a string”.
- TOOL_RESULT_RECEIVED: PASS, FAIL, or INCONCLUSIVE — PASS requires a visible structured `sequentialthinking` result event carrying the thought payload (e.g. a thought number/content echoed back), proving the full arguments object was received.
- PARENT_TOOL_LEAKAGE: YES or NO — mark YES if the Thinker attempts `spawn_agents`, `write_file`, `str_replace`, `skill`, `suggest_followups`, `think_deeply`, or another parent-only tool.
- UNAVAILABLE_TOOL_ERROR: YES or NO — mark YES for any error such as “Tool `sequentialthinking` is not currently available” or repeated unavailable-tool errors during the Thinker run.
- RAW_LEGACY_XML_VISIBLE: YES or NO — mark YES if ordinary assistant text visibly contains `<tool_call>`, `<function=sequentialthinking>`, `<parameter=`, or `</tool_call>`.
- CHILD_RESULT: PASS, FAIL, or INCONCLUSIVE — PASS requires exactly three numbered items (`1.`, `2.`, `3.`), exactly one sentence per item, and no fourth property item.
- FID_2026_0801_012_BEHAVIORAL_RESULT: PASS, FAIL, or INCONCLUSIVE.

Do not claim PASS merely because the final answer sounds correct. PASS requires visible structured runtime evidence that the real Thinker child executed at least three stacked `sequentialthinking` calls and returned a non-null structured result with the final answer present.
```

## Pass Criteria

Mark `FID_2026_0801_012_BEHAVIORAL_RESULT: PASS` only when all of these are true:

1. A visible structured Thinker child-start/activity event appears.
2. At least three visible structured `sequentialthinking` tool-calls appear inside that child with **increasing `thoughtNumber` values in order** (the stacking regression target).
3. Visible structured `sequentialthinking` result events appear inside that child (the calls actually executed with complete arguments).
4. The parent receives a **non-null** structured result from the child (the FID-012 target — never `structuredOutput: null`).
5. `PAYLOAD_MESSAGE_PRESENT` is YES or, if the CLI hides the artifact internals, the parent reports the three-item answer in a way that proves a real result was received (not a null).
6. `SET_OUTPUT_RESTART_MESSAGE` is NO — no “You must use set_output” system message was injected (proves the gate set output before the restart check).
7. `INVALID_PARAMETERS_ERROR` is NO, `EMPTY_ARGUMENTS_ERROR` is NO, and `TRUNCATED_STRING_ERROR` is NO.
8. `PARENT_TOOL_LEAKAGE` is NO and no unavailable-tool cascade appears.
9. No raw legacy XML tool-call markup is rendered as ordinary assistant text.
10. The child returns exactly three numbered properties, one sentence each.
11. The CLI exposes enough structured evidence to distinguish execution from narration.

If the CLI does not expose child/tool events clearly enough to verify items 2–4, report the relevant fields and the overall result as **INCONCLUSIVE**, not PASS.

## Failure Signatures

Treat the run as **FAIL** if any of the following occurs:

- The parent answers directly without a real Thinker child-start event.
- Fewer than three `sequentialthinking` calls appear, or their `thoughtNumber` values do not increase in order (thoughts did not stack — the pre-fix regression).
- A `sequentialthinking` call is visible but **no structured result event** follows.
- The parent reports a **null / empty / missing** child result after apparently valid thinking (the original `structuredOutput: null` bug).
- The message history or transcript contains “You must use set_output” (the gate ordering failed and the restart path fired).
- Any error contains “Invalid parameters for sequentialthinking”, `received undefined` for a required field, “Unterminated string”, or “JSON Parse error”.
- The Thinker attempts `spawn_agents`, `write_file`, `str_replace`, `skill`, `suggest_followups`, `think_deeply`, or another parent-only tool.
- `sequentialthinking` appears only as ordinary prose or legacy XML rather than a structured tool event/result.
- Literal `<tool_call>`, `<function=sequentialthinking>`, `<parameter=...>`, or `</tool_call>` appears as ordinary assistant text.
- The child result is missing, contains fewer or more than three properties, or has an extra numbered property.

## Results Report

Record the live result below after running the prompt:

```text
Date:
Model/provider:
CLI version/commit:
Operating system:

THINKER_SPAWNED:
THINKER_CHILD_TOOL_EXECUTED:
SEQUENTIALTHINKING_CALL_COUNT:
THOUGHTS_STACKED:
FINAL_CALL_CONVERGED:
FINAL_ARTIFACT_RECEIVED:
ARTIFACT_STATUS:
PAYLOAD_MESSAGE_PRESENT:
SYNTHESIS_PRESENT:
METRICS_TOTAL_THOUGHTS:
THOUGHTS_IN_ARTIFACT:
SET_OUTPUT_RESTART_MESSAGE:
INVALID_PARAMETERS_ERROR:
EMPTY_ARGUMENTS_ERROR:
TRUNCATED_STRING_ERROR:
TOOL_RESULT_RECEIVED:
PARENT_TOOL_LEAKAGE:
UNAVAILABLE_TOOL_ERROR:
RAW_LEGACY_XML_VISIBLE:
CHILD_RESULT:
FID_2026_0801_012_BEHAVIORAL_RESULT:

Evidence notes:
- Thinker child-start event:
- Thought 1 call/result (thoughtNumber + payload):
- Thought 2 call/result (thoughtNumber + payload):
- Thought 3 call/result (thoughtNumber + payload):
- Final call nextThoughtNeeded flag:
- Final structured result received by parent (status/synthesis/payload.message/metrics/thoughts):
- Any set_output restart message:
- Any invalid-parameters / empty-arguments / unterminated-string error:
- Any parent-only tool attempt:
- Any raw legacy XML:
- Final child answer:

If the result is FAIL or INCONCLUSIVE, preserve the relevant transcript excerpt
and explain which evidence was missing or which failure signature appeared.
```

**Evidence rule:** Structured child/tool events and a visible non-null final result are required for PASS. Assistant claims, final answers, raw XML-shaped text, or a tool name mentioned in prose are not execution evidence. `THOUGHTS_STACKED` and `FINAL_ARTIFACT_RECEIVED` are the two primary gates — they map directly to the two pre-fix symptoms (thoughts not stacking, and successful-looking null results).
