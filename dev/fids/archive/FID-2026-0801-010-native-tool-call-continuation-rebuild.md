# FID: Native Tool-Call Stream Continuation Rebuild

**Filename:** `FID-2026-0801-010-native-tool-call-continuation-rebuild.md`
**ID:** FID-2026-0801-010
**Severity:** critical
**Status:** fixed
**Created:** 2026-08-01
**Author:** Buffy (FreeBuff orchestrator) + independent runtime trace

---

## Summary

The Thinker now spawns with the correct restricted `sequentialthinking` tool, but
the live OpenAI-compatible path still fails end-to-end: the child attempts a
native tool call, the provider/runtime boundary receives an empty or incomplete
argument payload, and no structured tool result reaches the child. FID-008
prevented premature completion of some streamed placeholders. FID-009 correctly
made terminal incomplete calls fail closed, but that safety boundary exposed a
second defect: the child retry/continuation path has not been proven to re-enter
the model with a usable recovery state. This FID rebuilds the native tool-call
boundary as an explicit, typed, bounded state machine: preserve all argument
deltas per tool-call index, finalize only a complete schema-compatible object,
normalize incomplete native failures at the SDK/runtime boundary, fail closed
without exposing raw fragments, and prove that the recoverable error causes a
fresh child model step that can execute `sequentialthinking` normally. No
missing tool arguments will be invented, no authorization boundary will be
weakened, and no model-specific special case will be added. This document
records the approved implementation and its verification boundaries; it does
not claim that repository tests replace live CLI evidence.

---

## Environment

- **OS:** Windows host (`win32`), WSL2/tmux available for CLI verification
- **Language/Runtime:** TypeScript, Bun 1.3.x
- **Packages:** `@savant-code/llm-providers`, `@savant-code/agent-runtime`
- **AI SDK:** `@ai-sdk/provider` 2.0.1, `@ai-sdk/provider-utils` ^3.0.17, `ai` ^5.0.52
- **Provider path:** `opencode-go` → OpenAI-compatible chat streaming
- **Model:** `opencode-go/mimo-v2.5`; unchanged because this path worked before the regression
- **Protocol:** FreeBuff ECHO Protocol `0.1.2-freebuff`
- **Reference implementations:** local `resources/openclaw` and `resources/hermes-agent`
- **Related FIDs:** FID-2026-0801-005, FID-2026-0801-006, FID-2026-0801-007, FID-2026-0801-008, FID-2026-0801-009
- **Current state:** FID-008 and FID-009 are archived; the live behavioral report still fails, so this FID is a corrective implementation boundary

---

## Detailed Description

### Problem

The latest live CLI report records:

```text
THINKER_SPAWNED: PASS
THINKER_CHILD_TOOL_EXECUTED: FAIL
SEQUENTIALTHINKING_CALL_COUNT: 0 successful; invalid-parameter attempts observed
INVALID_PARAMETERS_ERROR: YES
EMPTY_ARGUMENTS_ERROR: YES — original input was {}
TOOL_RESULT_RECEIVED: FAIL
PARENT_TOOL_LEAKAGE: NO
UNAVAILABLE_TOOL_ERROR: NO
RAW_LEGACY_XML_VISIBLE: NO
CHILD_RESULT: FAIL / null
```

The failure is not the old parent-tool cascade, not legacy XML rendering, and
not the model selection. The Thinker receives only its permitted native tool.
The current provider tests pass synthetic placeholder/fragment cases, but the
live report demonstrates that the production stream can still terminate with an
incomplete native call and that the child does not produce a successful fresh
step afterward.

### Expected Behavior

1. The Thinker child receives exactly `sequentialthinking`, with its complete
   model-facing schema and no parent-only tools.
2. Every native argument delta is accumulated independently by tool-call index;
   no delta is discarded after a parseable placeholder.
3. A native call is emitted exactly once only when its accumulated input is a
   complete JSON object containing the declared top-level required keys.
4. A terminal empty, placeholder, malformed, truncated, or schema-incomplete
   payload is never executed and never becomes a fake `{}` tool result.
5. The provider/SDK boundary normalizes an incomplete native call into one
   typed internal recovery outcome, carrying only a safe category and tool name;
   the public print-mode error remains a safe message. Raw argument contents are
   never included in user-facing errors or logs.
