# FID: Bash Gating (AUDIT-only) + strict_mode Runtime Check

**Filename:** `FID-2026-0717-004-bash-gating-strict-mode.md`
**ID:** FID-2026-0717-004
**Severity:** high
**Status:** closed
**Created:** 2026-07-17 16:30
**Author:** Spencer Howell

---

## Summary

Two ECHO enforcement gaps remain: (1) ARCHITECTURE.md specifies `run_terminal_command` should be gated to AUDIT phase for test/typecheck commands, but no gating exists. (2) `protocol.config.yaml` has `strict_mode: true` but nothing reads it — Laws 5-15 are documented but not configurable at runtime.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Commit/State:** Post FID-2026-0717-002 (coding standards → skills)

## Detailed Description

### Problem 1: Bash Gating Not Implemented

ARCHITECTURE.md:174 specifies:
```
| bash (test/typecheck) | AUDIT only |
| bash (destructive) | Never |
```

But `tool-executor.ts:338-361` only gates `write_file`/`str_replace`/`apply_patch`. `run_terminal_command` has zero gating. Any agent with bash can run any command in any phase.

The tool is called `run_terminal_command` (not `bash`). It's used by 4+ agents: basher, browser-use, tmux-cli, librarian.

### Problem 2: strict_mode Is Dead Config

`protocol.config.yaml:15` has `strict_mode: true`. ECHO.md:85-103 defines what it controls:
- `true`: All 15 laws active, full AUDIT, FID required
- `false`: Core 4 laws only, relaxed AUDIT, FID optional

But no code reads `protocol.config.yaml`. The `strict_mode` field is dead config. There's no mechanism to propagate it to agents — `AgentState` has no config field.

### Expected Behavior

1. `run_terminal_command` is blocked unless FSM phase is `audit` (for test/typecheck commands)
2. Destructive commands (rm -rf, git push --force) are blocked in all phases
3. `strict_mode` is read from `protocol.config.yaml` at boot
4. The value is injected into agent system prompts
5. When `strict_mode: false`, Laws 5-15 are advisory

### Root Cause

Both features were specified in ARCHITECTURE.md and ECHO.md but never implemented. The tool gating only covered file writes. The config system was designed for documentation, not runtime.

### Evidence

**Bash tool definition** (`common/src/tools/constants.ts:58`):
```typescript
'run_terminal_command',
```

**No bash gating in tool-executor.ts** — only `write_file`/`str_replace`/`apply_patch` are gated (lines 338-361).

**strict_mode dead config** (`protocol.config.yaml:15`):
```yaml
protocol:
  strict_mode: true
```

**No AgentState config field** (`common/src/types/session-state.ts:27-59`):
```typescript
export type AgentState = {
  agentId: string
  agentType: AgentTemplateType | null
  // ... no config field
}
```

**ARCHITECTURE.md spec** (lines 167-180):
```
| bash (test/typecheck) | AUDIT only |
| bash (destructive) | Never |
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/tool-executor.ts` — bash gating logic
- `common/src/types/session-state.ts` — AgentState config field
- `protocol.config.yaml` — strict_mode becomes live config
- ECHO.md — strict_mode behavior becomes enforceable

### Risk Level

- [x] High: Bash has no phase restrictions. Agents can run destructive commands during RED phase.

## Proposed Solution

### Approach

Two-phase fix: (1) bash gating in tool-executor, (2) strict_mode via system prompt injection.

### Steps

