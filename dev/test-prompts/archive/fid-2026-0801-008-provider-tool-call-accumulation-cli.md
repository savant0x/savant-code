# FID-2026-0801-008 — Provider Tool-Call Accumulation CLI Regression Test

**Purpose:** Verify in the live Savant-Code CLI that a Thinker child's `sequentialthinking` tool calls now execute end-to-end with **complete, valid arguments**. FID-2026-0801-008 fixed the OpenAI-compatible provider streaming accumulation so a tool call no longer "completes" on a `{}` placeholder or truncated fragment and drops the real arguments. A passing run proves the streamed `thought`/`thoughtNumber`/`totalThoughts`/`nextThoughtNeeded` payload survives the provider and reaches the executor.

**Run mode:** Start Savant-Code normally and paste the **Test Prompt** below as one user message. Run it through the CLI you intend to release. Do not treat a unit-test result or assistant claim as live CLI evidence.

**Scope:** This test covers Thinker spawning, provider streaming accumulation, `sequentialthinking` argument integrity, tool execution, parent-tool isolation, and the visible stream boundary. It does not test Markdown visual styling or general response quality.

---

## Test Prompt

```text
This is a focused live regression test for FID-2026-0801-008.

Do not answer the question yourself and do not simulate any child-agent output.
You MUST use the `think_deeply` capability to spawn a real Thinker child.

Give the Thinker this exact task:

“What are exactly three properties of a safe AI-agent tool-permission boundary? Return exactly three numbered items, `1.`, `2.`, and `3.`, with exactly one sentence explaining each item.”

The Thinker MUST use its actual `sequentialthinking` tool before returning its answer. Ask it to make at least two sequential-thinking steps with proper parameters (thought, thoughtNumber, totalThoughts, nextThoughtNeeded). Do not write, edit, delete, or create any files. Do not call `sequentialthinking` directly from the parent; it must execute inside the real Thinker child.

After the Thinker returns, provide a concise regression report using exactly these fields:

- THINKER_SPAWNED: PASS, FAIL, or INCONCLUSIVE — PASS requires a visible structured child-agent start/activity event; assistant text claiming that Thinker ran does not count.
- THINKER_CHILD_TOOL_EXECUTED: PASS, FAIL, or INCONCLUSIVE — PASS requires a visible structured `sequentialthinking` tool-call AND a tool-result event inside the Thinker child; narrated text, a tool name in prose, or XML-looking text does not count.
- SEQUENTIALTHINKING_CALL_COUNT: a number if visible, otherwise UNKNOWN.
- INVALID_PARAMETERS_ERROR: YES or NO — mark YES if any error contains “Invalid parameters for sequentialthinking”.
- EMPTY_ARGUMENTS_ERROR: YES or NO — mark YES if any error shows `received undefined` for `thought`, `thoughtNumber`, `totalThoughts`, or `nextThoughtNeeded` (the `{}` empty-arguments signature).
- TRUNCATED_STRING_ERROR: YES or NO — mark YES if any error contains “Unterminated string”, “JSON Parse error”, or “expected the tool arguments to be an object, but received a string”.
- TOOL_RESULT_RECEIVED: PASS, FAIL, or INCONCLUSIVE — PASS requires a visible structured `sequentialthinking` result event carrying the thought payload (e.g. a thought number/content echoed back), proving the full arguments object was received, not just that a call was attempted.
- PARENT_TOOL_LEAKAGE: YES or NO — mark YES if the Thinker attempts `spawn_agents`, `write_file`, `str_replace`, `skill`, `suggest_followups`, `think_deeply`, or another parent-only tool.
- UNAVAILABLE_TOOL_ERROR: YES or NO — mark YES for any error such as “Tool `sequentialthinking` is not currently available” or repeated unavailable-tool errors during the Thinker run.
- RAW_LEGACY_XML_VISIBLE: YES or NO — mark YES if ordinary assistant text visibly contains `<tool_call>`, `<function=sequentialthinking>`, `<parameter=`, or `</tool_call>`.
- CHILD_RESULT: PASS, FAIL, or INCONCLUSIVE — PASS requires exactly three numbered items (`1.`, `2.`, `3.`), exactly one sentence per item, and no fourth property item.
- FID_2026_0801_008_BEHAVIORAL_RESULT: PASS, FAIL, or INCONCLUSIVE.

Do not claim PASS merely because the final answer sounds correct. PASS requires visible structured runtime evidence that the real Thinker child executed `sequentialthinking` with valid arguments and received a structured result.
```