6. The agent runtime records the typed recoverable outcome, adds one actionable
   retry message, and performs a bounded fresh child model step. It must not
   create an orphan assistant tool-call or tool-result message.
7. A subsequent valid native call executes through the ordinary authorization
   and Zod validation path and returns a structured tool result.
8. A second consecutive incomplete call stops the retry loop safely rather than
   spinning or fabricating input.
9. Legacy XML filtering remains separate; native incomplete calls never appear
   as literal XML or ordinary assistant prose.
10. Existing valid calls, zero-required-field tools, interleaved calls, and
    parent/child tool isolation remain unchanged.

---

## Root Cause

### 1. Provider safety, SDK normalization, and successful recovery are currently conflated

FID-009's provider flush correctly refuses to emit an incomplete executable
`tool-call`. That is necessary, but it only emits a provider stream `error`
part. The current `sdk/src/impl/llm.ts` adapter maps selected AI SDK error
classes (`NoSuchToolError`, `InvalidToolInputError`, `ToolCallRepairError`, and
`TypeValidationError`) to the generic `{ type: 'error', message }` stream chunk;
it does not establish a distinct native-incomplete category for the provider's
terminal incomplete-call signal. Generic errors can instead remain fatal and be
thrown. The existing focused tests prove that `hadToolCallError` can be set for
executor validation errors; they do not prove the provider-error → typed SDK
outcome → `processStream` → `runAgentStep` → `loopAgentSteps` → second child
model call path.

A fail-closed provider boundary cannot reconstruct fields the gateway never
sent. The missing behavior is a tested, typed continuation contract across the
SDK adapter and runtime, not a permissive schema shortcut. The implementation
must not treat every generic stream error as recoverable.

### 2. The stream accumulator has no explicit terminal state model

The current provider stores `arguments` and `hasFinished` per index, but the
lifecycle is spread across first-fragment completion, later-fragment merging,
and `flush()`. This makes it difficult to distinguish:

- an open partial JSON buffer;
- a complete usable object;
- a complete but unusable placeholder (`{}`, `[]`, `null`, or string);
- a terminal malformed/incomplete buffer; and
- an already-emitted call.

OpenClaw keeps a bounded raw `partialArgs` buffer as the source of truth and
re-parses it on every delta. Hermes explicitly models interrupted/partial tool
streams and sends them through a bounded recovery path. Savant needs the same
separation without importing a new parser or inventing arguments.

### 3. The live path is under-tested at the actual continuation boundary

The provider integration tests cover synthetic SSE accumulation and the runtime
tests cover executor validation. There is no focused test that feeds a provider
incomplete-call error into a child `loopAgentSteps`, verifies a second model
invocation, and then verifies a structured `sequentialthinking` execution.
Therefore the earlier FID-009 closure overclaimed end-to-end behavior.

---

## Evidence

### Live regression evidence

The operator's live report on `opencode-go/mimo-v2.5` observed a Thinker spawn,
then an attempted `sequentialthinking` call with `{}` and an invalid-parameters
error. No structured result arrived. A separate live report observed
`Incomplete arguments for tool sequentialthinking`; both reports agree on the
same native-call failure class.

### Current Savant source evidence

- `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts`
  accumulates native tool fragments and currently emits a provider `error` in
  `flush()` when the required top-level keys are not present.
- The same provider has the FID-008/009 helpers and focused SSE tests, but the
  helper tests do not exercise the complete agent-loop continuation.
- `packages/agent-runtime/src/tools/stream-parser.ts` sets `hadToolCallError`
  when an error chunk is observed and adds a tagged retry message to history,
  but the current `StreamChunk` error shape has no native-recovery category.
- `sdk/src/impl/llm.ts` converts selected AI SDK full-stream errors into generic
  error chunks and throws other errors; this is the required normalization
  boundary for the new typed native-incomplete outcome.
- `common/src/types/contracts/llm.ts` defines the internal `StreamChunk` union
  and must remain fully typed if the native-recovery discriminator is added.
- `packages/agent-runtime/src/run-agent-step.ts` currently uses the generic
  `hadToolCallError` gate to prevent normal no-tool-call completion. This is
  insufficient as a bounded native retry oracle until a typed outcome is
  propagated and counted by the outer loop.
- `packages/agent-runtime/src/tool-stream-parser.ts` processes native
  `tool-call` parts separately from the legacy XML parser. It must continue to
  reject incomplete raw input without rendering it as XML.
