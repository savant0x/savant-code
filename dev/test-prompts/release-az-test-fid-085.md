# Release A-Z Test — FID-085 Context Compaction System + message.content.map Regression Fix

**Version:** v0.0.8
**Purpose:** Regression and feature verification for the progressive context compaction system (FID-085) and the follow-up `message.content.map is not a function` runtime bug fix before release.

**Ground Rules:**
- Run from agent context (idle phase unless noted)
- Do not require user interaction
- Report pass/fail and any friction for every test
- Write the final report to `dev/scratchpad/release-az-test-fid-085-report.md`

**Available Tools:** read_files, glob, list_directory, spawn_agents, write_todos, basher, code_searcher

---

## Tier 1: Build & Type Safety

### T1.1 — Common workspace typecheck
- Run `cd common && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.2 — Agent-runtime workspace typecheck
- Run `cd packages/agent-runtime && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.3 — SDK workspace typecheck
- Run `cd sdk && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.4 — CLI workspace typecheck
- Run `cd cli && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.5 — Changed-file lint
- Run ESLint with `--max-warnings 0` on the changed files:
  - `packages/agent-runtime/src/context-compactor.ts`
  - `packages/agent-runtime/src/run-agent-step.ts`
  - `packages/agent-runtime/src/tools/tool-executor.ts`
  - `packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts`
  - `common/src/types/session-state.ts`
  - `common/src/constants/agents.ts`
  - `common/src/util/messages.ts`
  - `common/src/util/__tests__/messages.test.ts`
  - `cli/src/utils/openrouter-models.ts`
  - `cli/src/utils/create-run-config.ts`
  - `cli/src/hooks/use-send-message.ts`
  - `agents/savant/savant.ts`
- **Expected:** zero warnings, zero errors

### T1.6 — Messages unit tests
- Run `bun test common/src/util/__tests__/messages.test.ts`
- **Expected:** all tests pass

---

## Tier 2: Context Compactor Components

### T2.1 — ContextCompactor class exists
- Read `packages/agent-runtime/src/context-compactor.ts`
- Verify it exports a `ContextCompactor` class
- Verify it exposes `microCompact`, `shouldAutoCompact`, `autoCompact`, and `reactiveCompact` methods
- **Expected:** class is well-structured and matches the four-layer architecture

### T2.2 — Compaction thresholds are reasonable
- Read the `ContextCompactor` constructor and `getThresholds()`
- Verify micro-compact keeps the 3 most recent tool results by default
- Verify auto-compact threshold is `contextWindow - 30_000` tokens
- **Expected:** defaults match the FID design

### T2.3 — Compaction message type allows string content
- Inspect the `CompactionMessage` interface
- Verify `content` allows `string | Array<{ type: string; text?: string; [key: string]: unknown }>`
- **Expected:** type is permissive enough to represent compacted placeholders

### T2.4 — Placeholder shape after micro-compact
- Read the `microCompact` implementation
- Verify stale tool results are replaced with `content: [{ type: 'json', value: '[compacted]' }]`
- **Expected:** no bare string content is emitted by the current code

### T2.5 — ContextCompactor instantiation in the runtime
- Read `packages/agent-runtime/src/run-agent-step.ts`
- Find where `new ContextCompactor(...)` is created
- Verify it is constructed with sensible thresholds (`maxContextLength`, `buffer`, `microCompactMaxKeepRecent`)
- **Expected:** compactor is wired into the agent loop with correct defaults

---

## Tier 3: Layer 2 — Micro-Compact

### T3.1 — Micro-compact clears stale read results
- Read `packages/agent-runtime/src/run-agent-step.ts`
- Find where `contextCompactor.microCompact(...)` is called
- Verify it runs before every API call in `loopAgentSteps`
- **Expected:** stale read_files / code_search / glob results older than the 3 most recent are cleared

### T3.2 — Micro-compact preserves recent tool results
- Verify the logic keeps the `microCompactMaxKeepRecent` most recent tool results
- **Expected:** recent results remain available to the model

### T3.3 — Micro-compact reports tokens saved
- Verify `microResult.tokensSaved` is logged or reported
- **Expected:** user-facing message shows approximate tokens saved

---

## Tier 4: Layer 3 — Auto-Compact

### T4.1 — Auto-compact threshold check
- Read `packages/agent-runtime/src/context-compactor.ts`
- Verify `shouldAutoCompact` compares current token count to threshold
- **Expected:** returns true when context exceeds `contextWindow - buffer`

