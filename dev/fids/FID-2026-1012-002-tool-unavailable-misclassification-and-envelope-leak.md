# FID: Unavailable-tool calls are misdiagnosed as argument truncation and killed by the strike cap

**Filename:** `FID-2026-1012-002-tool-unavailable-misclassification-and-envelope-leak.md`
**ID:** FID-2026-1012-002
**Severity:** high
**Status:** verified
**Created:** 2026-10-12 06:10
**Automation level:** 1
**YAGNI-Compliance:** Verified — every seam pre-exists; no new dependency, agent role, tool union, or plumbing field

---

## Summary

Three `thinker` spawns died with `Native tool-call recovery failed repeatedly … (tool: read_files)`
while the Thinker's declared tool set is `['sequentialthinking', 'end_turn']`. The death is not
argument truncation and not a model-payload problem: the OpenAI-compatible stream transform collapses
**"tool name not declared on this request"** and **"argument JSON incomplete"** into one code path
(`isCompleteKnownToolCallArguments` returns `false` for an unknown name *before looking at the
arguments at all*), so an undeclared-tool call is emitted as `native-incomplete`. The runtime then
steers with payload advice that no retry can satisfy ("read fewer files at a time"), burns the
3-strike budget, and throws at `loop-iteration.ts:250` naming a tool the agent cannot call. A second,
independent defect was reported in the same transcript: a `<SAVANT_TOOL_CALL>` block — an envelope
that has never existed in this repository's history — is not recognized by the stream parser, so its
raw JSON (`cb_tool_name`, path, content) is passed through to the user as visible text. This record
separates the two failure classes, corrects the steering policy for the unsatisfiable class, removes
the prompt self-contradiction that induces the call, and makes near-miss envelopes fail closed
instead of leaking protocol markup.

## Environment

- **OS:** Windows, Git Bash terminal.
- **Language/Runtime:** TypeScript, Bun 1.3.14 (pinned).
- **Branch/State:** `main`; the worktree carries pre-existing uncommitted changes from other in-flight
  work, preserved and untouched by this record.
- **Triggering agent:** `agentTemplate.id` `thinker` (`agents/thinker/thinker.ts`), model
  `openrouter/free` → OpenRouter, OpenAI-compatible stream family.
- **Governance:** `ECHO.md` v0.2.0; `protocol.config.yaml` `strict_mode: true`,
  `session.autonomy_level: 3`. Operator-reported: the raw transcript is at `failure.md` (repo root,
  untracked) and the operator asked for the root cause and the options before any fix.

## Detailed Description

### Problem

Operator-reported, from a live Auto Drive/authoring session:

```text
'Thinker's critique is in. RED catalog is complete — now completing the last evidence reads
(FID template structure and register conventions) before authoring the FID:
Agent run error: Native tool-call recovery failed repeatedly; ending the agent run without
executing the incomplete tool call. (tool: read_files) Re-spawn with the work split into smaller
steps (write in chunks, append with str_replace), or re-run with the payload divided across
multiple tool calls.

Error: Native tool-call recovery failed repeatedly; ending the agent run without executing the
incomplete tool call. (tool: read_files)
at runLoopIteration (...packages/agent-runtime/src/run-agent-step/loop-iteration.ts:250:15)
at async loopAgentSteps (...packages/agent-runtime/src/run-agent-step/loop.ts:206:27)
at async executeSubagent (unknown)
at async runSingleSubagent (unknown)'
```

The affected run is a **subagent** (`executeSubagent` → `runSingleSubagent`). The record
`dev/fids/FID-2026-1012-001-scholars-search-mcp-integration.md` (evidence item 11) states three
`thinker` spawns failed this way on `read_files` / `run_readonly_command` — the two tool names the
subagent addendum advertises to it as available.

The class is the ledger's largest: `dev/agenda.md:6-12` reports `read_files` incomplete-arguments at
**41 recurrences**, `read_url` 24, `web_search` 19.

Second, independent defect, same transcript: a tool call narrated as

```text
<SAVANT_TOOL_CALL>
{
"cb_tool_name": "write_file",
"path": "dev/fids/FID-2026-1012-001-scholars-search-mcp-integration.md",
"instructions": "Create the new FID …",
"content": "# FID: Scholars-search MCP integration into the Researcher persona\n\n…"
}
</SAVANT_TOOL_CALL>
```

was shown to the user as literal text, `cb_tool_name` and all.

### Expected Behavior

1. A call whose **tool name is not declared on the request** is reported as exactly that — with the
   list of tools the agent *can* call — and never described as an incomplete or oversized argument
   object.
2. Such a call is not retried as if more retries, smaller payloads, or a different call shape could
   help: the runtime re-prompts once with the real tool list, then fails with an honest message.
   Wasted strikes and wasted steps are bounded at one, not three.
3. A subagent is never told that a tool it does not have is "available in ALL phases".
4. Protocol markup never reaches the user: an envelope the parser does not recognize is suppressed
   and logged (`cb_tool_name`-bearing JSON is protocol, not prose), including near-misses such as
   wrong case or a legacy name.
5. Payload-size steering keeps working unchanged for its real class (a genuine mid-JSON cut,
   `finishReason === 'length'`).

### Root Cause

Two conflations and one prompt contradiction.