- `agents/thinker/thinker.ts` restricts the child to
  `toolNames: ['sequentialthinking']`.
- `common/src/tools/params/tool/sequential-thinking.ts` declares four required
  fields: `thought`, `thoughtNumber`, `totalThoughts`, and
  `nextThoughtNeeded`.

### Reference evidence

- OpenClaw's `partialArgs` accumulator is retained as the source of truth and
  parsed continuously for preview; final normalization occurs separately.
- OpenClaw's malformed-argument repair is bounded, tool-call scoped, and only
  promotes a balanced usable object. It does not invent absent required values.
- Hermes distinguishes an interrupted stream from a valid tool call and uses a
  bounded retry/repair path rather than executing partial arguments.
- These references support an explicit accumulator/finalizer/recovery contract,
  not wholesale dependency adoption and not model-specific behavior.

---

## Impact Assessment

### Affected Components

- `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts`
- `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.test.ts`
- `packages/agent-runtime/src/tools/stream-parser.ts`
- `packages/agent-runtime/src/__tests__/tool-validation-error.test.ts` or a focused continuation test
- `packages/agent-runtime/src/__tests__/loop-agent-steps.test.ts`
- `packages/agent-runtime/src/run-agent-step.ts`
- `sdk/src/impl/llm.ts`
- `common/src/types/contracts/llm.ts`
- Any shared typed error-contract tests required by the existing workspace boundaries
- Live Thinker CLI/tmux test prompt and captured evidence

### Risk Level

- [x] Critical: the default Thinker reasoning path can fail end-to-end
- [ ] High: major feature broken, workaround exists
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor cosmetic or edge case

---

## Proposed Solution

### Approach

Rebuild the boundary around explicit typed states and a bounded runtime retry,
while preserving the existing security and schema boundaries.

#### A. Provider: one canonical per-index accumulator

1. Replace scattered completion decisions with a typed per-index record whose
   state distinguishes `open`, `complete`, `emitted`, and `incomplete`.
2. Keep the raw argument text bounded and append every non-null argument delta.
   Never mark a call complete merely because the current text is parseable JSON.
3. Use a single typed classifier that returns one of:
   `complete-object`, `placeholder-object`, `non-object`, or `invalid-json`.
4. For a placeholder followed by a fresh object fragment, replace only the
   stale placeholder buffer; for ordinary partial JSON, append. Preserve the
   canonical delta sequence emitted to the AI SDK rather than emitting a delta
   that no longer matches the final input.
5. At terminal flush, emit one normal `tool-call` only for a complete object that
   satisfies the declared required-key set. Otherwise emit one safe provider
   error, close `tool-input` exactly once, and never emit an executable call.
6. Do not repair missing values, loosen required keys, expose raw argument text,
   or add an opencode-go-specific branch.

#### B. SDK/runtime: explicit typed recovery and bounded continuation

1. Normalize the provider/AI SDK incomplete-native-call signal in
   `sdk/src/impl/llm.ts` into a discriminated internal `StreamChunk` error
   outcome. The contract must distinguish `native-incomplete` from ordinary
   validation, repair, network, and fatal stream errors using concrete types;
   no `any`, `unknown` parameter/return shortcut, or string-message inference
   may be used.
2. Preserve the public `PrintModeEvent` error as a safe message-only event. The
   internal category may carry only a safe tool name and recovery classification;
   it must never carry raw argument buffers or prompt contents.
3. Make `processStream` propagate the native-incomplete outcome separately from
   generic `hadToolCallError`, while retaining the existing executor as the
   final authorization and complete Zod validation boundary.
4. Make `runAgentStep` return the typed native-recovery outcome to
   `loopAgentSteps`. The outer loop owns a local consecutive native-recovery
   counter for the current agent run; it is not inferred from total
   `stepsRemaining` and does not affect unrelated validation retries.
5. On the first native-incomplete outcome, append exactly one actionable
   retry-message and allow exactly one fresh child model step. On the second
   consecutive native-incomplete outcome, stop the child safely with a clear
   final error and make no third model invocation. A valid tool result resets
   the consecutive native-recovery counter.
6. Add only error/retry user messages to history. Do not append an assistant
   tool-call or tool-result pair for a call that never executed.
7. Keep provider accumulation/finalization fail-closed and keep legacy XML
   filtering separate. A generic provider/network error remains fatal unless an
   explicit typed classification says it is recoverable.