### T4.2 — Auto-compact circuit breaker
- Verify the auto-compact circuit breaker: max 3 failures, 5-minute cooldown
- **Expected:** repeated failures do not spam the API

### T4.3 — Auto-compact integration in run-agent-step
- Read `packages/agent-runtime/src/run-agent-step.ts`
- Find the Layer 3 integration after each step completes
- Verify it checks `contextCompactor.shouldAutoCompact(...)`
- **Expected:** auto-compact is triggered at the right boundary

### T4.4 — maxContextLength in AgentState
- Read `common/src/types/session-state.ts`
- Verify `AgentState` has a `maxContextLength` field (or equivalent)
- **Expected:** field is present and used by the runtime

### T4.5 — Savant reads maxContextLength
- Read `agents/savant/savant.ts`
- Verify `handleSteps` reads `agentState.maxContextLength`
- **Expected:** agent is aware of its context budget

---

## Tier 5: Layer 4 — Reactive Compact

### T5.1 — Reactive compact triggers on prompt-too-long
- Read `packages/agent-runtime/src/run-agent-step.ts`
- Find the `reactiveCompact` call
- Verify it triggers on an API `prompt-too-long` / content-length error
- **Expected:** emergency truncation runs before giving up

### T5.2 — Reactive compact preserves head and tail
- Read the `reactiveCompact` implementation in `context-compactor.ts`
- Verify it preserves the first message and the last 20% of messages
- **Expected:** critical system prompt and recent context are retained

### T5.3 — Reactive compact retries the API call
- Verify the code retries the API call once after reactive compaction
- **Expected:** one retry, then failure if it still does not fit

---

## Tier 6: Message Conversion Regression (`message.content.map`)

### T6.1 — Tool result with string content is coerced
- Run `bun test common/src/util/__tests__/messages.test.ts`
- Verify a tool message whose `content` is the bare string `[compacted]` is converted into a valid `tool-result` with `{ type: 'json', value: '[compacted]' }`
- **Expected:** no `message.content.map is not a function` crash; output passes `modelMessageSchema`

### T6.2 — System message with string content is coerced
- Verify a system message whose `content` is a plain string is converted to a single string `content`
- **Expected:** no `.map()` crash

### T6.3 — User message with string content is coerced
- Read `common/src/util/__tests__/messages.test.ts`
- Find the user string-content test and run it via `bun test common/src/util/__tests__/messages.test.ts`
- **Expected:** a user message whose `content` is a plain string is wrapped into a `TextPart[]` with no `.map()` crash

### T6.4 — Assistant message with string content is coerced
- Read `common/src/util/__tests__/messages.test.ts`
- Find the assistant string-content test and run it via `bun test common/src/util/__tests__/messages.test.ts`
- **Expected:** a raw assistant message whose `content` is a plain string is wrapped into a `TextPart[]` with no `.map()` crash

### T6.5 — Invalid/null content falls back safely
- Verify invalid `content` (e.g., `null` or `undefined`) falls back to an empty string for system messages and an empty array for user messages
- **Expected:** no `.map()` crash

### T6.6 — End-to-end compacted tool result
- Run a small script that imports `convertCbToModelMessages` and `jsonToolResult` from the `@savant-code/common` package:
  ```ts
  import { convertCbToModelMessages, jsonToolResult } from '@savant-code/common/util/messages'
  const messages = [{
    role: 'tool' as const,
    toolName: 'read_files',
    toolCallId: 'call_compact',
    content: jsonToolResult('[compacted]'),
  }]
  const result = convertCbToModelMessages({ messages, includeCacheControl: false })
  process.exit(result.length > 0 && result[0].role === 'tool' ? 0 : 1)
  ```
- **Expected:** script exits 0, compacted tool results flow through conversion and reach the LLM safely

### T6.7 — Defensive normalization does not mutate original messages
- Pass a clone of a message array through `convertCbToModelMessages`
- Verify the original array is unchanged
- **Expected:** original messages are preserved

---

## Tier 7: FSM & Tool Permission Bug Fixes

### T7.1 — FSM phase ordering (BUG-004)
- Read `packages/agent-runtime/src/tools/tool-executor.ts`
- Search for `phase` ordering checks and `VALID_TRANSITIONS`
- Verify `idle → red`, `red → green`, `green → audit`, and `audit → complete` transitions are allowed
- **Expected:** no deadlock between idle → red → green → audit