**Phase 1: Bash Gating**
1. Add `run_terminal_command` to the gating check in `tool-executor.ts`
2. Gate to `audit` phase only — block in all other phases
3. No exception for FID paths (bash doesn't write files directly)
4. Implementation: add `toolCall.toolName === 'run_terminal_command'` to the gate condition, check `fsmPhase !== 'audit'`

**Phase 2: strict_mode Runtime Check**
5. Add `strictMode?: boolean` field to `AgentState` in `common/src/types/session-state.ts`
6. Set default in `getInitialAgentState()`: `strictMode: true`
7. In the agent runtime boot/initialization, read `protocol.config.yaml` and parse `protocol.strict_mode`
8. Inject the value into `AgentState.strictMode`
9. Pass to subagents via `createAgentState()` (inherit from parent)
10. Inject into agent system prompt: when `strictMode: false`, add note that Laws 5-15 are advisory

### What We're NOT Doing

- Not parsing `protocol.config.yaml` in the tool-executor (too late in the pipeline)
- Not blocking all bash — only gating to AUDIT phase
- Not implementing command classification (test vs destructive) — simpler to gate all bash to AUDIT

### Verification

1. Typecheck: `bun run --cwd=common typecheck`
2. Grep `run_terminal_command` in tool-executor.ts — should appear in gating check
3. Verify `AgentState` has `strictMode` field
4. Verify `createAgentState()` passes `strictMode` from parent

## Perfection Loop

### RED Phase — Issues Identified

| # | Issue | Evidence |
|---|-------|----------|
| 1 | `run_terminal_command` has zero FSM gating | `tool-executor.ts:338-361` only gates file write tools |
| 2 | ARCHITECTURE.md specifies AUDIT-only but code doesn't enforce | `ARCHITECTURE.md:174` vs `tool-executor.ts:338-361` |
| 3 | `strict_mode` is dead config | `protocol.config.yaml:15` defined but no code reads it |
| 4 | No mechanism to propagate config to agents | `AgentState` has no config field (`session-state.ts:27-59`) |
| 5 | Subagents don't inherit config from parent | `createAgentState()` doesn't pass config |
| 6 | Destructive bash commands have no restriction | Any agent with `run_terminal_command` can run `rm -rf`, `git push --force` |

### GREEN Phase — Proposed Fixes

**Fix 1: Bash gating** (`tool-executor.ts:338-361`)

Add `run_terminal_command` to the gating condition. Block unless `fsmPhase === 'audit'`.

Current gate:
```typescript
(toolCall.toolName === 'write_file' ||
  toolCall.toolName === 'str_replace' ||
  toolCall.toolName === 'apply_patch') &&
(agentState.fsmPhase ?? 'idle') !== 'green'
```

New gate — two conditions:
1. File writes: blocked unless `green` (existing)
2. Terminal commands: blocked unless `audit` (new)

**Fix 2: AgentState config** (`session-state.ts:27-59`)

Add `strictMode?: boolean` to `AgentState`. Default: `true` in `getInitialAgentState()`.

**Fix 3: Config propagation** (`spawn-agent-utils.ts:279-298`)

Pass `strictMode: parentAgentState.strictMode ?? true` in `createAgentState()`.

**Fix 4: Config reading** (new code in agent runtime initialization)

Read `protocol.config.yaml` at startup, parse `protocol.strict_mode`, inject into `AgentState.strictMode`. This can be done in the same place where `AgentState` is first created (the main agent entry point).

**Fix 5: System prompt injection**

When `strictMode === false`, prepend to agent system prompt:
```
NOTE: strict_mode is OFF. Laws 5-15 are advisory, not enforced. AUDIT phase is relaxed. FID creation is optional.
```

### AUDIT Phase — Verification

| # | Check | Method |
|---|-------|--------|
| 1 | `run_terminal_command` gated to AUDIT | Grep tool-executor.ts for `run_terminal_command` |
| 2 | `AgentState` has `strictMode` field | Read session-state.ts |
| 3 | `createAgentState()` passes `strictMode` | Read spawn-agent-utils.ts |
| 4 | Typecheck passes | `bun run --cwd=common typecheck` |
| 5 | No breaking changes to existing agents | `bun run --cwd=agents typecheck` (pre-existing only) |

### SELF-CORRECT Phase

**Finding S1**: Gating ALL `run_terminal_command` to AUDIT might be too restrictive. The `basher` agent is specifically for running terminal commands. If bash is AUDIT-only, the basher can only run commands during audit.

**Correction**: This is by design. The ECHO Protocol says terminal commands (test/typecheck) should only run during AUDIT. The basher agent exists for this purpose — it runs validation commands during the audit phase. Other agents shouldn't be running arbitrary terminal commands.

**Finding S2**: How does the agent runtime read `protocol.config.yaml`? The file is in the project root, but the runtime might not know the project root path.

**Correction**: The `cwd` option in `loadSkillsSync()` already resolves the project root. Use the same `cwd` to read `protocol.config.yaml`. The agent runtime already has access to `cwd` in most entry points.

**Finding S3**: What if `protocol.config.yaml` doesn't exist or doesn't have `strict_mode`?

**Correction**: Default to `true` (strict). The ECHO Protocol defaults to full enforcement. Only explicit `strict_mode: false` relaxes Laws 5-15.

**Finding S4**: Should the `strictMode` field affect tool gating behavior, or just prompt injection?

**Correction**: Both. When `strictMode: false`:
- Prompt injection: Laws 5-15 are advisory
- Tool gating: AUDIT phase relaxed (no double-audit requirement)
- FID creation: optional, not required
But circuit breaker rules still apply regardless.

### COMPLETE Phase

FID converged. 6 issues identified, 5 fixes specified, 4 self-corrections applied. Ready for Forge implementation.

## Blind Spots (Questions I Should Have Asked)

1. **Should bash gating be based on command content (test vs destructive) or phase-only?** — Phase-only is simpler and more robust. Command classification is fragile (shell parsing, aliases, scripts). Gating all bash to AUDIT is the safe default.

2. **What about `render_ui`?** — Not a file write or terminal command. No gating needed.

3. **What about `add_message`?** — Not a file write or terminal command. No gating needed.

4. **What if the user wants to run a command outside of AUDIT?** — They can transition to AUDIT first via `transition_phase`, then run the command. The FSM is the control mechanism.

5. **Should `strict_mode` affect the Orchestrator's tool set?** — No. Tool sets are defined per-agent in code, not by config. `strict_mode` affects LAW enforcement, not tool availability.

6. **What about the FID creation requirement when `strict_mode: false`?** — FID creation becomes optional. The agent can implement directly without creating a FID first. But if it does create a FID, the Perfection Loop still applies.

7. **Should `strict_mode` be injectable per-session or per-agent?** — Per-session is sufficient. All agents in a session should follow the same strictness level.

8. **What if `protocol.config.yaml` has a YAML parsing error?** — Default to `strict: true`. Don't fail the boot — just use the safe default.

## Resolution

- **Fixed By:** Spencer Howell
- **Fixed Date:** 2026-07-17 16:45
- **Fix Description:** 5 changes: (1) run_terminal_command gated to AUDIT phase in tool-executor.ts; (2) strictMode field added to AgentState with default true; (3) strictMode inherited by subagents via createAgentState(); (4) readStrictMode() utility reads protocol.config.yaml at boot in run-state.ts; (5) system prompt injection when strictMode is false in run-agent-step.ts.
- **Tests Added:** No (typecheck verification only)
- **Verified By:** typecheck (common clean, agents baseline unchanged), grep verification (6 checks all pass)
- **Commit/PR:** Pending
- **Archived:** 2026-07-17 (set when moved to `dev/fids/archive/`)

## Lessons Learned

- Documenting a spec (ARCHITECTURE.md) without implementing it creates false confidence
- Dead config is worse than no config — it implies enforcement that doesn't exist
- Phase-only gating is simpler and more robust than command classification
- Config propagation needs a mechanism — AgentState is the right place