#### C. Test seams and live proof

1. Add provider SSE tests for normal fragmentation, stale placeholders,
   empty/malformed terminal payloads, multiple interleaved indices, and exact
   one-time lifecycle events.
2. Add an agent-runtime continuation test with a deterministic child stream:
   first invocation emits an incomplete provider error; second invocation emits
   a valid `sequentialthinking` call and structured result. Assert two model
   invocations, one tool execution, no orphan history, and no raw fragment leak.
3. Add an SDK-contract test proving provider incomplete-call errors are
   normalized to the native-incomplete discriminator while unrelated generic
   stream errors remain fatal/non-recoverable.
4. Add a bounded-retry test: two consecutive native-incomplete invocations
   produce one final safe failure and no third invocation; a valid tool result
   resets the counter.
5. Add a live WSL/tmux prompt that requests two sequentialthinking calls and
   records child start, call count, structured results, error categories, and
   final child output.

### Explicit Non-Goals

- Changing `opencode-go/mimo-v2.5` or selecting another model.
- Changing Thinker permissions or adding parent tools.
- Inventing/defaulting `thought`, `thoughtNumber`, `totalThoughts`, or
  `nextThoughtNeeded`.
- Weakening executor Zod validation or authorization.
- Replacing the entire AI SDK, adding `partial-json`, or importing an OpenClaw
  package without a separately approved dependency FID.
- Rewriting legacy XML parsing, Markdown rendering, or CLI visual formatting.
- Logging raw tool-call argument buffers or sensitive prompt contents.

---

## Verification Matrix

| Case                                      | Required evidence                                                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Complete one-shot Thinker object          | One `tool-call`, one structured result, no error                                                                                       |
| Normal split object                       | One merged call with every canonical field                                                                                             |
| Placeholder then real object              | One call containing only the real object                                                                                               |
| Terminal `{}` with required fields        | One safe error, zero executable calls                                                                                                  |
| Empty/whitespace/malformed terminal input | One safe error, zero executable calls                                                                                                  |
| Zero-required-field `{}`                  | One valid call                                                                                                                         |
| Interleaved valid/incomplete calls        | Independent outcomes by index                                                                                                          |
| First child step incomplete, second valid | Exactly two child model calls; one tool result; no orphan history                                                                      |
| Two consecutive incomplete child steps    | Bounded stop; no third model call                                                                                                      |
| Parent-only tool attempt                  | Zero unauthorized-tool errors in the valid regression path                                                                             |
| Live CLI                                  | Thinker spawned; at least two structured `sequentialthinking` calls/results; no invalid-parameter, raw XML, or unavailable-tool errors |

---

## Perfection Loop

### Loop 1 — RED — COMPLETE

- Read the FreeBuff ECHO Protocol `0.1.2-freebuff` from 0-end.
- Read the FID template from 0-end and scanned active/archive FIDs; allocated the
  unused `FID-2026-0801-010` identifier.
- Read the full live regression report and archived FID-008/009 records.
- Traced the native path from OpenAI-compatible SSE accumulation through the AI
  SDK stream parts, `processStreamWithTools`, executor validation, and the child
  loop.
- Confirmed the live failure is distinct from the resolved parent-tool filtering
  and legacy XML issues.
- Confirmed the current focused provider/runtime tests pass but do not prove
  provider-error → fresh child-step → valid tool-result continuation.
- Reviewed the local OpenClaw accumulator/repair and Hermes partial-stream
  recovery patterns.

### Loop 1 — GREEN — CONVERGED DESIGN

- Selected a canonical typed per-index accumulator and finalizer.
- Preserved fail-closed behavior for terminal incomplete input.
- Selected a fresh child continuation as the only mechanism that can recover
  when the gateway did not deliver complete arguments; no missing values are
  synthesized.
- Corrected the design to add an explicit SDK/runtime error discriminator rather
  than relying on the current generic error string or `hadToolCallError` alone.
- Assigned bounded retry ownership to the outer agent loop, separate from the
  general step budget.
- Kept authorization, tool filtering, schema validation, XML handling, and model
  selection unchanged.
- Added an explicit test seam for the exact live failure followed by a valid
  retry, plus a two-failure bounded-stop case.
- Rejected wholesale OpenClaw parser adoption because Savant does not need to
  execute repaired partial JSON and adding a dependency would expand scope.

