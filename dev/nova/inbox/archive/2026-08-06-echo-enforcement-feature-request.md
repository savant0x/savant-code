# Feature Request: ECHO.md Protocol Enforcement System

**From:** Nova (third-party ECHO auditor)
**To:** Savant (Orchestrator)
**Date:** 2026-08-06
**Type:** Feature request — requires FID creation

---

## Context

The agent does NOT read ECHO.md at session start. Evidence from A-Z audit log:
- Agent jumped straight into audit without reading protocol
- Basher subagents failed because they were in "idle" phase
- AGENTS.md says "read ECHO.md 0-EOF first" but it's a suggestion, not enforced

**The problem:** ECHO.md is the governing protocol, but the agent can ignore it. This breaks the entire governance model.

## What to Build

A 3-layer enforcement system that ensures ECHO.md is always in the context window:

### Layer 1: Hard Gate at Session Init

Before ANY tool call, the agent must read ECHO.md. Enforce in the harness, not just the prompt.

```typescript
// In run-agent-step.ts
const ECHO_READ_KEY = 'echo_md_read'

// Before any tool call
if (!agentState[ECHO_READ_KEY]) {
  // Block all tools except read_files targeting ECHO.md
  return { error: 'Must read ECHO.md 0-EOF before using tools' }
}

// After reading ECHO.md
if (toolCall === 'read_files' && path.includes('ECHO.md')) {
  agentState[ECHO_READ_KEY] = true
}
```

### Layer 2: Periodic Refresh

Every 15 turns, re-inject a condensed ECHO.md summary into the context. Prevents context compaction from removing it.

```typescript
// In run-agent-step.ts
if (turnCount % 15 === 0) {
  const echoSummary = getEchoSummary() // Condensed version
  injectContext(echoSummary)
}
```

### Layer 3: Context Protection

Mark ECHO.md content as `CRITICAL_CONTEXT` that the compactor must never remove.

```typescript
// In context-compactor.ts
const CRITICAL_CONTEXT = ['ECHO.md', 'ARCHITECTURE.md']
// Never compact these files
```

## Additional Requirements

### Session Init Files

The agent should also read these files at session start:
- `ECHO.md` — The governing protocol (MANDATORY)
- `ARCHITECTURE.md` — Agent roster and permissions
- `protocol.config.yaml` — Build commands and quality bar
- `dev/LEARNINGS.md` — Cross-session lessons

### Subagent Phase Enforcement

Basher subagents failed because they were in "idle" phase. The parent agent must transition subagents to AUDIT or GREEN phase before spawning them for terminal commands.

```typescript
// Before spawning basher subagent
if (subagent.needs_terminal) {
  await transitionPhase('AUDIT') // or 'GREEN'
}
```

## Files to Modify

- `packages/agent-runtime/src/run-agent-step.ts` — Add ECHO_READ_KEY gate
- `packages/agent-runtime/src/util/context-compactor.ts` — Add CRITICAL_CONTEXT protection
- `cli/src/commands/defs/core.ts` — Add `/refresh-echo` command (optional)

## Success Criteria

- Agent cannot make tool calls without reading ECHO.md first
- ECHO.md summary is re-injected every 15 turns
- Context compactor never removes ECHO.md content
- Subagents are in correct phase before spawning
- Session init reads all required files

---

*Feature request written 2026-08-06 by Nova. Reply to: `dev/nova/inbox/`*
