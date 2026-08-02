# FID: Strict Tool-Call Format and Thinker Spawn Boundary

**Filename:** `FID-2026-0801-006-strict-tool-call-format-and-thinker-spawn.md`
**ID:** FID-2026-0801-006
**Severity:** critical
**Status:** closed
**Created:** 2026-08-01
**Author:** Buffy (FreeBuff orchestrator) + Detective analysis

---

## Summary

The manual behavioral regression test for FID-2026-0801-005 exposed a new
regression: the Thinker path worked correctly earlier in the same day, then
began emitting unsupported XML-shaped text and stopped spawning the Thinker.
The parent model emitted:

```xml
<tool_call>
<function=sequentialthinking>
...
</tool_call>
```

The runtime displayed that content as ordinary assistant text instead of
executing a tool call. Savant's supported text-tool protocol uses a canonical
JSON-in-XML envelope, `<savant_code_tool_call>...</savant_code_tool_call>`,
with `cb_tool_name` identifying the tool. Because the emitted format did not
match the runtime contract, no `sequentialthinking` call was parsed and no
Thinker was spawned. This FID owns the tool-call contract at the effective
model-prompt and stream boundary, the Thinker-spawn regression, and the
provider/model behavior needed to prevent raw tool-call markup from reaching
users.

This is separate from FID-2026-0801-005. FID-005's typed inherited-tool
filtering implementation and Nova PASS remain valid, but its live behavioral
close test is inconclusive/failed because the test never reached the Thinker.
FID-005 must not be reopened or falsely credited with resolving this format
boundary. Because the Thinker worked earlier and regressed within hours, this
FID also owns regression isolation: identify the first changed prompt,
serialization, provider/model, generated-agent, or runtime path before applying
a corrective change.

## Environment

- **OS:** Windows host (`win32`)
- **Language/Runtime:** TypeScript, Bun 1.3.x
- **Package:** `@savant-code/agent-runtime`
- **UI:** Savant-Code CLI, React/OpenTUI
- **Relevant protocol:** FreeBuff ECHO Protocol `0.1.2-freebuff`
- **Relevant runtime paths:**
  - `packages/agent-runtime/src/tools/prompts.ts`
  - `packages/agent-runtime/src/templates/strings.ts`
  - `packages/agent-runtime/src/util/stream-xml-parser.ts`
  - `packages/agent-runtime/src/tool-stream-parser.ts`
  - `packages/agent-runtime/src/util/parse-tool-calls-from-text.ts`
  - `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts`
  - `packages/agent-runtime/src/tools/handlers/tool/sequential-thinking.ts`
  - `agents/thinker/thinker.ts`
  - `common/src/tools/params/utils.ts`
  - `common/src/tools/constants.ts`
- **Related evidence:** `dev/scratchpad/fid-2026-0801-005-behavioral-test-analysis.md`
- **Related closed FID:** `dev/fids/archive/FID-2026-0801-005-thinker-agent-tool-cascade-bug.md`
- **Commit/State:** Existing working tree contains unrelated changes; this FID owns the typed stream-boundary compatibility fix and focused regression coverage

## Detailed Description

### Problem

The user-facing CLI showed raw tool-call markup rather than executing the
requested operation. The user reports that this is a new regression: the Thinker
worked normally earlier in the day, and the failure appeared only within the
last few hours. The observed sequence was:

1. A Savant response was expected to invoke `think_deeply`/Thinker.
2. The model emitted `<tool_call><function=sequentialthinking>...` as text.
3. The runtime did not recognize that envelope.
4. The raw markup was rendered into the transcript.
5. No `think_deeply`, `spawn_agents`, or Thinker run occurred.
6. The manual FID-005 closeout test could not verify `sequentialthinking`, tool
   filtering, or absence of an unauthorized-tool cascade.

The failure is at the model-facing tool-call contract boundary, but the
regression's introducing change is not yet identified. The exact remediation
must be evidence-driven: first compare the last known-good prompt, model/provider
configuration, generated agent definition, raw stream chunk types, and current
working-tree/runtime state; then enforce the canonical format or add a narrowly
scoped compatibility normalization only if the supported model path genuinely
requires it. A broad parser that accepts arbitrary XML is not acceptable.

### Expected Behavior

- The effective prompt shown to every text-protocol agent explicitly defines the
  canonical Savant tool-call envelope and its JSON field contract.
- An inherited Thinker prompt retains the parent cacheable prefix but adds a
  child-specific, authoritative tool-format section.
- The Thinker receives only its allowed `sequentialthinking` tool, as already
  enforced by FID-005's `filterToolSet` boundaries.
