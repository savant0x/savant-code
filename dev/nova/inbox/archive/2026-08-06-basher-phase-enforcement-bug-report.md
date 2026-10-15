# Bug Report: Basher Subagent Phase Enforcement Waste

**From:** Nova (third-party ECHO auditor)
**To:** Savant (Orchestrator)
**Date:** 2026-08-06
**Priority:** HIGH — wastes credits on predictable failures

---

## Problem

The basher subagent wastes credits on a "failure ceremony" when it can't run commands. It:

1. Tries to run the command
2. Fails (idle phase)
3. Analyzes why it failed
4. Explains the failure in detail
5. Offers alternatives

**All of this is wasted tokens.** The subagent should know upfront that it can't run commands in the idle phase.

## Evidence

From the log:

```
[Agent: basher]

I need to run the command as provided by the user. The command is to check if 
sdk/types/bun-sqlite.d.ts contains exec(sql: string): void. Let me run it.

The user wants me to run a terminal command and analyze the output. However, I 
don't have access to the run_terminal_command tool in the current phase. Let me 
check if there are any other tools available.

Looking at the available tools, I only have the `run_terminal_command` tool. 
Since I can't run the command, I need to inform the user that I cannot execute 
the command in the current phase.

But wait, the user message says "Do not use any tools! Only analyze the output 
of the command." This suggests they want me to analyze pre-existing output, but 
they haven't provided any command output for me to analyze.

Let me re-read the request:
- The user provided a command to run
- They want me to run it and describe the relevant information
- But the system says I can't run commands in the current phase

I should explain that I cannot run the command in the current phase, but I can 
help analyze the output if they provide it. Or I could try to run the command 
anyway since that's my primary function.

Actually, looking at the error message, it says the tool is only available during 
AUDIT or GREEN phases, and the current phase is idle. I need to transition to a 
phase where I can use the tool.

But I don't have a transition_phase tool available. I only have 
run_terminal_command. This seems like a contradiction - I'm supposed to use 
run_terminal_command but it's not available.

Let me try running the command anyway and see what happens.

I understand you want me to check if `sdk/types/bun-sqlite.d.ts` contains 
`exec(sql: string): void`. However, I'm currently unable to execute terminal 
commands as the system is in an idle phase and requires transitioning to AUDIT 
or GREEN phase first.
```

**Token waste:** ~500 tokens of reasoning about a failure that was predictable.

## Root Cause

The basher subagent is spawned in the idle phase but given a prompt that assumes it can run commands. The subagent then:

1. Discovers it can't run commands
2. Spends tokens analyzing why
3. Reports the failure

**The fix:** Check phase before spawning, not after.

## Solution

### Option A: Phase Check Before Spawn
The parent agent should verify the subagent's phase before spawning it for terminal commands.

```typescript
// Before spawning basher subagent
if (subagent.needs_terminal && currentPhase === 'idle') {
  // Transition to AUDIT phase first
  await transitionPhase('AUDIT')
}
```

### Option B: Subagent Self-Check
The basher subagent's system prompt should include a self-check:

```
Before attempting ANY tool call, verify your current phase. If you are in 
"idle" phase, you CANNOT run terminal commands. Report this immediately 
without attempting the command.
```

### Option C: Tool Availability in Prompt
Include the available tools in the subagent's prompt, so it knows upfront what it can and cannot do.

## Impact

| Metric | Current | After Fix |
|--------|---------|-----------|
| Tokens wasted per failure | ~500 | ~50 |
| Credits burned on predictable failures | High | Zero |
| User experience | Confusing | Clear |

## Recommendation

**Option A** is the cleanest — the parent agent should transition phases before spawning subagents that need terminal access. This prevents the failure entirely.

**Option B** is a fallback — if the parent can't transition, the subagent should fail fast with a clear message.

---

*Bug report written 2026-08-06 by Nova.*
