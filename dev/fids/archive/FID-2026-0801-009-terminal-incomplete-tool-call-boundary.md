# FID: Terminal Incomplete Native Tool-Call Boundary

**Filename:** `FID-2026-0801-009-terminal-incomplete-tool-call-boundary.md`
**ID:** FID-2026-0801-009
**Severity:** critical
**Status:** closed
**Created:** 2026-08-01
**Author:** Buffy (FreeBuff orchestrator) + RED trace

---

## Summary

The live CLI still fails when the OpenAI-compatible gateway ends a native
Thinker tool-call stream after delivering an empty `{}` argument payload. FID-
2026-0801-008 correctly prevents premature completion when a placeholder is
followed by later argument fragments, but its `flush()` path still emits every
unfinished call as a final `tool-call`, including terminal `{}`, empty, and
malformed inputs. The executor then receives `{}` and reports missing required
`sequentialthinking` fields. No downstream layer can reconstruct arguments that
were never delivered. This FID adds a fail-closed terminal boundary: only a
complete object candidate containing every declared required top-level key
becomes an executable tool-call candidate; terminal incomplete calls become a
typed provider error and trigger the existing bounded continuation path,
without changing model selection, Thinker permissions, or executor validation.

## Environment

- **OS:** Windows host (`win32`), WSL2/tmux available for CLI verification
- **Language/Runtime:** TypeScript, Bun 1.3.x
- **Packages:** `@savant-code/llm-providers`, `@savant-code/agent-runtime`
- **AI SDK:** `@ai-sdk/provider` 2.0.1, `@ai-sdk/provider-utils` ^3.0.17, `ai` ^5.0.52
- **Provider path:** `opencode-go` → `OpenAICompatibleChatLanguageModel.doStream()`
- **Model:** `opencode-go/mimo-v2.5`; held constant because the same path worked before the regression
- **Protocol:** FreeBuff ECHO Protocol `0.1.2-freebuff`
- **Related FIDs:** FID-2026-0801-005, FID-2026-0801-006, FID-2026-0801-007, FID-2026-0801-008
- **Current state:** Implemented and verified; FID-008 accumulation behavior remains preserved

## Detailed Description

### Problem

The fresh live CLI regression report recorded:

```text
THINKER_SPAWNED: PASS
PARENT_TOOL_LEAKAGE: NO
UNAVAILABLE_TOOL_ERROR: NO
RAW_LEGACY_XML_VISIBLE: NO
THINKER_CHILD_TOOL_EXECUTED: FAIL
SEQUENTIALTHINKING_CALL_COUNT: 1 attempted, 0 successful
INVALID_PARAMETERS_ERROR: YES
EMPTY_ARGUMENTS_ERROR: YES — original input was {}
TOOL_RESULT_RECEIVED: FAIL
CHILD_RESULT: FAIL — null/empty
```

The child receives the correct `sequentialthinking` definition. The failure is
not a permission failure, XML parser failure, model-selection change, or schema
serialization failure. The provider emits a native `tool-call` with `{}` at
stream finalization, and the executor correctly rejects it because the tool
requires `thought`, `thoughtNumber`, `totalThoughts`, and `nextThoughtNeeded`.

### Expected Behavior

1. A native tool call is executable only when its accumulated JSON is complete
   and sufficient for that tool's declared input schema.
2. A placeholder `{}` followed by later fragments remains open and accumulates
   those fragments.
3. A terminal `{}` for a tool with required fields is never emitted as an
   executable `tool-call`.
4. Empty, whitespace-only, malformed, truncated, array, `null`, and string
   arguments at terminal stream end are never silently executed.
5. Terminal incomplete calls produce a typed, non-sensitive provider error that
   reaches the existing agent-runtime error/retry path.
6. A genuinely zero-required-field tool may still complete with `{}` when its
   declared schema explicitly permits an empty object.
7. Complete valid Thinker arguments execute normally and produce a tool result.
8. No unauthorized tool becomes available, and no executor schema is weakened.

### Root Cause

FID-008 changed the in-stream completion predicate from generic parseable JSON to
`isCompleteToolCallArguments`, which requires a non-empty object. That correctly
covers a placeholder followed by another delta. However, the provider's terminal
flush still unconditionally emits all unfinished calls:

```typescript
for (const toolCall of toolCalls.filter((toolCall) => !toolCall.hasFinished)) {
  controller.enqueue({ type: 'tool-input-end', id: toolCall.id })
  controller.enqueue({
    type: 'tool-call',
    toolCallId: toolCall.id,
    toolName: toolCall.function.name,
    input: toolCall.function.arguments,
  })
}
```

