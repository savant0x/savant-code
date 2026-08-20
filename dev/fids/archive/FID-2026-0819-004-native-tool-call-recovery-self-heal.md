# FID: Native tool-call recovery hardening — tool-specific steering + progressive strikes

**Filename:** `FID-2026-0819-004-native-tool-call-recovery-self-heal.md`
**ID:** FID-2026-0819-004
**Severity:** critical
**Status:** created
**Created:** 2026-08-19

---

## Summary

The native tool-call recovery mechanism (FID-2026-0816-012) hard-kills agent runs after 3
consecutive `native-incomplete` strikes. The steering message is tool-agnostic ("split into
smaller calls"), but models re-emitting the same oversized payload don't learn from generic
guidance. For `run_terminal_command` specifically, the natural fix is "run ONE command per
call" — not "split the command" — and the strike cap of 3 is too low for flash-class models
that struggle with large JSON payloads.

## Environment

- **OS:** win32
- **Language/Runtime:** TypeScript / Bun
- **Commit/State:** working tree (post-FID-003)

## Detailed Description

### Problem

When the model emits `run_terminal_command` with a long command string (e.g., `prettier
--write file1 file2 ... file9`), the native tool-call parser truncates the JSON arguments
mid-stream. The flush-handler marks it `native-incomplete`. The recovery mechanism sends a
generic steering message. The model re-emits the same oversized call. After 3 strikes,
`loop-iteration.ts:380` throws `buildNativeToolCallExhaustedMessage` and the run aborts.
The command never executed.

### Expected Behavior

The recovery mechanism should:
1. Provide tool-specific steering (not generic "split into smaller calls")
2. Give the model enough retries to learn (5 for terminal commands, not 3)
3. Escalate guidance progressively (strike 1: hint, strike 2: explicit, strike 3+: example)
4. Log payload sizes so we can observe what triggers truncation

### Root Cause

Three compounding issues:
1. **Generic steering:** "Split into smaller calls" doesn't help `run_terminal_command` — the
   model needs "Run ONE command per call."
2. **Insufficient retries:** 3 strikes is too few for flash-class models that struggle with
   large JSON payloads. The model often needs 4-5 attempts to learn the pattern.
3. **No progressive escalation:** Each retry sends the same message. The model doesn't get
   increasingly specific guidance.

### Evidence

```text
Error: Native tool-call recovery failed repeatedly; ending the agent run without
executing the incomplete tool call. (tool: run_terminal_command) Re-spawn with the
work split into smaller steps...
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run-agent-step/constants.ts` — steering messages + strike cap
- `packages/agent-runtime/src/tools/stream-parser.ts` — steering message selection
- `packages/agent-runtime/src/run-agent-step/loop-iteration.ts` — strike counting

### Risk Level

- [x] High: Major feature broken, no workaround (agent runs hard-killed)

## Proposed Solution

### Approach

Multi-layered defense with tool-specific steering and progressive escalation.

### Steps

1. **Tool-specific steering messages** — Replace the single generic `NATIVE_TOOL_CALL_STEERING_MESSAGE`
   with a map of tool-name → steering message. `run_terminal_command` gets "Run ONE command
   per call"; write tools get "Write in chunks using str_replace"; `read_files` gets "Read
   fewer files at once."

2. **Progressive escalation** — On strike 1, send a hint. On strike 2, send explicit guidance.
   On strike 3+, send a concrete example. This gives the model increasingly specific instructions.

3. **Increase strike cap for terminal commands** — Raise `NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES`
   from 3 to 5 for `run_terminal_command` specifically. Other tools stay at 3.

4. **Log payload observation** — When a `native-incomplete` error fires, log the tool name and
   the accumulated argument length so we can observe truncation patterns.

### Verification

1. Typecheck passes
2. Existing `loop-agent-steps-part-f.test.ts` tests pass (they mock the recovery flow)
3. Manual test: agent runs `prettier --write` on 9 files without hard-killing
4. Manual test: agent runs `eslint --fix` on 4 files without hard-killing

## Perfection Loop

### Loop 1 — RED

- **RED:** 3 issues catalogued: generic steering, insufficient retries, no progressive escalation
- **GREEN:** Tool-specific steering messages via `NATIVE_TOOL_CALL_STEERING_MESSAGES` map + `getSteeringMessage(toolName, strikeNumber)`. Progressive escalation (hint → explicit → example). Strike cap increased to 5 for `run_terminal_command`. Escalating steering appended on retries 2-4 in `loop-iteration.ts`.
- **AUDIT:** 1112 tests pass (0 fail), typecheck clean, `validate:repository` PASS. Two new tests added: 5-strike terminal cap + 3-strike non-terminal cap.

### Missed Questions

1. **Should the strike cap be configurable per-tool in the agent template?** → No — the current hardcoded map is simpler and covers the known failure modes. Configurable caps add complexity without clear benefit today.
2. **What if the model splits the command but the sub-commands also truncate?** → The progressive escalation guides the model toward ONE command per call, which is small enough to avoid truncation. If a single command still truncates, the model has 5 strikes to learn.
3. **Does the escalating steering in loop-iteration.ts interfere with the Thinker convergence gate?** → No — the Thinker uses `sequentialthinking`, not `run_terminal_command`, so the terminal-specific logic doesn't apply. The generic fallback for unknown tools keeps the existing 3-strike behavior.

### Code Verification Evidence

- **constants.ts:** `NATIVE_TOOL_CALL_STEERING_MESSAGES` map (5 tools × 3 levels), `getSteeringMessage()`, `NATIVE_TOOL_CALL_TERMINAL_RECOVERY_MAX_STRIKES = 5`
- **stream-parser.ts:** imports `getSteeringMessage` (line 16), uses `getSteeringMessage(chunk.toolName, 1)` (line 411)
- **loop-iteration.ts:** imports `getSteeringMessage` + `NATIVE_TOOL_CALL_TERMINAL_RECOVERY_MAX_STRIKES` (lines 8-11), terminal-specific cap (line 320), escalating steering on retries 2+ (lines 325-340)
- **loop-agent-steps-part-f.test.ts:** 10 tests pass — existing tests updated for tool-specific messages, 2 new tests added (5-strike terminal, 3-strike non-terminal)
- **agent-runtime tests:** 1112 pass, 0 fail
- **typecheck:** clean
- **validate:repository:** PASS

## Resolution

- **Closed Date:** 2026-08-19
- **Fix Description:** Tool-specific steering messages via `NATIVE_TOOL_CALL_STEERING_MESSAGES` map with progressive escalation (hint → explicit → example). `run_terminal_command` gets 5 strikes (up from 3). Escalating steering appended on retries 2-4 in `loop-iteration.ts`.
- **Tests Added:** 2 new tests in `loop-agent-steps-part-f.test.ts` (5-strike terminal cap, 3-strike non-terminal cap). 2 existing tests updated for tool-specific messages.
- **Verification Evidence:** 1112 tests pass, typecheck clean, `validate:repository` PASS
- **Archived:** 2026-08-19

## Lessons Learned

- Recovery mechanisms need tool-specific guidance, not one-size-fits-all messages
- Flash-class models need more retries to learn from steering
- Progressive escalation (hint → explicit → example) is more effective than repeating the same message