**A. "Unknown tool name" is implemented as "incomplete arguments".** The provider transform decides
whether a streamed call is complete via `isCompleteKnownToolCallArguments`
(`packages/llm-providers/src/openai-compatible/chat/stream-transform/tool-arguments.ts:37-47`):

```ts
export function isCompleteKnownToolCallArguments(
  args: string,
  toolName: string,
  requiredToolKeys: ReadonlyMap<string, readonly string[]>,
): boolean {
  if (!requiredToolKeys.has(toolName)) {
    return false        // ← unknown name short-circuits, arguments never inspected
  }
  return isCompleteToolCallArguments(args, requiredToolKeys.get(toolName))
}
```

`requiredToolKeys` is built from the tools declared **on this request**
(`getRequiredToolKeys`, `tool-arguments.ts:66+`). For the Thinker that set is
`{sequentialthinking, end_turn}`. A model-emitted `read_files` call with perfectly well-formed,
complete JSON arguments therefore returns `false`, and `flush-handler.ts:46-70` emits

```ts
controller.enqueue({ type: 'error', error: { type: 'native-incomplete', toolName: toolCall.function.name, … } })
```

The vendor-SDK path loses the same distinction one layer later: `classifyInvalidToolCall`
(`sdk/src/impl/llm/stream-error-chunk.ts:83-92`) reads **only** `chunk.toolName` and discards the
`error` object, so an `ai`-core `NoSuchToolError` and an `InvalidToolInputError` produce byte-identical
chunks. `normalizeNativeToolCallStreamError` (`sdk/src/impl/llm/errors.ts:90-113`) then words every
non-`length` case as "Incomplete arguments for tool X; retry the tool call with a complete arguments
object." — a false statement about a name-not-found failure.

**B. The recovery ladder then spends its budget on an unsatisfiable retry.**
`handleStreamErrorChunk` (`packages/agent-runtime/src/tools/stream-parser/error-chunk.ts:89-101`)
steers **ungated** for every `native-incomplete` chunk using `getSteeringMessage(toolName, strike)`
(`run-agent-step/constants.ts:82-104`), whose `read_files` entries are payload advice:

```text
read_files steering @strike 1: If reading many files, read fewer files at a time.
read_files steering @strike 2: Your read_files arguments were rejected because the file list is too large. Read 1-3 files per call instead.
read_files steering @strike 3: Read the first file with read_files, then read the next file in a separate call.
```

None of that can be satisfied when the tool cannot be called, so the model repeats.
`applyNativeStrikeHandling` (`run-agent-step/loop/native-strikes.ts:31-43`) escalates, and at
`NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES = 3` (`run-agent-step/constants.ts:1`) the run is ended by
`loop-iteration.ts:200-215` → `throw` at `:250`. The runner-up message accuses the wrong thing and
sends the parent a re-spawn strategy for a payload problem that never existed.

**C. The prompt induces the call.** A child that inherits the parent's system prompt gets the
subagent addendum (`packages/agent-runtime/src/templates/strings.ts:129-131`), whose first sentence is
correct — "You are a subagent that only has access to the following tools: sequentialthinking, end_turn
… Do not attempt to use any other tools" — and whose second sentence contradicts it:

> Phase availability: only write_file, str_replace, apply_patch (green/self_correct),
> run_terminal_command (green/audit/self_correct), and sequentialthinking (Thinker only) are
> phase-gated. **Every other tool — including `run_readonly_command` (…) and
> `read_files`/`glob`/`list_directory`/`code_search` — is available in ALL phases including idle and red.**

The paragraph exists to explain phase gating, but it hands a flash-class model two concrete tool names
it cannot call — the same two names in the failure report. The Thinker compounds it:
`inheritParentSystemPrompt: true` and `includeMessageHistory: true` (`agents/thinker/thinker.ts:72-73`),
so its context is the parent's system prompt plus a transcript full of `read_files` calls, on
`openrouter/free` (`thinker.ts:12`).

**Why this was invisible:** `error-chunk.ts:65-77` already has a "tool unknown to the runtime"
warning, but it tests the **runtime-wide** `toolNames` list (`common/src/tools/constants.ts:40-96`),
not the agent's allowlist — `read_files` is in the global list, so no warning fires and no experience
record distinguishes this class from truncation. The function already receives `agentTemplate` and
uses it only as a log field.

**D. Envelope leak (second defect).** `parseStreamChunk` recognizes exactly two envelopes: the
canonical `<savant_code_tool_call>` (`common/src/tools/constants.ts:10-12`) and a legacy `<tool_call>`
that is deliberately discarded (`packages/agent-runtime/src/util/stream-xml-parser.ts:12-15,
158-175`). `SAVANT_TOOL_CALL` is not one of them and never has been: `git log -S 'SAVANT_TOOL_CALL'`
matches **no commit in the repository's history** (the lowercase `<savant_tool_call>` appeared only as
a renamed test fixture, `aa8a2f7d`). So the block reaches `filteredText` verbatim. The module's own
contract — "Unterminated legacy blocks are held in state and therefore fail closed at stream
completion rather than leaking protocol markup to the user" (`stream-xml-parser.ts:67-71`) — is met
only for the two tags it knows.

### Evidence

RED catalog. Every citation was read or grepped this session; the two repros were **executed**, not
reasoned about (`dev/scratchpad/active/fid-1012-failure-probe.ts`, untracked scratch).