### Loop 1 — AUDIT — COMPLETE

The design was independently checked against the current provider, SDK adapter,
runtime source, and the local OpenClaw/Hermes references. The audit found no
reason to weaken the fail-closed boundary or invent missing fields. It confirmed
that `tool-input-end` alone cannot validate or synthesize a tool call, that the
provider's `error` part must be normalized before the runtime can safely classify
recovery, and that successful recovery must be demonstrated at the actual
child-loop boundary rather than inferred from provider unit tests. The audit also
confirmed that native events remain separate from legacy XML parsing.

The audit specifically rejected using the generic `hadToolCallError` flag as the
bounded retry counter: it covers multiple error classes and the current loop
would otherwise rely on the unrelated global step budget. The corrected design
therefore requires a typed native-incomplete outcome and a dedicated consecutive
counter owned by `loopAgentSteps`.

### Loop 1 — SELF-CORRECT — COMPLETE

The initial design was corrected in four ways before implementation:

1. **No parser wholesale port:** OpenClaw's continuously repaired object is useful
   for UI preview, but promoting partial JSON to execution would be unsafe for
   `sequentialthinking`; Savant will retain raw accumulation and only execute a
   complete required-key object.
2. **No invented retry payload:** Hermes-style recovery is interpreted as a fresh
   model continuation, not as synthetic tool arguments. The retry must be tested
   with an actual second model invocation.
3. **No assumed existing retry proof:** `hadToolCallError` is only a general
   continuation signal, not a native-recovery counter. The FID now requires a
   dedicated typed outcome and bounded loop-owned counter.
4. **No generic-error recovery:** The current SDK adapter's message-only error
   chunk is not sufficient to identify a native incomplete call. The FID now
   requires explicit typed normalization in the SDK/common contract, while
   unrelated generic stream errors remain fatal and raw fragments stay private.

### Loop 2 — AUDIT — COMPLETE

A second source audit re-read the provider flush path, the AI SDK stream-part
contract, the SDK full-stream adapter, `processStream`, and `loopAgentSteps`. It
confirmed the minimal implementation boundary: provider lifecycle correctness,
explicit SDK normalization, typed runtime propagation, and a loop-owned bounded
continuation oracle. The audit found no unresolved design blocker after the
retry-ownership and error-classification corrections. The implementation was
approved and completed without changing model selection, permissions, or XML
handling.

### Implementation Verification Evidence

- `common/src/types/contracts/llm.ts` now uses separate strictly typed stream-error variants; ordinary errors do not rely on optional `undefined` discriminator fields.
- `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts` emits a safe typed native-incomplete provider error at terminal flush and never emits an incomplete executable tool call.
- `sdk/src/impl/llm.ts` recognizes the typed provider error and yields a safe `native-incomplete` `StreamChunk`; unclassified provider errors remain fatal.
- `packages/agent-runtime/src/tools/stream-parser.ts` propagates the native classification separately from generic tool errors and retains only safe retry messaging.
- `packages/agent-runtime/src/run-agent-step.ts` owns a consecutive native-recovery counter, fails after the second consecutive incomplete step, and records `status: 'failed'` with the exhaustion message.
- `packages/agent-runtime/src/__tests__/loop-agent-steps.test.ts` proves successful Thinker recovery, bounded stopping, streak reset, and no orphan assistant tool-call/tool-result history.
- `sdk/src/impl/__tests__/llm-native-tool-call.test.ts` directly exercises the strictly typed SDK normalization boundary and verifies both native-incomplete normalization and rejection of unclassified provider errors; provider SSE finalization remains covered by the provider suite.
- Focused validation: 91 tests passed / 0 failed; common, SDK, llm-providers, and agent-runtime typechecks passed; ESLint, Prettier, and `git diff --check` passed.
- Remaining evidence gap: no live CLI/tmux capture has yet demonstrated the production `opencode-go/mimo-v2.5` Thinker spawn, valid sequentialthinking execution, and structured result after this implementation.

### Missed Questions

1. **Can a provider error reconstruct missing fields?** → No. It can only trigger a
   fresh model step; missing values must never be fabricated.
2. **Does `tool-input-end` itself execute or validate a call?** → No. It closes
   the input lifecycle; the separate `tool-call` part carries executable input.
3. **Why did provider unit tests pass while the CLI failed?** → They cover
   synthetic SSE shapes but not the production child continuation after a
   terminal provider error.