## Pass Criteria

Mark `FID_2026_0801_008_BEHAVIORAL_RESULT: PASS` only when all of these are true:

1. A visible structured Thinker child-start/activity event appears.
2. A visible structured `sequentialthinking` tool-call appears inside that child.
3. A visible structured `sequentialthinking` **result event** appears inside that child (the tool actually executed with complete arguments — the FID-008 regression target).
4. `INVALID_PARAMETERS_ERROR` is NO — no “Invalid parameters for sequentialthinking” errors.
5. `EMPTY_ARGUMENTS_ERROR` is NO — no `received undefined` schema rejections for the four required fields (no `{}` placeholder reaching the executor).
6. `TRUNCATED_STRING_ERROR` is NO — no “Unterminated string” / “JSON Parse error” signatures (no truncated streamed arguments reaching the executor).
7. `SEQUENTIALTHINKING_CALL_COUNT` is at least 2 **when visible** — the prompt requires multiple steps; if the CLI hides per-call counters, treat the count as informational and do not gate the result on it (mirrors the FID-007 treatment of `PROMPT_INHERITANCE_PRESERVED`). The real gate stays on visible structured call + result events.
8. The Thinker does not attempt parent-only tools and no unavailable-tool cascade appears.
9. No raw legacy XML tool-call markup is rendered as ordinary assistant text.
10. The child returns exactly three numbered properties, one sentence each.
11. The CLI exposes enough structured evidence to distinguish execution from narration.

If the CLI does not expose child/tool events clearly enough to verify items 1–3, report the relevant fields and the overall result as **INCONCLUSIVE**, not PASS.

## Failure Signatures

Treat the run as **FAIL** if any of the following occurs:

- The parent answers directly without a real Thinker child-start event.
- The Thinker child starts but its `sequentialthinking` calls fail with “Invalid parameters for sequentialthinking” (the FID-008 pre-fix signature).
- Any error shows `received undefined` for `thought`, `thoughtNumber`, `totalThoughts`, or `nextThoughtNeeded` (empty `{}` arguments survived the provider).
- Any error contains “Unterminated string”, “JSON Parse error”, or “expected the tool arguments to be an object, but received a string” (truncated streamed arguments survived the provider).
- A `sequentialthinking` call is visible but **no structured result event** follows (arguments were dropped and the call never executed).
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
INVALID_PARAMETERS_ERROR:
EMPTY_ARGUMENTS_ERROR:
TRUNCATED_STRING_ERROR:
TOOL_RESULT_RECEIVED:
PARENT_TOOL_LEAKAGE:
UNAVAILABLE_TOOL_ERROR:
RAW_LEGACY_XML_VISIBLE:
CHILD_RESULT:
FID_2026_0801_008_BEHAVIORAL_RESULT:

Evidence notes:
- Thinker child-start event:
- First sequentialthinking call/result (arguments + returned thought payload):
- Second sequentialthinking call/result (arguments + returned thought payload):
- Any invalid-parameters / empty-arguments / unterminated-string error:
- Any parent-only tool attempt:
- Any raw legacy XML:
- Final child answer:

If the result is FAIL or INCONCLUSIVE, preserve the relevant transcript excerpt
and explain which evidence was missing or which failure signature appeared.
```

**Evidence rule:** Structured child/tool events are required for PASS. Assistant claims, final answers, raw XML-shaped text, or a tool name mentioned in prose are not execution evidence. Specifically, `TOOL_RESULT_RECEIVED: PASS` requires a structured result event carrying the thought payload — proof that the complete arguments object survived the streaming accumulation fix.
