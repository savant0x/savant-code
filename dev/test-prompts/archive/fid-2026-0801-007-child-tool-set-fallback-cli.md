# FID-2026-0801-007 — Child Tool-Set Fallback CLI Regression Test

**Purpose:** Verify in the live Savant-Code CLI that a Thinker child receives its own `sequentialthinking` tool even when that tool is absent from the parent/orchestrator tool set.

**Run mode:** Start Savant-Code normally and paste the **Test Prompt** below as one user message. Run it through the CLI you intend to release. Do not treat a unit-test result or assistant claim as live CLI evidence.

**Scope:** This test covers Thinker spawning, child-tool provisioning, tool execution, parent-tool isolation, and the visible stream boundary. It does not test Markdown visual styling or general response quality.

---

## Test Prompt

```text
This is a focused live regression test for FID-2026-0801-007.

Do not answer the question yourself and do not simulate any child-agent output.
You MUST use the `think_deeply` capability to spawn a real Thinker child.

Give the Thinker this exact task:

“What are exactly three properties of a safe AI-agent tool-permission boundary? Return exactly three numbered items, `1.`, `2.`, and `3.`, with exactly one sentence explaining each item.”

The Thinker MUST use its actual `sequentialthinking` tool before returning its answer. Ask it to make at least two sequential-thinking steps. Do not write, edit, delete, or create any files. Do not call `sequentialthinking` directly from the parent; it must execute inside the real Thinker child.

After the Thinker returns, provide a concise regression report using exactly these fields:

- THINKER_SPAWNED: PASS, FAIL, or INCONCLUSIVE — PASS requires a visible structured child-agent start/activity event; assistant text claiming that Thinker ran does not count.
- THINKER_CHILD_TOOL_EXECUTED: PASS, FAIL, or INCONCLUSIVE — PASS requires a visible structured `sequentialthinking` tool-call and result event inside the Thinker child; narrated text, a tool name in prose, or XML-looking text does not count.
- SEQUENTIALTHINKING_CALL_COUNT: a number if visible, otherwise UNKNOWN.
- PROMPT_INHERITANCE_PRESERVED: INFORMATIONAL — mark UNKNOWN unless the CLI explicitly exposes the inherited system prompt or cache/context events; this field does not gate the overall result, because normal CLI sessions may hide this implementation detail.
- PARENT_TOOL_LEAKAGE: YES or NO — mark YES if the Thinker attempts `spawn_agents`, `write_file`, `str_replace`, `skill`, `suggest_followups`, `think_deeply`, or another parent-only tool.
- UNAVAILABLE_TOOL_ERROR: YES or NO — mark YES for any error such as “Tool `sequentialthinking` is not currently available” or repeated unavailable-tool errors during the Thinker run.
- RAW_LEGACY_XML_VISIBLE: YES or NO — mark YES if ordinary assistant text visibly contains `<tool_call>`, `<function=sequentialthinking>`, `<parameter=`, or `</tool_call>`.
- CHILD_RESULT: PASS, FAIL, or INCONCLUSIVE — PASS requires exactly three numbered items (`1.`, `2.`, `3.`), exactly one sentence per item, and no fourth property item.
- FID_2026_0801_007_BEHAVIORAL_RESULT: PASS, FAIL, or INCONCLUSIVE.

Do not claim PASS merely because the final answer sounds correct. PASS requires visible structured runtime evidence that the real Thinker child executed `sequentialthinking` successfully.
```

## Pass Criteria

Mark `FID_2026_0801_007_BEHAVIORAL_RESULT: PASS` only when all of these are true:

1. A visible structured Thinker child-start/activity event appears.
2. A visible structured `sequentialthinking` call and result appear inside that child.
3. The Thinker completes without a `sequentialthinking` unavailable-tool error.
4. The Thinker does not attempt parent-only tools.
5. No repeated unavailable-tool cascade appears.
6. No raw legacy XML tool-call markup is rendered as ordinary assistant text.
7. The child returns exactly three numbered properties, one sentence each.
8. The CLI exposes enough structured evidence to distinguish execution from narration.
9. `PROMPT_INHERITANCE_PRESERVED` is informational only and does not gate the result when system prompts or cache events are hidden.

If the CLI does not expose child/tool events clearly enough to verify items 1–3, report the relevant fields and the overall result as **INCONCLUSIVE**, not PASS.

## Failure Signatures

Treat the run as **FAIL** if any of the following occurs:

- The parent answers directly without a real Thinker child-start event.
- The Thinker child starts but receives an unavailable-tool error for `sequentialthinking`.
- The transcript shows repeated errors such as `Tool X is not currently available`.
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
PROMPT_INHERITANCE_PRESERVED: UNKNOWN (informational unless explicitly observable)
PARENT_TOOL_LEAKAGE:
UNAVAILABLE_TOOL_ERROR:
RAW_LEGACY_XML_VISIBLE:
CHILD_RESULT:
FID_2026_0801_007_BEHAVIORAL_RESULT:

Evidence notes:
- Thinker child-start event:
- First sequentialthinking call/result:
- Second sequentialthinking call/result:
- Any unavailable-tool error:
- Any parent-only tool attempt:
- Any raw legacy XML:
- Final child answer:

If the result is FAIL or INCONCLUSIVE, preserve the relevant transcript excerpt
and explain which evidence was missing or which failure signature appeared.
```

**Evidence rule:** Structured child/tool events are required for PASS. Assistant claims, final answers, raw XML-shaped text, or a tool name mentioned in prose are not execution evidence.