- A valid canonical tool call is intercepted by the stream parser, removed from
  visible assistant text, and executed exactly once.
- `sequentialthinking` executes through its existing handler and returns a tool
  result to the Thinker loop.
- `think_deeply`/agent spawning executes through the normal parent tool path;
  the tool call must not leak into the transcript as raw markup.
- Unsupported `<tool_call><function=...>` markup is never presented as a
  successful tool invocation. It must either be prevented by the effective
  prompt or handled by an explicitly tested, strict compatibility boundary.
- Unauthorized tools remain rejected by executor authorization; parser
  normalization must never broaden a child's `toolNames` permissions.
- The manual behavioral test can observe: Thinker spawned, canonical
  `sequentialthinking` executed, no repeated unavailable-tool errors, and a
  final PASS closeout.

## Root Cause Analysis

### Verified runtime contract

The repository already has a canonical text-tool format:

- `common/src/tools/params/utils.ts` builds tool-call strings using
  `startToolTag`, `endToolTag`, and `cb_tool_name`.
- `packages/agent-runtime/src/util/stream-xml-parser.ts` extracts only the
  configured `<savant_code_tool_call>` envelope and parses JSON content.
- `packages/agent-runtime/src/tool-stream-parser.ts` executes extracted XML
  calls through `executeXmlToolCall` and also handles native AI SDK tool-call
  chunks.
- `packages/agent-runtime/src/util/parse-tool-calls-from-text.ts` also parses
  the canonical JSON-in-XML format for text/programmatic paths.

The unsupported `<tool_call><function=...>` format does not match the canonical
start/end tags or JSON payload. Before this FID, the runtime therefore allowed
that protocol-shaped content to remain visible as ordinary text. The canonical
parser itself was not broadened; the fix adds a separate, strictly typed
compatibility filter that discards complete, split, and unterminated legacy
blocks without parsing or executing them. Canonical calls continue through the
existing parser and executor boundary.

### Prompt/inheritance risk

`packages/agent-runtime/src/tools/prompts.ts` documents the canonical format in
`getToolsInstructions` and `getShortToolInstructions`. However, the Thinker has
`inheritParentSystemPrompt: true`, and `packages/agent-runtime/src/templates/strings.ts`
currently adds a child capability/allowlist addendum without necessarily
repeating the complete canonical tool-call format. The effective prompt path
must be captured and verified; a source-level prompt helper existing somewhere
is not enough.

The FID must determine whether:

1. the parent prompt already contains the canonical format but the provider
   emits a different native-looking textual format;
2. the inherited Thinker path omits or weakens the canonical instructions; or
3. the stream is using a native AI SDK tool-call channel that is being
   serialized into text before the parser receives it.

These cases have different fixes and must not be conflated.

## Evidence

### Manual behavioral evidence

From `dev/scratchpad/fid-2026-0801-005-behavioral-test-analysis.md`:

```text
The user observed raw XML output:
<tool_call>
<function=sequentialthinking>
<parameter=thought>...</parameter>
<parameter=thoughtNumber>1</parameter>
<parameter=totalThoughts>5</parameter>
<parameter=nextThoughtNeeded>True</parameter>
</tool_call>

The markup was displayed as text. No Thinker was spawned and no
sequentialthinking result was captured.
```

The report's original claim that Thinker spawned was corrected during review:
the visible raw XML was the parent model's ordinary response, not evidence of a
Thinker child run. The only established behavioral facts are that unsupported
markup was emitted and that no unauthorized-tool cascade was observed. The
permission-boundary test remains unexercised until this FID is fixed.

### Canonical format evidence

The runtime-generated format is represented by `getToolCallString` and the
stream parser's `toolXmlName`/`toolNameParam` constants. The implementation must
use those existing sources of truth rather than duplicate literal tags or
invent a second serialization format.

### FID-005 separation evidence

FID-005's implementation and Nova audit verified:

- `filterToolSet` is strictly typed;
- final model, ordinary spawn, and inline spawn handoffs are filtered;
- the Thinker declaration remains `toolNames: ['sequentialthinking']`;
- executor authorization remains strict;
- focused tests and four workspace typechecks passed.

None of those checks prove that a provider's textual output is parsed into a
Thinker invocation. This FID supplies that missing model-to-runtime boundary.

## Impact Assessment

### Affected Components

- Parent-to-agent tool invocation, especially `think_deeply` and `spawn_agents`
- Thinker `sequentialthinking` execution and structured output
- Any text-protocol agent using inherited prompts
- Stream parser and visible transcript filtering
- Manual behavioral closeout for FID-005
- Token usage, because raw tool markup can consume additional model turns
- User trust, because internal protocol markup is exposed in the CLI