When the gateway sends `{}` as its only argument fragment, the call remains
unfinished by design and then enters this flush branch. The executor receives
that raw payload and runs the real Zod schema, producing the observed
`received undefined` errors. The provider cannot manufacture the four missing
fields. Hermes and OpenClaw treat this class as an incomplete stream boundary
requiring repair/retry or fail-closed handling rather than executing corrupt
arguments.

### Evidence

1. **Live CLI report:** FID-008 behavioral test observed a Thinker child, no
   permission/XML errors, and a terminal `{}` reaching `sequentialthinking`.
2. **Provider source:** `packages/llm-providers/src/openai-compatible/chat/
openai-compatible-chat-language-model.ts` retains unfinished calls in
   `flush()` and emits their raw arguments as `tool-call` parts.
3. **Executor source:** `packages/agent-runtime/src/tools/tool-executor.ts`
   passes the received input to `parseRawToolCall()` and validates it against
   `toolParams.sequentialthinking.inputSchema`; it does not create `{}`.
4. **Schema source:** `common/src/tools/params/tool/sequential-thinking.ts`
   declares four required fields: `thought`, `nextThoughtNeeded`,
   `thoughtNumber`, and `totalThoughts`.
5. **Child path:** `run-agent-step.ts` constructs the Thinker's own tool set when
   the parent lacks `sequentialthinking`; the child tool boundary is correct.
6. **Schema preparation:** `openai-compatible-prepare-tools.ts`,
   `compile-tool-definitions.ts`, `common/src/tools/list.ts`, and the
   sequential-thinking schema are unchanged relative to `HEAD`.
7. **Reference behavior:** local OpenClaw keeps partial arguments in a volatile
   accumulator and uses repair/finalization logic; local Hermes identifies
   interrupted or partial tool streams and enters a repair/retry path rather
   than treating truncated arguments as valid execution input.
8. **Regression timing:** the model/provider selection is unchanged; the live
   failure appeared after the child native tool path became active. This FID
   therefore does not change model inheritance or add a provider special case.

## Impact Assessment

### Affected Components

- `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts`
- Its OpenAI-compatible gateway consumers: OpenCode Go, TokenRouter, NVIDIA,
  Cloudflare, and compatible providers
- `packages/agent-runtime/src/tools/stream-parser.ts` and
  `packages/agent-runtime/src/tool-stream-parser.ts` for error propagation
- Thinker `sequentialthinking` execution in the live CLI
- Provider and agent-runtime regression tests
- Manual Savant-Code CLI/tmux verification

### Risk Level

- [x] Critical: the default Thinker reasoning path can fail end-to-end
- [ ] High: major feature broken, workaround exists
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor cosmetic or edge case

## Proposed Solution

### Approach

Add one typed terminal-finalization decision at the existing provider boundary.
Do not add a package, change the model, weaken a tool schema, or repair missing
required values with invented defaults.

1. Keep the completion classifier strictly typed and narrow at the provider
   boundary. It must:
   - parse the accumulated argument text safely;
   - require a JSON object rather than an array, string, or `null`;
   - preserve a distinction between malformed/incomplete JSON and a complete
     object;
   - read only the prepared model-facing JSON Schema's top-level `required`
     names and require those keys to be present in the accumulated object;
   - accept `{}` only when that prepared schema has no required names;
   - leave value types, refinements, semantic constraints, and authorization to
     the existing runtime Zod/executor boundary rather than duplicating them in
     the provider.
2. Preserve FID-008's stale-fragment accumulation behavior. A parseable
   placeholder followed by a fresh object fragment must replace the stale
   fragment and continue accumulating; it must not be finalized early.
3. Change terminal flush behavior so it never emits malformed, empty, or
   schema-disallowed raw arguments as an executable `tool-call`. For an
   unfinished call:
   - if the accumulated arguments are a complete object, emit the normal
     `tool-input-end` and `tool-call` pair exactly once, except for a terminal
     `{}` whose prepared schema declares required fields;
   - if the arguments are empty, malformed, truncated, or a disallowed `{}`,
     close the input lifecycle once and emit one typed provider `error` stream
     part containing only safe metadata such as tool name, call ID, and an
     actionable retry category;
   - do not include raw argument contents in logs or user-facing diagnostics;
   - set the stream finish state to error and let the existing runtime
     `hadToolCallError` continuation advance at most one configured agent step.
4. Keep the executor as the final authorization and full Zod-validation boundary
   for complete candidates. Do not default missing input to `{}`, bypass
   validation, or broaden `toolNames`.