### T7.2 — run_readonly_command denylist (BUG-003)
- Read `packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts`
- Search for `denylist` or `denyList` and `allowlist` or `allowList`
- Verify the implementation uses a denylist (e.g., rejecting known write commands) rather than an allowlist
- Search for `findstr` or `2>nul` in test files to confirm they work on Windows
- **Expected:** more flexible read-only command execution

### T7.3 — Agent ID in errors (BUG-001)
- Search `packages/agent-runtime/src/tools/tool-executor.ts` for `agentId` or `agent.id` in thrown error strings
- **Expected:** errors include the agent ID for easier debugging

### T7.4 — devMode warning (BUG-006)
- Search `packages/agent-runtime/src/tools/tool-executor.ts` for `devMode` and `warn`
- Verify a warning is emitted when running in dev mode with tool errors
- **Expected:** warning is present and helpful

### T7.5 — ECHO_PROTOCOL_INSTRUCTIONS updated (BUG-005)
- Read `common/src/constants/agents.ts`
- Search for `ECHO_PROTOCOL_INSTRUCTIONS`
- Verify the instructions mention the corrected FSM phase gating table
- **Expected:** instructions reflect the latest protocol

---

## Tier 8: Context Window Resolution

### T8.1 — OpenRouter model context lengths (CTX-010)
- Read `cli/src/utils/openrouter-models.ts`
- Verify `inferContextLength` returns correct values for Grok (1M), GPT (256k), GLM (1M), MiniMax (256k)
- **Expected:** no incorrect fallback to 128k

### T8.2 — create-run-config passes contextWindow (CTX-007)
- Read `cli/src/utils/create-run-config.ts`
- Verify it passes `contextWindow` through
- **Expected:** context window flows to run config

### T8.3 — use-send-message resolves context window (CTX-007)
- Read `cli/src/hooks/use-send-message.ts`
- Verify `resolveContextWindowForModel` is wired through
- **Expected:** selected model's context window is resolved

---

## Tier 9: Documentation

### T9.1 — FID status
- Read `dev/fids/archive/FID-2026-0725-085-context-compaction-system.md`
- Verify status is closed/archived and resolution fields are filled
- **Expected:** ground-truth verification section complete

### T9.2 — CHANGELOG entry
- Read `CHANGELOG.md`
- Verify a v0.0.8 entry exists for FID-085
- **Expected:** entry matches the implementation

---

## Tier 10: CLI Smoke (if tmux available)

### T10.1 — CLI launches
- If possible, launch the CLI with `bun run src/index.tsx --cwd ..` from `cli/`
- Verify it starts without crashing
- **Expected:** prompt appears

### T10.2 — Compacted tool results do not crash conversion
- Use the same snippet as T6.6 or run `bun test common/src/util/__tests__/messages.test.ts`
- Verify no `message.content.map is not a function` error is thrown and the output array is non-empty
- **Expected:** agent continues past compaction points without the `message.content.map` crash

---

## Report Format

After all tiers, write `dev/scratchpad/release-az-test-fid-085-report.md` with:

1. **Executive Summary** — 3-5 sentences on release readiness
2. **Tier-by-Tier Results** — For each test: Status, Notes, Friction Level (none/low/medium/high)
3. **Blockers** — Any test that must be fixed before release
4. **Pre-existing Issues** — Any failures not caused by this feature
5. **Release Recommendation** — Go / No-Go with justification

---

## Summary

| Tier | Name | Tests | Purpose |
|------|------|-------|---------|
| 1 | Build & Type Safety | 6 | Does the code compile and pass tests? |
| 2 | Context Compactor Components | 5 | Are the compactor classes present and typed correctly? |
| 3 | Layer 2 — Micro-Compact | 3 | Does per-turn stale-result clearing work? |
| 4 | Layer 3 — Auto-Compact | 5 | Does threshold-based summarization work? |
| 5 | Layer 4 — Reactive Compact | 3 | Does emergency truncation work? |
| 6 | Message Conversion Regression | 7 | Is the `message.content.map` crash fixed? |
| 7 | FSM & Tool Permission Fixes | 5 | Are the 12 related bug fixes present? |
| 8 | Context Window Resolution | 3 | Does the selected model's context window flow through? |
| 9 | Documentation | 2 | Is the FID/CHANGELOG complete? |
| 10 | CLI Smoke | 2 | Does the feature hold up in the real CLI? |
| **Total** | | **41** | |