### Risk Level

- [x] Critical: release-blocking agent orchestration failure and raw protocol leakage
- [ ] High: major feature broken with no workaround
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor issue, cosmetic, or edge case

## Proposed Solution

### Approach — GREEN Proposal

0. **Isolate the regression first.** Reproduce both a last-known-good and
   failing run using the same user prompt, terminal/client, provider, model,
   agent definition, and environment where possible. Capture the effective
   parent and inherited Thinker prompts, current working-tree diff, generated
   agent bundle/version, raw stream chunk types, and parser events. Compare
   these artifacts to identify the first changed boundary. If no source delta
   explains the regression, record provider/model or environment evidence
   instead; do not claim a code fix without identifying the failing boundary.
1. **Establish one canonical contract.** Reuse the existing constants and
   `getToolCallString` output. Do not create a second tag name, parameter name,
   or JSON shape.
2. **Capture the effective prompt.** Add a focused test seam or deterministic
   prompt assertion for the exact instructions delivered to an inherited
   Thinker. Verify it contains the canonical envelope, `cb_tool_name`, JSON
   arguments, and an explicit prohibition on `<tool_call><function=...>`.
3. **Strengthen the child prompt boundary.** If the effective inherited prompt
   lacks the canonical instructions, add a narrowly scoped capability/tool-format
   addendum in `getAgentPrompt` or the existing tool-instruction helper. Preserve
   prompt caching and do not duplicate the entire parent prompt unnecessarily.
4. **Preserve strict execution.** Keep `filterToolSet` and executor
   authorization unchanged. Parsing a tool name must never grant permission; the
   child `toolNames` allowlist remains authoritative.
5. **Test the canonical stream path.** Add parser/stream tests that feed the
   exact canonical format in chunks, including partial tag boundaries, multiple
   calls, malformed JSON, and text before/after. Assert the tool executes once
   and the markup is absent from visible text.
6. **Test the unsupported format explicitly.** Confirm unsupported
   `<tool_call><function=...>` text is not silently treated as a successful
   tool call. If product policy requires compatibility with a specific provider,
   introduce a strict, provider-scoped normalizer only after documenting its
   grammar, permission checks, malformed-input behavior, and visible-text
   handling in this FID.
7. **Run the live behavioral closeout.** Manually load Savant-Code and use a
   prompt that forces the parent to invoke `think_deeply`, then verify the
   Thinker child actually starts, `sequentialthinking` executes, no raw XML is
   rendered, and no unavailable-tool cascade appears.

### Scope Boundary

#### In scope

- Effective tool-call instructions for inherited and non-inherited agents
- Canonical tool-call format documentation/injection
- Strict stream/parser regression tests
- Thinker/`sequentialthinking` end-to-end test coverage
- Visible raw-protocol leakage prevention
- Provider/model evidence needed to choose prompt enforcement versus a strict
  compatibility adapter

#### Out of scope unless evidence proves necessary

- Changing FID-005's `filterToolSet` implementation or Thinker allowlist
- Broadly accepting arbitrary XML or arbitrary `<function=...>` calls
- Weakening executor authorization or bypassing `toolNames`
- Rewriting the AI SDK native tool-call transport
- Replacing the Markdown/chat renderer
- Changing reasoning visibility or hiding thinking blocks
- Adding a third-party XML package without a demonstrated parser gap,
  Bun/Windows compatibility review, and explicit approval
- Unrelated model/provider routing changes

### Five Questions

1. **Will this work for all cases, not only Thinker?**
   - The canonical contract applies to every text-protocol tool caller, while
     the regression fixture specifically exercises inherited Thinker behavior.
     Native AI SDK tool calls remain a separate supported channel and are tested
     without being converted into text.
2. **Will it scale to 1000 agents?**
   - Yes, if format enforcement is a shared prompt/parser contract and parser
     state remains per stream/run. No per-agent special-case parser should be
     introduced.
3. **Will it survive a hostile attacker?**
   - Tool text is never authorization. Parsed names must still pass the existing
     executor and child allowlist checks; malformed or unauthorized calls must
     fail closed and not execute.
4. **Will it be maintainable in two years?**
   - One canonical tag/field source, one shared instruction helper, explicit
     parser tests, and provider-specific compatibility only behind a documented
     adapter prevent format drift.
5. **Does it set an industry-quality standard?**
   - Yes: model-visible capabilities, serialization, parser behavior, visible
     transcript filtering, and executor authorization are tested as one contract
     with explicit separation of concerns.

## Perfection Loop