5. Keep native tool-call handling separate from legacy XML filtering. A native
   incomplete-call error must not be rendered as XML or ordinary assistant text.
6. Preserve valid one-shot complete calls, normal fragmented calls, interleaved
   calls, and explicitly zero-required-field tools.

### Scope Boundary

**In scope:** provider terminal classification, schema-aware completion, typed
error propagation, focused provider/runtime tests, and live Thinker verification.

**Out of scope:** model/provider selection, `withParentModel()`, Thinker
permissions, FID-005/006/007 behavior, the sequentialthinking schema itself,
legacy XML parsing, Markdown/UI formatting, new dependencies, and raw argument
logging.

### Implementation Steps After Approval

1. Read the complete provider and relevant runtime/test files again before edit.
2. Introduce the smallest strictly typed completeness/classification helper at
   the provider boundary; use domain types rather than `any`, `unknown` as a
   public API type, or untyped fallbacks.
3. Apply the helper to both in-stream completion and terminal flush paths.
4. Add focused tests for:
   - terminal `{}` with required fields → error, no `tool-call`;
   - terminal empty/whitespace arguments → error, no `tool-call`;
   - terminal malformed/truncated JSON → error, no `tool-call`;
   - placeholder `{}` followed by full Thinker arguments → one valid call;
   - complete one-shot Thinker arguments → one valid call;
   - fragmented Thinker arguments → one valid call;
   - schema with no required fields and terminal `{}` → valid call;
   - interleaved valid and incomplete calls → independent outcomes;
   - no duplicate `tool-input-end`/`tool-call` emission;
   - runtime error propagation causes continuation and does not add an orphan
     tool call/result pair to message history.
5. Run provider and agent-runtime focused tests, then all required workspace
   typechecks, lint, formatting, and `git diff --check`.
6. Verify production call-graph reachability from provider stream to runtime
   error handling with targeted search and source re-read.
7. Run the live Thinker CLI test prompt through tmux/WSL and capture evidence of
   at least two successful `sequentialthinking` calls and tool results.

### Verification Matrix

| Case                                     | Expected result                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Required schema + terminal `{}`          | Provider error; zero executable calls                                                     |
| Required schema + empty/whitespace args  | Provider error; zero executable calls                                                     |
| Required schema + truncated JSON at EOF  | Provider error; zero executable calls                                                     |
| `{}` then complete required object       | One complete executable call with full arguments                                          |
| Complete required object in one chunk    | One executable call and normal result                                                     |
| Normal fragments forming required object | One executable call and normal result                                                     |
| Zero-required-field object schema + `{}` | One valid executable call                                                                 |
| Two interleaved calls, one incomplete    | Valid call executes; incomplete call errors independently                                 |
| Live Thinker CLI                         | Thinker spawned; ≥2 `sequentialthinking` calls and results; zero invalid-parameter errors |

## Perfection Loop

### Loop 1 — RED — COMPLETE

- Read the FreeBuff ECHO specification from 0-EOF before drafting.
- Read the FID template from 0-EOF and scanned active/archive FIDs; FID-009 is
  unused.
- Reproduced the live evidence from the operator's report: Thinker spawn and
  isolation pass, terminal `{}` fails validation, child output is null.
- Traced the full native path: provider `doStream()` → `tool-call` stream part
  → `processStreamWithTools()` → `processStream()` → `executeToolCall()` →
  `parseRawToolCall()` → Zod validation.
- Confirmed the runtime does not manufacture `{}` and does not weaken the
  sequentialthinking schema.
- Confirmed FID-008 covers placeholder-then-real-fragment streams but its
  unconditional terminal flush still emits invalid unfinished calls.
- Compared local Hermes/OpenClaw handling and identified fail-closed
  repair/retry as the applicable reference pattern.
- Rejected model changes as unsupported by the temporal evidence and outside
  the actual failing boundary.

### Loop 1 — GREEN — DESIGN-CONVERGED

- Selected a typed syntactic terminal classifier at the provider boundary.
- Selected prepared-schema inspection only for deciding whether terminal `{}` is
  permitted; full required-field and value validation remains in the executor.
- Selected fail-closed error emission for terminal incomplete arguments; missing
  required values must never be invented.
- Preserved FID-008 accumulation and stale-fragment replacement for later
  fragments.
- Preserved executor authorization and schema validation as independent final
  boundaries.
- Rejected adding a JSON-repair dependency, special-casing MiMo/OpenCode Go,
  changing Thinker model inheritance, weakening Zod validation, or forwarding
  raw malformed arguments to the executor.