4. **Is the model inherently incompatible?** → Not established. The same model
   path worked before the regression; the implementation must remain provider
   and model agnostic unless new evidence proves otherwise.
5. **Should partial JSON be repaired into a tool call?** → No. Repair is allowed
   only for safe normalization of a complete balanced object; required values
   cannot be invented and incomplete input remains non-executable.
6. **Can retry loop indefinitely?** → No. One bounded recovery step is the
   default; a second consecutive incomplete call stops safely.
7. **Should failed calls be written to history?** → No. Only the safe error/retry
   user message is retained, preventing orphan tool-call/result pairs.
8. **What proves end-to-end success?** → A deterministic two-invocation runtime
   test and a fresh live CLI capture showing structured Thinker calls/results.
9. **Does this reopen permissions or XML parsing?** → No. Both are explicit
   non-goals and separate boundaries.
10. **Is a new package required?** → No. The existing provider, SDK, common
    contract, and agent-runtime boundaries are sufficient; a new dependency or
    parser package is not justified.
11. **Can the current generic `{ type: 'error', message }` chunk safely drive
    native recovery?** → No. It lacks an error-class discriminator. Add a
    strictly typed internal category at the SDK/common boundary; keep the public
    print event message-only.
12. **Who owns the retry budget?** → `loopAgentSteps` owns a consecutive
    native-recovery counter for the current run. It must not reuse the general
    `stepsRemaining` budget or retry unrelated fatal errors.

### Code Verification Evidence

- [x] FreeBuff ECHO specification read 0-end.
- [x] FID template read 0-end.
- [x] Active/archive FID inventory scanned; `FID-2026-0801-010` is unused.
- [x] Live regression report and archived FID-008/009 records read.
- [x] Provider accumulation and terminal flush source read.
- [x] AI SDK stream-part contract inspected.
- [x] Runtime error and loop continuation source read.
- [x] SDK full-stream error normalization source read.
- [x] Common `StreamChunk` and public print-mode error contracts read.
- [x] Local OpenClaw/Hermes reference paths inspected.
- [x] RED/GREEN/AUDIT/SELF-CORRECT loop converged after Loop 2 correction.
- [x] Operator approval for implementation.
- [x] Provider regression tests after implementation.
- [x] SDK adapter boundary tests after implementation.
- [x] Runtime continuation tests after implementation.
- [x] Four-workspace typechecks, lint, format, and `git diff --check`.
- [x] Independent final implementation review after the latest test-boundary correction.
- [ ] Fresh live WSL/tmux Thinker capture.

## Resolution

- **Fixed By:** Buffy / FreeBuff implementation
- **Fixed Date:** 2026-08-01
- **Fix Description:** Added a strictly typed `native-incomplete` stream error contract; preserved fail-closed provider finalization for incomplete required-key arguments; normalized the provider signal in `promptAiSdkStream`; propagated it through `processStream`; added a bounded two-attempt consecutive recovery state in `loopAgentSteps`; persisted a truthful failed step on exhaustion; and preserved the existing Thinker authorization boundary. Incomplete calls never create executable tool-call/tool-result history pairs.
- **Tests Added:** Provider SSE typed-error assertions; strictly typed SDK normalization-boundary tests for native-incomplete and fatal generic errors; runtime successful continuation, bounded retry, streak reset, no-orphan-history, and existing parser/validation regression coverage.
- **Verified By:** Four workspace typechecks; 91 focused tests / 0 failures; ESLint with zero warnings; Prettier check; `git diff --check`; and the implementation review recorded in the FID. The live WSL/tmux Thinker capture remains an explicit operator gate and is not claimed here.
- **Commit/PR:** Not created
- **Archived:** Not archived; retain as active `fixed` FID until the live CLI capture confirms the production Thinker path

## Lessons Learned

1. A provider safety fix is not an end-to-end recovery fix; both boundaries need
   independent evidence.
2. OpenClaw's partial accumulator and Hermes' bounded interrupted-stream handling
   are complementary patterns, not permission to execute guessed arguments.
3. The most important regression fixture must cross the provider, AI SDK, runtime,
   child loop, and tool-result history boundaries.
4. A failed native call must never leave an orphan tool-call/result pair in the
   next model context.
5. Model identity should remain constant while diagnosing a regression that
   appeared after a runtime change; changing models hides causality.