### Loop 1 — RED — COMPLETE

- Read the FreeBuff ECHO Protocol from 0-end before drafting this FID.
- Read the canonical FID template and existing 2026-08-01 FID inventory.
- Confirmed `FID-2026-0801-006` was unused.
- Recorded the observed unsupported `<tool_call><function=...>` output.
- Corrected the behavioral report's mistaken interpretation: no Thinker was
  spawned; the parent response leaked raw markup as ordinary text.
- Traced the canonical runtime format through `getToolCallString`,
  `stream-xml-parser`, `tool-stream-parser`, and the text parser.
- Separated this format boundary from FID-005's already verified inherited-tool
  filtering implementation.
- Identified the unresolved design question: effective inherited prompt content
  versus provider serialization/native channel behavior.
- Incorporated the user's regression timing: Thinker behavior was correct earlier
  in the day and changed within hours. An initial history scan found no recent
  committed change in the inspected paths; that is not proof that no introducing
  change exists. The current working-tree delta, generated artifacts, and
  provider/model configuration are mandatory first-class RED evidence.
- Added a last-known-good/failing-run comparison as the first implementation
  gate; no prompt or parser change may be selected before that comparison.

### Loop 1 — GREEN — COMPLETE

- Preserved the canonical `<savant_code_tool_call>` JSON envelope and existing
  executor authorization; no arbitrary XML execution was added.
- Added a strictly typed `LegacyToolCallFilterState` and
  `filterLegacyToolCallText` for unsupported legacy blocks.
- Applied the filter only to non-executable reasoning chunks; canonical text
  tool calls remain handled by `parseStreamChunk` and `executeXmlToolCall`.
- Preserved stream ordering by flushing pending text before reasoning chunks and
  preserved empty reasoning chunk semantics.
- Kept the filter fail-closed for chunk boundaries and unterminated blocks.
- Hardened the agent prebuild path to preserve the existing bundle on failures,
  publish atomically, and refresh the WSL-aware tmux helper deterministically.

### Loop 1 — AUDIT — COMPLETE

Independent review found no critical/high issue. The audit confirmed:

1. Legacy markup is discarded and never executed in both text and reasoning
   coverage.
2. `<think>` content remains visible, while canonical calls still execute once
   and disappear from visible text.
3. Reasoning/text ordering and empty-chunk behavior remain compatible with the
   existing message-history semantics.
4. The filter is separate from authorization and does not broaden `toolNames`.
5. Focused tests exercise complete, split, interleaved, and unterminated cases,
   including the `reasoning_delta` callback path.
6. Prebuild, bundle, shell, typecheck, lint, format, and diff gates pass.

The provider-specific live Thinker reproduction remains a separate evidence
limitation: deterministic runtime tests prove the repaired boundary, but this
FID does not claim a fresh external-provider child run after the final parser
edit.

### Loop 1 — SELF-CORRECT — COMPLETE

The implementation audit caught and corrected a real ordering regression: the
first reasoning-filter wiring returned before flushing buffered text, which
merged reasoning sections separated by prose. The final implementation flushes
text before yielding filtered reasoning and preserves empty chunks. The tests
were also corrected to assert the outer `reasoning_delta` callback at the
`processStream` boundary rather than attributing it to the lower-level parser.
The FID retains the original evidence correction: raw XML is not evidence that
a Thinker child ran.

### Change Delta

- Added the typed legacy compatibility filter and reasoning-stream wiring.
- Added focused parser, tool-stream, and process-stream reasoning regression
  coverage.
- Hardened the agent prebuild publication/error boundary and retained the WSL
  tmux input-settle fix already required by the behavioral harness.
- No authorization broadening, prompt-cache redesign, third-party package, or
  Markdown/UI change was introduced by this FID.

### Missed Questions

1. **Did the Thinker actually spawn?** → No. Raw `<tool_call>` text is not a
   child-start event. The close test must identify the child run through runtime
   events or a structured result.
2. **Is `structuredOutput: null` proof of parser failure?** → It is evidence that
   no structured tool result reached the caller, but the exact cause must be
   distinguished between unsupported text format, missing effective prompt
   instructions, and provider/native transport serialization.
3. **Does the runtime already have a valid parser?** → Yes, for the canonical
   `<savant_code_tool_call>` JSON envelope. Its existence does not prove the
   affected model emitted that envelope.
4. **Should arbitrary `<tool_call>` markup be accepted?** → No. Only a fully
   specified, provider-scoped compatibility grammar may be considered, and it
   must normalize into the canonical call before authorization.