### Loop 1 — AUDIT — COMPLETE

Independent analysis checked the proposed boundary against the provider,
executor, schema, child-tool, and reference paths. It found no reason to change
model selection or tool permissions. It confirmed that terminal `{}` is
ambiguous at a generic provider layer and must be resolved from the declared
schema rather than assumed valid or invalid globally. It also confirmed that a
provider error is safer than emitting a corrupt tool call because the existing
runtime already records tool-call errors and continues the agent loop.

### Loop 1 — SELF-CORRECT — COMPLETE

The design was tightened in response to audit questions:

1. **Zero-argument tools:** `{}` is accepted only when the declared schema has
   no required top-level fields; it is not globally rejected.
2. **Partial objects:** a syntactically complete object is not sufficient when
   required fields remain absent; it stays incomplete and cannot execute.
3. **Security/privacy:** raw malformed argument strings are excluded from the
   provider error and logs; only safe identifiers and a retry category are
   exposed.
4. **Duplicate events:** tests must prove an incomplete call produces no
   executable `tool-call` and no duplicate terminal events.
5. **Separation of duties:** provider classifies stream completeness and uses
   prepared schema metadata only for the terminal `{}` exception; runtime
   authorizes and performs full validation; neither layer invents arguments.
6. **Bounded continuation:** the provider emits one error and never retries
   internally. The existing agent loop's configured step budget is the only
   continuation bound; tests must prove no provider-side retry loop is added.

### Loop 2 — AUDIT — FINDINGS

The independent audit found two actionable design issues:

1. The original GREEN wording could be read as requiring the provider to
   duplicate full Zod required-field validation. The provider should not own
   that responsibility; it only needs safe JSON classification plus the narrow
   prepared-schema check for whether a terminal `{}` is permitted.
2. The original continuation wording did not explicitly prohibit a provider-side
   retry loop. Repeated malformed gateway output must remain bounded by the
   existing agent step budget, not by a new unbounded retry mechanism.

### Loop 2 — SELF-CORRECT — COMPLETE

The GREEN approach and missed-question answers were corrected to:

- use prepared JSON Schema metadata only for top-level required-key presence and
  the terminal empty-object exception;
- retain the runtime Zod schema as the value/type/semantic validation authority;
- close each incomplete input lifecycle exactly once before emitting one safe
  provider error;
- emit no internal retry and rely only on the existing configured agent-step
  continuation budget;
- add explicit tests for one error per incomplete call and bounded continuation.

### Loop 3 — AUDIT — FINDINGS

The final audit found one remaining contradiction: a syntactically complete object
with missing required keys could still have been emitted and rejected downstream.
That would preserve the live invalid-parameters failure class.

### Loop 3 — SELF-CORRECT — COMPLETE

The provider terminal classifier now requires every top-level key named by the
prepared JSON Schema's `required` array. This is intentionally only a presence
check; the runtime executor retains value, type, refinement, semantic, and
authorization validation. The zero-required-field exception remains explicit.

### Loop 4 — AUDIT — COMPLETE

The corrected design was implemented and independently reviewed. The provider
boundary is minimal and strictly typed: it checks JSON shape and declared
top-level required-key presence, while the runtime remains responsible for
value/type/semantic validation and authorization. Terminal incomplete calls fail
closed without raw argument leakage, continuation remains bounded, and stale
placeholder replacement emits a canonical argument-delta stream. No critical or
high review findings remain.

### Missed Questions

1. **Could `{}` be valid for another tool?** → Yes. Use the declared schema's
   required fields instead of a global empty-object rule.
2. **Can the provider reconstruct missing Thinker fields?** → No. Inventing
   reasoning content or counters would corrupt semantics and violate the trust
   boundary.
3. **Should malformed terminal arguments be passed to the executor for a retry?**
   → No. The executor is a validation boundary, not a stream-repair mechanism;
   forwarding known-incomplete calls creates the exact user-visible error being
   fixed.
4. **Should the provider silently drop the incomplete call?** → No. A typed
   error is required so the runtime continues or reports the failure instead of
   silently losing agent work.
5. **Should the runtime retry automatically forever?** → No. The provider emits
   one error only; reuse the existing configured agent-step budget for at most
   bounded continuation. This FID adds no provider-side retry loop.
6. **Can the provider perform complete Zod validation?** → It should not. The
   provider may inspect prepared JSON Schema only for top-level required-key
   presence and the terminal `{}` exception; value, type, refinement, semantic,
   and authorization validation remains in the existing runtime executor.
