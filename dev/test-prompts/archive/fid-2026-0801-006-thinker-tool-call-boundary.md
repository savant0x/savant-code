# FID-2026-0801-006 — Thinker Tool-Call Boundary Regression Test

**Purpose:** Manually verify that Savant-Code executes a real Thinker spawn and does not display legacy XML-shaped tool calls as ordinary assistant text.

**Run mode:** Load Savant-Code normally and paste the **Test Prompt** below as a single user message. Do not run this through a unit-test harness or tmux. Observe the live transcript and tool/agent events.

**Scope:** This test covers the Thinker spawn and tool-call stream boundary. It does not test Markdown visual styling, reasoning visibility, or general response quality.

---

## Test Prompt

```text
This is a focused behavioral regression test for the Thinker tool-call boundary.

Do not answer the question directly. You must use the `think_deeply` tool to spawn the Thinker agent and ask it this exact narrow question:

“What are exactly three properties of a safe AI-agent tool-call parser? Explain each property in one sentence.”

The Thinker must reason using its actual `sequentialthinking` tool. Do not simulate the Thinker, do not summarize an answer before the child runs, and do not write or modify any files.

After the Thinker child returns, provide a concise test report with these fields:

- THINKER_SPAWNED: PASS or FAIL — based only on a visible structured child-agent start/activity event, not on assistant text claiming a child ran. If no structured event is visible, report INCONCLUSIVE.
- SEQUENTIALTHINKING_EXECUTED: PASS or FAIL — based only on a visible structured `sequentialthinking` tool-call/result event inside the Thinker child, not on narrated text or XML-looking prose. If no structured event is visible, report INCONCLUSIVE.
- CANONICAL_TOOL_CALL_HANDLED: PASS or FAIL — the tool call is handled by the runtime and is not displayed as raw XML markup.
- RAW_LEGACY_XML_VISIBLE: YES or NO — check specifically for `<tool_call>`, `<function=sequentialthinking>`, `<parameter=`, or `</tool_call>` appearing as ordinary assistant text.
- UNAVAILABLE_TOOL_CASCADE: YES or NO — check for repeated errors such as “Tool X is not currently available” caused by the Thinker attempting parent-only tools.
- THINKER_TOOL_SCOPE: PASS or FAIL — the Thinker uses its permitted `sequentialthinking` capability and does not attempt `spawn_agents`, `write_file`, `str_replace`, `skill`, `suggest_followups`, or other parent-only tools.
- CHILD_RESULT: PASS or FAIL — the Thinker returns exactly three numbered parser properties (`1.`, `2.`, `3.`), with exactly one sentence explaining each and no fourth property or extra property item.
- FID_2026_0801_006_BEHAVIORAL_RESULT: PASS or FAIL — PASS only if all required conditions above pass.

Important: Do not claim PASS merely because the transcript contains XML-looking text. Raw `<tool_call>` / `<function=...>` text is evidence of failure, not evidence that the Thinker or `sequentialthinking` executed.
```

---

## Pass Criteria

Mark the test **PASS** only when all of the following are true:

1. A visible structured Thinker child-start/activity event appears; assistant text claiming that a child ran does not count.
2. A visible structured `sequentialthinking` tool-call and result event appears inside the Thinker child; narrated text or raw XML does not count.
3. The parent/runtime handles the tool call through the supported protocol; no raw legacy XML envelope is rendered as assistant prose.
4. No repeated unavailable-tool cascade appears.
5. The Thinker does not attempt parent-only tools.
6. The final child result contains exactly three numbered properties (`1.`, `2.`, `3.`), each explained in exactly one sentence, with no additional property item.

## Failure Signatures

Treat any of these as a failure:

- The response contains literal `<tool_call>`, `<function=sequentialthinking>`, `<parameter=...>`, or `</tool_call>` markup as visible assistant text.
- The parent says it used `think_deeply`, but no actual child-start event appears.
- `sequentialthinking` appears only as narrated text or XML rather than an executed tool event/result.
- The Thinker attempts `spawn_agents`, `write_file`, `str_replace`, `skill`, `suggest_followups`, or another tool outside its allowed scope.
- Multiple “Tool X is not currently available” errors appear.
- The parent answers the question without spawning the Thinker.
- The child result is missing, duplicated, or does not contain exactly three properties.

## Results Report

Record the observed result below after running the prompt:

```text
Date:
Model/provider:
CLI version/commit:

THINKER_SPAWNED:
SEQUENTIALTHINKING_EXECUTED:
CANONICAL_TOOL_CALL_HANDLED:
RAW_LEGACY_XML_VISIBLE:
UNAVAILABLE_TOOL_CASCADE:
THINKER_TOOL_SCOPE:
CHILD_RESULT:
FID_2026_0801_006_BEHAVIORAL_RESULT:

Evidence notes:
- Child-start event:
- sequentialthinking result:
- Any raw markup or error text:
- Final child answer:
```

**Evidence rule:** `THINKER_SPAWNED` and `SEQUENTIALTHINKING_EXECUTED` require visible structured runtime/tool events. If the UI does not expose enough information to distinguish those events from ordinary text, record the relevant field—and the overall test—as **INCONCLUSIVE**, not PASS.