5. **Could a prompt change break prompt caching?** → It could if the entire
   inherited system prompt is rebuilt. Add a small child-specific suffix and
   test cache-prefix stability.
6. **Could canonical prompt instructions be omitted for inherited Thinker?** →
   Yes. Capture the effective prompt, not just the source helper definition.
7. **Could the provider be sending native tool-call chunks that are converted
   to text?** → Yes. Instrument/test the raw stream chunk types before changing
   the text parser.
8. **What must never be visible to users?** → Recognized tool-call envelopes,
   malformed internal protocol markup, tool arguments containing sensitive data,
   and executor-only error details.
9. **Does this reopen FID-005?** → No. FID-005's code scope and Nova audit remain
   valid; only its live behavioral evidence is incomplete until this boundary is
   corrected.
10. **What changed within the last few hours?** → The user establishes a
    behavioral regression, but source history alone does not identify the cause.
    Compare the last known-good and failing effective prompts, raw stream types,
    provider/model settings, generated bundles, and working-tree delta before
    changing code.
11. **How do we prevent regression across models?** → Test canonical text calls,
    native AI SDK calls, malformed calls, inherited prompts, and at least one
    provider/model combination that previously emitted the unsupported envelope.
12. **What happens if parsing fails mid-stream?** → Preserve safe text behavior,
    avoid partial execution, flush state deterministically, and surface a
    user-safe diagnostic without exposing raw protocol content.
13. **What is the rollback boundary?** → Revert only the identified introducing
    prompt/serialization/provider/runtime boundary and its tests; do not alter
    agent permissions, reasoning storage, or chat visual rendering.
14. **What if no local change explains the regression?** → Preserve the exact
    failing evidence, classify it as provider/model or environment-specific,
    and require an explicit compatibility design rather than guessing or
    silently changing the canonical parser.

### Code Verification Evidence

- [x] FreeBuff ECHO specification read from 0-end.
- [x] User regression report recorded: Thinker worked earlier and failed within
      the last few hours; this is treated as a new regression, not a baseline
      Thinker limitation.
- [x] FID template read completely and ID uniqueness confirmed.
- [x] Canonical tool-call helper, parser, stream, Thinker, and executor paths
      inspected.
- [x] FID-005 implementation and behavioral report scope separated.
- [x] Strict legacy filtering covers complete, split, interleaved, and
      unterminated text blocks.
- [x] Reasoning filtering preserves `<think>`, ordering, empty chunks, and the
      `reasoning_delta` callback path.
- [x] Canonical text tool calls still execute and disappear from visible text.
- [x] Focused runtime tests: 35 passed / 0 failed / 76 expectations.
- [x] Agent-runtime, SDK, common, and CLI typechecks passed.
- [x] Normal agent prebuild passed; generated bundle contains 37 agents and the
      repaired WSL/tmux markers.
- [x] Shell syntax, zero-warning focused ESLint, Prettier, and diff checks passed.
- [x] Independent implementation review: no critical/high findings; READY.
- [ ] Fresh external-provider Thinker child capture after the final parser edit.
      This remains a documented evidence limitation and is not falsely claimed
      as passed.

## Resolution

- **Fixed By:** Buffy
- **Fixed Date:** 2026-08-01
- **Fix Description:** Added a strictly typed, fail-closed filter for unsupported
  legacy `<tool_call>...</tool_call>` markup in text and reasoning streams while
  preserving canonical tool execution, `<think>` visibility, stream ordering,
  empty-chunk semantics, and executor authorization. Also finalized the durable
  prebuild/bundle path used by the WSL behavioral harness.
- **Tests Added:** Parser, tool-stream, and process-stream reasoning regression
  coverage; 35 focused tests passed with 0 failures.
- **Verified By:** Four workspace typechecks, normal prebuild and 37-agent bundle
  validation, shell syntax, zero-warning ESLint, Prettier, `git diff --check`,
  and independent implementation review.
- **Commit/PR:** Not created
- **Archived:** 2026-08-01 to `dev/fids/archive/FID-2026-0801-006-strict-tool-call-format-and-thinker-spawn.md`

## Lessons Learned

1. Raw tool-shaped text is not evidence that a tool executed or an agent spawned.
2. Model-visible format instructions, stream transport, parser grammar, and
   executor authorization are separate boundaries and need separate evidence.
3. A strict canonical format is safer than accepting arbitrary model-generated
   XML, but provider compatibility must be evidence-driven rather than assumed.
4. Inherited prompt caching requires a small authoritative child addendum, not a
   duplicate parent prompt.
5. FID-005's permission-boundary implementation can be correct while its live
   behavior test remains blocked upstream by tool-call serialization.