7. **What happens after a terminal provider error?** → The provider emits one
   error and no executable tool call; the runtime records the error and may take
   one subsequent configured agent step, with no new unbounded retry mechanism.
8. **Could a terminal stream contain both valid and incomplete calls?** → Yes.
   Track each call independently and emit valid calls while erroring only the
   incomplete ones.
9. **Could a malformed call later receive a delta after a parseable placeholder?**
   → Yes. Preserve the FID-008 stale-fragment replacement path until the actual
   stream boundary; classify only at terminal flush.
10. **Do raw argument diagnostics help debugging?** → Not in user-facing output.
    They can contain prompt material or sensitive data; use safe metadata and
    structured debug instrumentation only if it complies with existing logging
    policy.
11. **Does the fix require a new package?** → No. The provider already receives
    the tool definitions and can perform the narrow typed classification needed.
12. **What is the release gate?** → Focused provider/runtime tests, all required
    workspace typechecks, lint/format/diff checks, call-graph verification, and
    a fresh live CLI capture proving successful Thinker tool results.
13. **Can an error follow `tool-input-start` without leaving an orphan?** → The
    implementation must close the input lifecycle exactly once, emit no
    `tool-call`, and prove through stream-part tests that the runtime receives
    only the safe error path.

### Code Verification Evidence

- [x] FreeBuff ECHO specification read 0-EOF.
- [x] FID template read 0-EOF.
- [x] Active/archive FID IDs scanned; FID-009 is unused.
- [x] Provider terminal flush path read completely.
- [x] Runtime native tool-call path read completely.
- [x] Sequentialthinking schema read completely.
- [x] Current live behavioral evidence incorporated.
- [x] Hermes/OpenClaw local reference behavior inspected.
- [x] Independent design audit identified provider-schema duplication and retry-boundary risks.
- [x] Self-correction narrowed schema use and bounded continuation requirements.
- [x] Final audit corrected the required-key gate so incomplete objects cannot reach the executor.
- [x] Production implementation completed in `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts`.
- [x] Provider regression suite: 23 tests / 63 expectations passed.
- [x] Four workspace typechecks: llm-providers, SDK, common, and agent-runtime passed.
- [x] ESLint zero warnings, Prettier check, and `git diff --check` passed.
- [x] Call-graph search confirmed helper reachability with no stale consumers.
- [x] Fresh WSL/tmux live Thinker capture: Thinker spawned and two structured `sequentialthinking` results completed.
- [x] Unrelated prebuild limitation documented: `bun run --cwd=cli dev` still reports existing `agents/savant/savant.ts` template-literal parse errors, so the verified live run used the existing generated bundle via `bun run --cwd=cli src/index.tsx --cwd ..`.

## Resolution

- **Fixed By:** Buffy implementation under approved FID-2026-0801-009
- **Fixed Date:** 2026-08-01
- **Fix Description:** Added strict provider-side terminal classification using the declared tool schema's top-level required-key presence. Complete valid objects remain executable; unknown-schema, empty, malformed, truncated, non-object, and required-key-incomplete terminal calls close their input lifecycle and emit a safe provider error without a `tool-call`. Known zero-required-field schemas still accept `{}`. Stale placeholders are replaced before canonical deltas are emitted.
- **Tests Added:** `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.test.ts` — 23 focused tests / 63 expectations covering placeholder accumulation, valid one-shot and fragmented calls, terminal empty/whitespace/malformed/truncated/non-object inputs, required-key enforcement, zero-required tools, unknown tools, interleaving, lifecycle closure, and canonical deltas.
- **Verified By:** Independent code review found no critical/high issues; llm-providers, SDK, common, and agent-runtime typechecks passed; ESLint, Prettier, and diff checks passed; live WSL/tmux CLI capture completed two structured Thinker `sequentialthinking` calls.
- **Commit/PR:** Not created
- **Archived:** 2026-08-01

## Lessons Learned

1. Preventing premature completion is not enough; stream finalization is also a
   correctness boundary.
2. A provider must never turn an incomplete native tool call into an executable
   call merely because the stream ended.
3. Empty-object handling must be schema-aware: `{}` is invalid for required-field
   tools but valid for an explicitly zero-required-field tool.
4. The executor should validate trusted complete call candidates, not receive
   known-incomplete stream fragments as a repair mechanism.
5. Live gateway evidence must include terminal one-shot and abrupt-EOF shapes,
   not only synthetic multi-chunk accumulation cases. For this fix, the live
   capture also confirmed the normal Thinker path: two structured
   `sequentialthinking` calls completed through `opencode-go/mimo-v2.5` with no
   invalid-parameter result reported.