1. **Conflation site.** `packages/llm-providers/src/openai-compatible/chat/stream-transform/tool-arguments.ts:37-47`
   — quoted in full under Root Cause A; the unknown-name branch returns `false` before the arguments
   are examined.
2. **Emission site.** `packages/llm-providers/src/openai-compatible/chat/stream-transform/flush-handler.ts:46-70`
   — the `isCompleteKnownToolCallArguments` gate, else-branch enqueues
   `{type:'error', error:{type:'native-incomplete', toolName, finishReason?}}`.
3. **Vendor-path loss.** `sdk/src/impl/llm/stream-error-chunk.ts:83-92` (`classifyInvalidToolCall`
   reads `chunk.toolName` only) and `sdk/src/impl/llm/stream.ts:252-271` (every `invalid: true`
   tool-call part is classified `native-incomplete`), with `NoSuchToolError` already recognised as a
   distinct, agent-retryable error at `stream-error-chunk.ts:57-63`.
4. **Wording factory.** `sdk/src/impl/llm/errors.ts:90-113` — one message for every non-`length`
   native tool-call error: "Incomplete arguments for tool X; retry the tool call with a complete
   arguments object."
5. **Steering + strikes.** `packages/agent-runtime/src/tools/stream-parser/error-chunk.ts:89-101`
   (ungated steering), `run-agent-step/constants.ts:1` and `:82-104` (strike cap, per-tool payload
   messages), `run-agent-step/loop/native-strikes.ts:31-43` (escalation + exhaustion),
   `run-agent-step/loop-iteration.ts:200-215` and `:250` (the throw in the operator's stack).
6. **Prompt contradiction.** `packages/agent-runtime/src/templates/strings.ts:129-131`, plus the
   inheritance flags at `agents/thinker/thinker.ts:72-73` and the model at `thinker.ts:12`.
7. **Observability gap.** `packages/agent-runtime/src/tools/stream-parser/error-chunk.ts:65-77`
   compares against the global `toolNames` while `agentTemplate` is already a parameter.
8. **Repro 1 — steering for a tool the agent cannot call** (executed):

```text
=== claim 2: steering vs the Thinker toolset ===
thinker toolNames      : ["sequentialthinking","end_turn"]
thinker has read_files : false
read_files in RUNTIME toolNames: true
  read_files steering @strike 1:  If reading many files, read fewer files at a time.
  read_files steering @strike 2:  Your read_files arguments were rejected because the file list is too large. Read 1-3 files per call instead.
  read_files steering @strike 3:  Read the first file with read_files, then read the next file in a separate call.
```

9. **Repro 2 — envelope leak** (executed, same probe): the reported block is passed through intact
   while the canonical envelope is parsed and stripped:

```text
=== claim 1: envelope handling ===
canonical tag  : <savant_code_tool_call>
toolCalls found: []
filteredText   : "Before the call.\n<SAVANT_TOOL_CALL>\n{\n\"cb_tool_name\": \"write_file\", …}\n</SAVANT_TOOL_CALL>\nAfter the call."
LEAK?          : YES — markup reaches visible text
control (canonical): toolCalls = [{"toolName":"read_files","input":{"paths":["a.ts"]}}] filteredText = ""
```

10. **Alias history.** `git log -S 'SAVANT_TOOL_CALL' --oneline` → no commits;
    `git log -S 'savant_tool_call' --oneline` → `aa8a2f7d release: v0.0.16` (the fixture rename).
11. **Exposure.** `agents/thinker/thinker.ts:77` `toolNames: ['sequentialthinking', 'end_turn']`;
    `run-agent-step/loop-context.ts:150-171` restricts the model-facing payload to
    `agentTemplate.toolNames` via `filterToolSet` (`tools/filter-tool-set.ts:9-18`), so the undeclared
    name cannot be a declared tool of that request.
12. **Scale.** `dev/agenda.md:6-12` — `read_files` 41, `read_url` 24, `web_search` 19 recurrences.
    The class is the largest in the ledger and, until this record, indistinguishable from truncation.
13. **Declared probe, RED on the current tree** (executed; this is the acceptance check for both
    classes, `dev/scratchpad/active/fid-1012-002-unavailable-tool-probe.ts`, exit 1 today):

```text
fid-1012-002 probe FAIL (4 issue(s))
- tool-arguments.ts: no isDeclaredToolName(toolName, requiredToolKeys) — an undeclared tool name can
  still be reported as an incomplete argument object (FID-2026-1012-002 step 1)
- tool-arguments.ts: a complete argument payload for an undeclared tool is reported as incomplete —
  the model is told to shrink a payload that was never the problem
- stream-xml-parser.ts: <SAVANT_TOOL_CALL> reaches visible text with its cb_tool_name JSON
  (FID-2026-1012-002 step 9)
- stream-xml-parser.ts: <savant_tool_call> reaches visible text with its cb_tool_name JSON
  (FID-2026-1012-002 step 9)
```

## Impact Assessment

### Affected Components

- `packages/llm-providers/src/openai-compatible/chat/stream-transform/tool-arguments.ts`,
  `…/stream-transform/flush-handler.ts` (classification)
- `sdk/src/impl/llm/stream-error-chunk.ts`, `sdk/src/impl/llm/errors.ts`,
  `sdk/src/impl/llm/stream.ts` (vendor-family classification, message factory)
- `common/src/types/contracts/llm.ts` (the `StreamErrorChunk` union + guard)
- `packages/agent-runtime/src/tools/stream-parser/error-chunk.ts`,
  `packages/agent-runtime/src/run-agent-step/loop/native-strikes.ts`,
  `packages/agent-runtime/src/run-agent-step/constants.ts`,
  `packages/agent-runtime/src/run-agent-step/loop-iteration.ts`,
  `packages/agent-runtime/src/run-agent-step/types.ts` (steering, strike policy, plumbing)
- `packages/agent-runtime/src/templates/strings.ts` (subagent addendum)
- `packages/agent-runtime/src/util/stream-xml-parser.ts` (envelope handling)
- Tests, `CHANGELOG.md`, `SCOPE.md`, `dev/LEARNINGS.md`

### Risk Level

- [ ] Critical
- [x] High: an agent run is terminated and its work is lost; the same code path is the recovery
      mechanism every agent depends on, so a wrong split would regress the genuine truncation class it
      exists to serve.
- [ ] Medium
- [ ] Low
- Risk notes: the change is deliberately a **separation**, not a relaxation — `native-incomplete`
  keeps its current producer set (mid-JSON cut) and its `finishReason === 'length'` branch, so the
  byte-exact behavior for the class FID-2026-0816-012/FID-2026-0819-004 built is preserved. The new
  class is narrower (`name ∉ declared tools`) and fails closed into a single corrective retry. The
  parser change is additive (alias normalization + suppression of `cb_tool_name`-bearing blocks);
  prose containing the word `savant` is unaffected.

## Proposed Solution

### Approach

Introduce one new, honest error class for "the model called a tool this request does not declare",
carry it end to end, give it its own (short) recovery policy, remove the prompt sentence that induces
it, and make the parser fail closed on unrecognized tool-call markup. Five seams, each minimal:

1. **Classify** — split the two conditions at their source, where the declared tool set is known.
2. **Carry** — add the class to the stream contract and the loop's step result.
3. **Steer** — one corrective re-prompt listing the agent's actual tools, then fail honestly; never
   payload advice for this class.
4. **Prevent** — the subagent addendum names only phase-gated tools the child actually has.
5. **Contain** — envelope alias normalization plus suppression of `cb_tool_name`-bearing blocks in any
   unrecognized envelope.

Two policy choices belong to the operator and are called out as such (not silently chosen):
**P1** budget for the new class (proposed: 1 corrective retry) and **P2** whether an unavailable-tool
call should also be surfaced to the parent as a typed subagent failure rather than a bare re-spawn
hint (proposed: yes — name the class in the exhausted message).

### Steps

1. **`packages/llm-providers/src/openai-compatible/chat/stream-transform/tool-arguments.ts`** — keep
   `isCompleteKnownToolCallArguments` for the arguments question and expose the name question
   separately:

```ts
/** True when the request actually declared this tool name. */
export function isDeclaredToolName(
  toolName: string,
  requiredToolKeys: ReadonlyMap<string, readonly string[]>,
): boolean {
  return requiredToolKeys.has(toolName)
}
```

2. **`…/stream-transform/flush-handler.ts`** — branch before the completeness gate, so an undeclared
   name is never reported as a payload problem:

```ts
if (!isDeclaredToolName(toolCall.function.name, requiredToolKeys)) {
  controller.enqueue({
    type: 'error',
    error: { type: 'tool-unavailable', toolName: toolCall.function.name },
  })
} else if (isCompleteToolCallArguments(toolCall.function.arguments, requiredToolKeys.get(toolCall.function.name))) {
  /* …enqueue the tool-call part (unchanged)… */
} else {
  /* …native-incomplete with the untouched finish reason (unchanged)… */
}
```

3. **`common/src/types/contracts/llm.ts`** — widen the contract: `NativeToolCallError.type` becomes
   `'native-incomplete' | 'tool-unavailable'`, `StreamErrorChunk`'s error variant gains
   `errorClass: 'tool-unavailable'`, and the guard pair becomes `isNativeToolCallError` (unchanged
   meaning) / `isUnavailableToolError`. `finishReason` stays on the incomplete variant only.

4. **`sdk/src/impl/llm/stream-error-chunk.ts`** — stop discarding the error object:

```ts
export function classifyInvalidToolCall(chunk: { toolName: unknown; error?: unknown }) {
  const toolName = typeof chunk.toolName === 'string' ? chunk.toolName : 'unknown'
  if (NoSuchToolError.isInstance(chunk.error)) {
    return normalizeUnavailableToolStreamError(toolName)
  }
  return normalizeNativeToolCallStreamError({ type: 'native-incomplete', toolName })
}
```

5. **`sdk/src/impl/llm/errors.ts`** — add `normalizeUnavailableToolStreamError(toolName)` producing
   `errorClass: 'tool-unavailable'` and the honest message:
   ```text
   Tool <name> is not available to this agent; the model called a tool that was
   not offered. Use one of the tools you were given for this step.
   ```

   The existing `normalizeNativeToolCallStreamError` is untouched (its `length` branch keeps steering
   splits).

6. **`packages/agent-runtime/src/tools/stream-parser/error-chunk.ts`** — three changes: (a) recognise
   `errorClass === 'tool-unavailable'`, report it on the result as `hasUnavailableToolCall` +
   `lastUnavailableToolName`; (b) skip payload steering for that class and instead emit one
   corrective message listing the agent's own `agentTemplate.toolNames`; (c) fix the drift check at
   `:65-77` to compare against `agentTemplate.toolNames` so the class is logged where it happens.

7. **`packages/agent-runtime/src/run-agent-step/`** — plumb the new flag through `types.ts`
   (`NativeToolCallStepResult`-equivalent fields, `:108-112`), `step/finalize-step.ts:197-198`,
   `step.ts:93-94`, `n-parameter.ts:51,82`, `loop/llm-step-phase.ts:28-29,55-56,82-83`, then in
   `native-strikes.ts` branch on the class: `TOOL_UNAVAILABLE_RECOVERY_MAX_STRIKES = 2` (new,
   `constants.ts`) for the unsatisfiable class, unchanged 3/5 for truncation, and a
   `buildToolUnavailableExhaustedMessage(toolName, available)` that names the class instead of
   prescribing a payload split. *(Specification correction made during implementation: this step
   originally said `= 1`; the strike counter includes the current step, so `1` would abort on the
   first occurrence with no corrective retry. `2` is the "steer once, then fail" the step promises.)*

   **Plumbing correction made during implementation:** no new field was threaded. The class is
   derivable at its two decision points from data already present — the errored tool name and
   `agentTemplate.toolNames` (in `error-chunk.ts` for the steering text, in `native-strikes.ts` and
   `loop-iteration.ts` for the budget and the failure message) — so the file list above
   (`types.ts`, `finalize-step.ts`, `step.ts`, `n-parameter.ts`, `llm-step-phase.ts`) needed no edit.
   Fewer seams, identical contract: one source of truth for "is this tool offered?".

8. **`packages/agent-runtime/src/templates/strings.ts:131`** — derive the phase paragraph from the
   child's own set: list only phase-gated tools present in `toolNames`, and drop the
   "Every other tool — including …" enumeration (its purpose — telling an agent that read tools are
   not phase-gated — is served by naming the tools the child has, not by advertising ones it does not).

9. **`packages/agent-runtime/src/util/stream-xml-parser.ts`** — (a) normalize recognized aliases and
   case folding for the canonical tag (and legacy names) before matching, so
   `<SAVANT_TOOL_CALL>`/`<savant_tool_call>` parse as the canonical envelope; (b) treat any remaining
   unrecognized block that contains the `cb_tool_name` param as protocol and suppress it (fail closed,
   logged), so raw tool-call JSON can never be rendered to the user.

10. **Tests** — add the pins declared below: the conflation split at the provider transform (unknown
    name → `tool-unavailable`; truncated args → `native-incomplete` unchanged;
    `finishReason: 'length'` preserved), the SDK `NoSuchToolError` mapping, one-strike policy +
    honest exhausted message, addendum no longer advertising tools the child lacks, and envelope
    alias normalization + suppression of `cb_tool_name` blocks.
11. **Docs + closure** — `CHANGELOG.md` entry at closure; lesson candidate for `dev/LEARNINGS.md`
    ("one error class per failure cause; a retry that cannot succeed must not consume the recovery
    budget"); `SCOPE.md` item eviction on closure.

### Verification

Provider-transform classification (new pin), SDK classification (existing `llm-invalid-vendor-tool-call`
legs extended), runtime steering/strike behavior (existing `error-chunk-steering` and
`loop-agent-steps-part-f-strikes` legs extended), parser envelope handling (the existing
`stream-xml-parser` suite plus its new sibling `stream-xml-parser-envelopes`), plus the standalone probe
`dev/scratchpad/active/fid-1012-002-unavailable-tool-probe.ts` — measured today at **exit 1 with four
named issues** (evidence item 13): the unseparable name/completeness question and both leaking
envelope variants. It must exit 0 once Steps 1 and 9 land, and it is the record's RED-first proof that
the gate has teeth rather than asserting the fix it awaits. A live model re-run that
spawns `thinker` and observes a clean convergence is **NEEDS-REVIEW**: it costs credits, is not
required to prove the classification split, and is the only way to confirm the *emission* leg (that
the addendum fix removes the inducement) rather than merely bounding its cost.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: typecheck packages/llm-providers
- gate: test packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-steering.test.ts
- gate: test packages/agent-runtime/src/__tests__/loop-agent-steps-part-f-strikes.test.ts
- gate: test packages/agent-runtime/src/util/__tests__/stream-xml-parser.test.ts
- gate: test packages/agent-runtime/src/util/__tests__/stream-xml-parser-envelopes.test.ts
- gate: test packages/llm-providers/src/openai-compatible/chat/stream-transform/tool-unavailable.test.ts
- gate: probe dev/scratchpad/active/fid-1012-002-unavailable-tool-probe.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:d3d66f75ade759d41bad962410a408106b3c51f3f6c407ebababc1ed7eb4d188
- verified: 2026-10-12T05:46:33.042Z
- typecheck packages/agent-runtime: exit 0
- typecheck packages/llm-providers: exit 0
- test packages/agent-runtime/src/tools/stream-parser/__tests__/error-chunk-steering.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/loop-agent-steps-part-f-strikes.test.ts: exit 0
- test packages/agent-runtime/src/util/__tests__/stream-xml-parser.test.ts: exit 0
- test packages/agent-runtime/src/util/__tests__/stream-xml-parser-envelopes.test.ts: exit 0
- test packages/llm-providers/src/openai-compatible/chat/stream-transform/tool-unavailable.test.ts: exit 0
- probe dev/scratchpad/active/fid-1012-002-unavailable-tool-probe.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** two failure classes cataloged with executed repros (evidence items 1-12): the name-unknown /
  args-incomplete conflation at `tool-arguments.ts:42-44`, its two downstream classification sites,
  the payload steering and 3-strike death that follow, the prompt contradiction at `strings.ts:131`,
  the allowlist-blind observability check at `error-chunk.ts:65-77`, and the unparseable envelope that
  leaks `cb_tool_name` JSON to the user.
- **GREEN:** the five-seam separation above, with exact edit points and the new class/message names.
- **AUDIT:** independent verification of every load-bearing claim, below in Loop 2.
- **ADVERSARIAL:** refutation attempts, below in Loop 2.
- **CHANGE DELTA:** initial document.

### Missed Questions

1. *Is this really one FID, or two?* Two defects, one transcript, one shared consequence (a run that
   dies while the model cannot proceed). They are also fixed by different seams (SDK/provider
   classification vs parser envelope handling), so the record keeps them as separable steps (1-8 vs 9)
   for scoping; a split is trivial if the operator prefers two records.
2. *Should the fix simply retry more?* No. Retries cannot satisfy an undeclared-name call; more
   strikes buy more lost steps. The class needs a different action (name the real tools), which is why
   the class must exist before the policy can differ.
3. *Does splitting the class risk regressing truncation recovery?* It is the main risk, and the reason
   the change is a split rather than a rewrite: the `length` branch, the message wording, the 3/5
   strike budgets, and the per-tool steering all stay byte-identical for the incomplete class, which a
   dedicated regression leg pins.
4. *Could the model legitimately intend `read_files` and be right about needing it?* Then the correct
   outcome is the operator-visible message ("not offered to this agent"), not a silent payload retry —
   a tool the persona lacks is a design fact (`agents/thinker/thinker.ts:77`), not a model error to
   grind through.
5. *Should the addendum paragraph be deleted outright?* No — the phase-gating explanation is load
   bearing for green-phase agents; only its enumeration of tools the child does not have is wrong.
6. *Is the leaked block actually executed?* Not established, and not claimed: the on-disk FID carries
   intact markdown while the leaked copy has its markers stripped, which suggests a second, rendered
   path. The parser-level leak is reproduced either way, and the suppression step makes the question
   moot for the user-visible outcome.
7. *Why not fix the model instead (prompt-only)?* Prompt fixes remove the inducement but leave the
   misclassification: any future narrow-allowlist agent (and any provider that emits an undeclared
   name) would still burn three strikes on an unsatisfiable retry, still be told the wrong cause, and
   still be invisible in the ledger.
8. *Does this interact with `FID-2026-0909-007` / `FID-2026-0816-012`?* It completes them: both treat
   the class as model-side truncation by construction. This record separates what they could not, and
   leaves their repairs intact.
9. *Is an automation level of 1 correct?* Yes — the operator asked for the root cause and the options
   before any fix, so implementation is approval-gated by intent, not by risk alone.

### Implementation Evidence (REQUIRED for `closed`)

Implemented on operator approval, 2026-10-12. Working tree only; **no commit, no push** (closure is a
separate ceremony).

- [x] **Commit SHA:** none yet — changes are uncommitted in the worktree, by design (the operator
      approved implementation, not a commit).
- [x] **File:line ranges:**
  - `packages/llm-providers/src/openai-compatible/chat/stream-transform/tool-arguments.ts:37-59` —
    `isDeclaredToolName` added; the completeness predicate now delegates its name check to it, so the
    two questions share one definition instead of one function answering both.
  - `packages/llm-providers/src/openai-compatible/chat/stream-transform/flush-handler.ts:50-70` —
    undeclared name → `{type:'tool-unavailable', toolName}` (no `finishReason`); the executable and
    truncation branches are unchanged.
  - `common/src/types/contracts/llm.ts:19-45,58-70` — `UnavailableToolError` + `isUnavailableToolError`
    guard; `StreamErrorChunk` gains the `errorClass: 'tool-unavailable'` variant.
  - `sdk/src/impl/llm/errors.ts:97-121` — `normalizeUnavailableToolStreamError`.
  - `sdk/src/impl/llm/stream-error-chunk.ts:38-48,95-115` — `classifyNativeToolCallError` routes the
    provider-emitted class; `classifyInvalidToolCall` now reads the part's `error` and maps
    `NoSuchToolError` → unavailable (it previously discarded the error object).
  - `packages/agent-runtime/src/tools/stream-parser/error-chunk.ts:60-105,120-140` — the class is
    derived from `agentTemplate.toolNames`, the drift warning now uses the agent's allowlist, the
    derived case gets an honest body, and the corrective steering names the real tools.
  - `packages/agent-runtime/src/run-agent-step/loop/native-strikes.ts:22-60,85-100` — class-aware
    budget and failure message; `packages/agent-runtime/src/run-agent-step/constants.ts:90-118` —
    `TOOL_UNAVAILABLE_RECOVERY_MAX_STRIKES = 2` + `buildToolUnavailableExhaustedMessage`;
    `packages/agent-runtime/src/run-agent-step/loop-iteration.ts:200-222` — passes
    `availableToolNames: agentTemplate.toolNames` to both.
  - `packages/agent-runtime/src/templates/strings.ts:76-102,158` — `PHASE_GATED_TOOL_NOTES` +
    `buildPhaseAvailabilityNote`, and the addendum now interpolates it.
  - `packages/agent-runtime/src/util/stream-xml-parser-envelope.ts` (new) — the tag vocabulary,
    `ENVELOPE_ALIASES`, `normalizeEnvelopeTags`, `findForeignToolCallTag` (extracted when
    `stream-xml-parser.ts` crossed the 300-line ceiling, keeping one definition of each tag);
    `packages/agent-runtime/src/util/stream-xml-parser.ts:149,197,227` — normalized input, foreign-block
    discard with a matching close tag, and unterminated-tag buffering.
- [x] **Gate output:** see the Verification Receipt below (8/8 declared gates, exit 0 each). Two
      fixtures in the pre-existing suites were corrected to declare the tools they call — the
      truncation ladder those tests own applies only to a tool the agent has — and
      `sdk/src/impl/__tests__/llm-invalid-vendor-tool-call.test.ts` now pins the `tool-unavailable`
      class for `NoSuchToolError` (its old assertion, `native-incomplete`, is the defect).
- [x] **Reproducibility:** `grep -rn "tool-unavailable" common/src sdk/src packages/` matches the
      contract, both classification sites, the runtime handler, the budget and the tests;
      `grep -rn "isDeclaredToolName" packages/llm-providers/src` matches the split.
- [x] **Step statuses:** steps 1-9 `implemented`; step 10 `implemented` (5 declared test artifacts:
      3 extended suites plus 2 new files — `tool-unavailable.test.ts` and the
      `stream-xml-parser-envelopes.test.ts` sibling created when the parser suite crossed the
      repo-wide 300-line file ceiling; the declared probe flips from exit 1 to exit 0); step 11
      `partially implemented` — the CHANGELOG entry is written, the `dev/LEARNINGS.md` lesson and the
      `SCOPE.md` eviction belong to the closure ceremony and are **not** done (this record is not
      closed).

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (each read this session; conflation and emission
      sites read line-exact, then edited there)
- [x] Implementation matches the Proposed Solution, including two corrections recorded above: the
      strike budget is 2 (one corrective retry), and no new plumbing field was added
- [x] Typecheck/tests/lint — `bun run --cwd=<ws> typecheck` exit 0 for `common`,
      `packages/llm-providers`, `sdk`, `packages/agent-runtime`; the four declared suites and the
      probe pass (receipt below); `lint:md` clean for this record
- [x] Production call-graph evidence — the chain is live end to end:
      `flush-handler.ts` (class emitted) → `sdk/src/impl/llm/stream-error-chunk.ts` (class routed) →
      `tools/stream-parser/error-chunk.ts` (class derived + steering) →
      `run-agent-step/loop/native-strikes.ts` (budget) → `loop-iteration.ts:250` (failure message)
- [x] FID status reflects the actual implementation state (`verified` — implementation landed and the
      declared gates pass; the record is **not** closed)

## Resolution

**Approved and implemented 2026-10-12** (working tree only; no commit, no push). The operator approved
Steps 1-11 with P1 = one corrective retry and P2 = a typed failure naming the class.

What changed, in one line each: the OpenAI-compatible transform and the SDK both classify a tool name
the request never declared as `tool-unavailable` instead of `native-incomplete`; the runtime derives
the same class from the agent's own allowlist, steers it with the agent's real tool list, and fails it
after one corrective retry with a message that names the class instead of prescribing a payload split;
the subagent addendum's phase-gating note is built from the child's tools; and the parser normalizes
known envelope aliases and discards any other tool-call-shaped envelope instead of rendering it.

Verification: the RED-first probe
(`dev/scratchpad/active/fid-1012-002-unavailable-tool-probe.ts`) failed with four named issues before
the change and exits 0 after; the eight declared gates pass (receipt below); typecheck is exit 0 for
`common`, `packages/llm-providers`, `sdk`, and `packages/agent-runtime`.

Still open for the operator: the emission leg and the rendering path (NEEDS-REVIEW above), and closure
(the `dev/LEARNINGS.md` lesson, the register eviction, and a path-scoped commit).

### Loop 2 — Independent audit and adversarial meta-verification

- **AUDIT (executed this session):**
  - The conflation is a code fact, not an inference: `tool-arguments.ts:42-44` returns `false` on
    `!requiredToolKeys.has(toolName)` **before** `isCompleteToolCallArguments` is called, and
    `getRequiredToolKeys` derives that map from the request's declared tools
    (`tool-arguments.ts:66-77`).
  - The steering/strike consequence is reproducible without a model: the probe printed the three
    payload messages the Thinker received (evidence item 8), and `agents/thinker/thinker.ts:77`
    confirms `read_files` is not in its allowlist while `common/src/tools/constants.ts` confirms it is
    in the runtime-wide list — which is why the drift warning at `error-chunk.ts:65-77` stayed silent.
  - The leak is reproducible at the parser boundary: `toolCalls: []` with the block present in
    `filteredText`, against a control canonical envelope that parses and strips (evidence item 9).
  - The alias claim is historical, not stylistic: `git log -S 'SAVANT_TOOL_CALL'` matches no commit.
  - `filterToolSet` returns an object for any input (`tools/filter-tool-set.ts:9-18`), and
    `spawn-agents-child-run.ts:156-158` passes it whenever `inheritParentSystemPrompt` is true, so the
    addendum is emitted for the Thinker (`useParentTools`, `loop-context.ts:107-109`) — the
    contradiction is reached, not hypothetical.
- **ADVERSARIAL (refutation attempts):**
  - *"The failing agent may have been the Orchestrator, not a Thinker."* Partly sustained as scope:
    the operator's stack proves only that a **subagent** (`executeSubagent`) died. The classification
    and strike defects apply to any run; the *trigger* leg (the addendum naming those two tools) is
    specific to `inheritsParentSystemPrompt` children, of which the Thinker is the one whose allowlist
    excludes both named tools. Everything except the emission leg remains proven for any subagent.
  - *"Maybe the arguments really were truncated."* Refuted as a conclusion: the classification cannot
    distinguish the two, which is the defect — a truncated-args reading is not evidence, it is the
    assumption this record removes.
  - *"Maybe steering is skipped for unknown tools."* Refuted: `error-chunk.ts:89-101` steers every
    `native-incomplete` chunk, explicitly ungated since FID-2026-0909-007.
  - *"Maybe the 3-strike cap is new."* Refuted: `constants.ts:1` is 3 (5 for terminal commands) since
    FID-2026-0819-004; the caps are intended, the input class is wrong.
  - *Residual finding (advisory, blocking nothing):* the leaked block's markdown arrived stripped in
    the operator's paste, so a second, rendering-side path may exist. Step 9's suppression makes the
    user-visible outcome safe either way, and the rendering path is recorded here as unproven rather
    than folded in.
- **CHANGE DELTA:** initial document plus the Loop 1/2 records and the two advisory notes — no
  post-convergence edits.

#### Implementation audit (post-approval, 2026-10-12)

The operator approved implementation with policy **P1 = one corrective retry** and **P2 = typed failure
naming the class**; both are implemented (P1 as `TOOL_UNAVAILABLE_RECOVERY_MAX_STRIKES = 2`, P2 as
`buildToolUnavailableExhaustedMessage`). Fallout found and resolved by running the suites rather than
by reasoning:

- Three pre-existing assertions failed on the corrected classification: the two strike-ladder tests in
  `loop-agent-steps-part-f-strikes.test.ts` and the strike-1 steering test in
  `error-chunk-steering.test.ts` all called tools their fixture template never declared
  (`run_terminal_command`, `sequentialthinking`, `code_search`). Fixed at the cause — the fixtures now
  declare the tools they call — because under the corrected rule an undeclared call is, by definition,
  not a truncation. Their 5-strike, 3-strike and payload-steering assertions are unchanged.
- One SDK assertion failed because it pinned the defect: `llm-invalid-vendor-tool-call.test.ts`
  expected `native-incomplete` for `NoSuchToolError`. It now pins `tool-unavailable` and additionally
  asserts the truncation class is *not* claimed.
- New pins added to the declared gates: two steering legs (`error-chunk-steering`), one one-retry +
  honest-message leg (`loop-agent-steps-part-f-strikes`), five parser legs in the new
  `stream-xml-parser-envelopes` sibling (case-variant and legacy alias parsing, surrounding-text
  preservation, foreign suppression, split-chunk suppression, prose safety), and a new provider pin
  asserting the three-way split
  (undeclared → `tool-unavailable` with no finish reason; declared + complete → executable tool-call;
  declared + cut → `native-incomplete` with `finishReason: 'length'` preserved).
- Residual, unchanged from Loop 1: the *emission* leg (that a model will pick a tool it lacks) and the
  possible rendering path behind the stripped markdown remain NEEDS-REVIEW — a live model re-run is
  the only way to settle the first, and the parser suppression makes the second harmless either way.

### Loop 3 — Final convergence

Two failure classes are separated on evidence gathered by execution, not recollection: the
unknown-name/truncation conflation at its single source (`tool-arguments.ts:42-44`, mirrored by
`classifyInvalidToolCall`), the unsatisfiable recovery policy that follows, the prompt sentence that
induces the call, and the unrecognized envelope that leaks protocol JSON. Every declared gate names an
existing artifact or a new pin with a stated path. Residual uncertainty is stated rather than hidden:
the emission leg and the possible rendering path are marked NEEDS-REVIEW. Status **verified** — the
document loop ran to convergence, the operator approved implementation, steps 1-10 landed, and the
eight declared gates pass against the current tree (receipt below). The record is **not closed**: the
`dev/LEARNINGS.md` lesson and the register eviction belong to the closure ceremony.

## Lessons Learned

A status message is part of the recovery mechanism. "Incomplete arguments for tool X" was technically
emittable for two different causes — a truncated argument object and a tool name the request never
declared — and the conflation was invisible because the condition lived one branch earlier, in a
completeness helper whose name promised something narrower than it did (`isCompleteKnownToolCallArguments`
answers two questions and reports one). The repair is not a better hint: it is a separate class, so the
policy can be different where the cause is different — a payload split for a genuine cut, an honest
"not available to you" for a name that was never offered, and a bounded cost for the case where no
retry can succeed. Recorded so the next agent that sees `read_files` truncation-shaped errors on a
tool-restricted persona checks the allowlist before it checks the payload size.
