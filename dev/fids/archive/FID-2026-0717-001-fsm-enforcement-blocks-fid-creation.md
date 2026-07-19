# FID: FSM Enforcement Blocks FID Creation and Violates Separation of Duties

**Filename:** `FID-2026-0717-001-fsm-enforcement-blocks-fid-creation.md`
**ID:** FID-2026-0717-001
**Severity:** critical
**Status:** closed
**Created:** 2026-07-17 14:00
**Author:** Spencer Howell

---

## Summary

The ECHO FSM tool gating in `tool-executor.ts` blocks `write_file` and `str_replace` unless `fsmPhase === 'green'`. This creates a paradox: the ECHO Protocol requires FIDs to exist before code is written (FID-Bound Execution), but the gate blocks the Recorder agent from creating FIDs because it can never reach GREEN phase. Additionally, the Orchestrator currently has `write_file`/`str_replace` tools, violating Separation of Duties per ECHO v0.2.0.

## Environment

- **OS:** Windows 11
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Commit/State:** 08ef3fe (v0.0.1 initial commit + ECHO_PROTOCOL_INSTRUCTIONS v0.2.0 update)

## Detailed Description

### Problem 1: FSM Gate Blocks FID Creation

The tool gating at `packages/agent-runtime/src/tools/tool-executor.ts:338-349`:
```typescript
if (
  toolCall.toolName &&
  (toolCall.toolName === 'write_file' || toolCall.toolName === 'str_replace') &&
  (agentState.fsmPhase ?? 'idle') !== 'green'
) {
  // BLOCKED
}
```

The Recorder agent (`agents/recorder/recorder.ts:14`) has `write_file` in its tool set but does NOT have `transition_phase`. When spawned, `createAgentState()` (`spawn-agent-utils.ts:279-299`) does NOT include `fsmPhase`, so it defaults to `undefined`, which the gate treats as `'idle'`. The Recorder cannot reach GREEN, so it cannot write FID files.

### Problem 2: No FID Path Exception

The gate is blanket — no exception for `dev/fids/` paths. FIDs are documentation, not code. They must be writable in any phase.

### Problem 3: Subagents Don't Inherit FSM State

`createAgentState()` at `spawn-agent-utils.ts:279-299` does not include `fsmPhase` in the returned object. Every spawned subagent starts with `fsmPhase === undefined`. This means:
- If Orchestrator is in RED and spawns Detective, Detective starts in `idle` (not RED)
- If Orchestrator is in GREEN and spawns Forge, Forge starts in `idle` (not GREEN)

### Problem 4: `apply_patch` Not Gated

`apply_patch` exists as a tool (`common/src/tools/constants.ts:26`) but is NOT included in the tool gating check. Only `write_file` and `str_replace` are gated. `apply_patch` can bypass FSM enforcement.

### Problem 5: Orchestrator Has Write Tools (Separation of Duties Violation)

ECHO v0.2.0 says: "The Orchestrator routes work — it does not write code or run destructive commands." But `agents/base2/base2.ts:99-119` gives the Orchestrator `write_file`, `str_replace`, and `transition_phase`. This violates Separation of Duties.

### Expected Behavior

1. The Recorder can create/update FID files in any FSM phase
2. Subagents inherit `fsmPhase` from their parent
3. `apply_patch` is gated alongside `write_file`/`str_replace`
4. The Orchestrator does NOT have `write_file`/`str_replace` — it delegates to Forge
5. FID file paths (`dev/fids/`) are exempt from GREEN-only gating

### Root Cause

The FSM enforcement was added as a blanket gate without considering:
1. The FID creation flow (Recorder needs write_file before GREEN exists)
2. The Separation of Duties model (Orchestrator shouldn't write)
3. Subagent state propagation (FSM state is per-agent, not per-run)
4. Tool coverage gaps (`apply_patch` missing from gate)

### Evidence

**Recorder tool set** (`agents/recorder/recorder.ts:14`):
```typescript
toolNames: ['write_file', 'read_files', 'glob', 'grep', 'set_output'],
```
No `transition_phase` — cannot drive FSM.

**Subagent state creation** (`spawn-agent-utils.ts:279-298`):
```typescript
return {
  agentId, agentType, agentContext, ancestorRunIds, subagents,
  childRunIds, messageHistory, stepsRemaining, creditsUsed,
  directCreditsUsed, output, parentId, systemPrompt, toolDefinitions,
  contextTokenCount,
  // NOTE: fsmPhase is ABSENT
}
```

**Tool gating** (`tool-executor.ts:338-349`):
Only checks `write_file` and `str_replace`. `apply_patch` is not checked.

**Orchestrator tools** (`base2.ts:99-119`):
Includes `write_file`, `str_replace`, `transition_phase`.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/tool-executor.ts` — FSM gate logic
- `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts` — subagent state creation
- `agents/recorder/recorder.ts` — Recorder tool set
- `agents/base2/base2.ts` — Orchestrator tool set
- `agents/base2/base-deep.ts` — Deep agent tool set
- `common/src/tools/constants.ts` — tool definitions

### Risk Level

- [x] Critical: System cannot follow its own protocol. FIDs cannot be created. ECHO is unenforceable.

## Proposed Solution

### Approach

Two-phase fix: (1) unblock FID creation and fix subagent FSM inheritance, (2) complete tool gating and enforce Separation of Duties.

### Steps

**Phase 1: Unblock FID Creation + FSM Inheritance (Critical Path)**
1. Add FID path exemption to tool gating in `tool-executor.ts`: allow `write_file` and `str_replace` for paths matching `dev/fids/` in any phase. Extract path from `toolCall.input.path`, check if it starts with `dev/fids/`
2. Add `fsmPhase` inheritance to `createAgentState()` in `spawn-agent-utils.ts`: add `fsmPhase: parentAgentState.fsmPhase ?? 'idle'` to the returned object

**Phase 2: Complete Tool Gating + Separation of Duties**
3. Add `apply_patch` to the tool gating check in `tool-executor.ts` alongside `write_file`/`str_replace`
4. Remove `write_file`, `str_replace`, and `apply_patch` from Orchestrator (`base2.ts:99-119`) and deep agent (`base-deep.ts:284-296`). Keep `propose_str_replace` and `propose_write_file` — these are proposal-based (non-destructive) and appropriate for the Orchestrator
5. Add `transition_phase` to Recorder tool set (`recorder.ts:14`) so it can drive FSM state when needed

### Verification

After implementation:
1. Typecheck: `bun run --cwd=common typecheck && bun run --cwd=agents typecheck`
2. Grep `write_file` in Orchestrator (`base2.ts`) definition — should NOT appear
3. Grep `apply_patch` in tool-executor gating — should appear alongside `write_file`/`str_replace`
4. Verify `createAgentState()` includes `fsmPhase` from parent
5. Verify `base-deep.ts` no longer has `write_file`/`apply_patch`
6. Verify Recorder has `transition_phase` in tool set

## Perfection Loop

### RED Phase — Issues Identified

| # | Issue | File:Line | Evidence |
|---|-------|-----------|----------|
| 1 | FSM gate blocks `write_file` for Recorder — cannot create FIDs | `tool-executor.ts:338-349` | Recorder starts with `fsmPhase === undefined` (defaults to `idle`), gate blocks unless `green` |
| 2 | No FID path exception in gate | `tool-executor.ts:338-349` | Blanket gate on all `write_file` calls regardless of path |
| 3 | Subagents don't inherit `fsmPhase` from parent | `spawn-agent-utils.ts:279-298` | `fsmPhase` not included in returned AgentState |
| 4 | `apply_patch` not gated | `tool-executor.ts:338-349` | Only `write_file` and `str_replace` checked; `apply_patch` in `constants.ts:26` but not in gate |
| 5 | Orchestrator has `write_file`/`str_replace` — violates Separation of Duties | `base2.ts:99-119` | ECHO v0.2.0: "Orchestrator routes work — it does not write code" |
| 6 | Recorder lacks `transition_phase` | `recorder.ts:14` | Cannot drive FSM state; stuck in `idle`/`undefined` |

### GREEN Phase — Proposed Fixes

**Fix 1: FID path exemption** (`tool-executor.ts`)
- Before the existing gate check, add: if `toolName === 'write_file'` and path matches `dev/fids/`, skip the gate
- Implementation: extract path from `toolCall.input`, check if it starts with `dev/fids/`

**Fix 2: Subagent FSM inheritance** (`spawn-agent-utils.ts:279-298`)
- Add `fsmPhase: parentAgentState.fsmPhase ?? 'idle'` to the returned object

**Fix 3: Gate `apply_patch`** (`tool-executor.ts:338-349`)
- Add `toolCall.toolName === 'apply_patch'` to the gating condition

**Fix 4: Remove Orchestrator write tools** (`base2.ts:99-119`)
- Remove `'str_replace'` and `'write_file'` from the `buildArray()` call
- Keep `'propose_str_replace'` and `'propose_write_file'` (proposal-based, non-destructive)

**Fix 5: Add `transition_phase` to Recorder** (`recorder.ts:14`)
- Add `'transition_phase'` to `toolNames` array

### AUDIT Phase — Findings

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| A1 | `createAgentState()` called from 2 places: `spawn-agents.ts:97` AND `spawn-agent-inline.ts:99` — both need `fsmPhase` inheritance | Medium | Fix 2 must update `spawn-agent-utils.ts` (shared function), both callers get it automatically |
| A2 | `base-deep.ts:284-296` has `write_file` and `apply_patch` — separate agent from base2, also violates Separation of Duties | Medium | Extend Fix 4 to also remove `write_file`/`apply_patch` from `base-deep.ts` |
| A3 | FID path exemption on `write_file` is insufficient — `str_replace` on FID files should also be exempt | Low | Extend Fix 1 to cover `str_replace` when path matches `dev/fids/` |
| A4 | FID path exemption is agent-agnostic — any agent with `write_file` could write FIDs, not just Recorder | Low | Acceptable. FIDs are documentation. The Recorder is the *intended* writer, but the gate shouldn't block other agents from updating FIDs during collaboration. |
| A5 | The Approach section says "three-phase fix" but Phase 3 is really just Phase 2 continued | Low | Rename to two phases: (1) Unblock + inherit, (2) Complete gating + SoD |

### SELF-CORRECT Phase — Corrections Applied

**Correction A1**: Fix 2 is already correct — `createAgentState()` is a shared function in `spawn-agent-utils.ts`. Both callers (`spawn-agents.ts` and `spawn-agent-inline.ts`) use it. One fix covers both.

**Correction A2**: Fix 4 expanded to include `base-deep.ts`:
- Remove `write_file` and `apply_patch` from `base-deep.ts:284-296`
- `base-deep` should delegate file writes to Forge, same as base2

**Correction A3**: Fix 1 expanded to cover `str_replace` on FID paths:
- Gate exemption: `write_file` OR `str_replace` when path starts with `dev/fids/`

**Correction A5**: Renamed phases:
- Phase 1: Unblock FID Creation + FSM Inheritance (Fixes 1, 2)
- Phase 2: Complete Tool Gating + Separation of Duties (Fixes 3, 4, 5)

### COMPLETE Phase

FID converged. All issues identified, fixes specified, audit findings addressed. Ready for Forge implementation.

## Blind Spots (Questions I Should Have Asked)

1. **What happens if the Orchestrator can't write files but needs to create initial project files?** — The `propose_write_file` tool exists for this. The Orchestrator proposes, Forge executes. This is the correct Separation of Duties pattern.

2. **Should the FID path exemption be a whitelist or a pattern match?** — Pattern match on `dev/fids/` prefix is sufficient. FIDs are always in this directory.

3. **Does the `transition_phase` tool need its own gate?** — No. `transition_phase` is how agents move through the FSM. It should always be available to agents that have it.

4. **What about `render_ui`?** — Not a file write tool. No gating needed.

5. **What if a subagent needs to be in a different phase than its parent?** — The subagent can call `transition_phase` to move independently. Inheritance is just the starting point.

6. **Does the Recorder need `transition_phase` if the Orchestrator drives the FSM?** — The Orchestrator should drive transitions, but the Recorder needs `transition_phase` as a fallback for edge cases (e.g., direct FID updates during audit).

7. **What about the `set_output` tool?** — Not a file write. No gating needed.

8. **Should `propose_str_replace` and `propose_write_file` be gated?** — No. These are proposal-based tools that don't directly modify files. They're the correct pattern for the Orchestrator.

## Resolution

- **Fixed By:** Spencer Howell
- **Fixed Date:** 2026-07-17 14:30
- **Fix Description:** 5 changes across 4 files: FID path exemption in tool gate, subagent FSM inheritance, apply_patch gating, Orchestrator/deep-agent Separation of Duties enforcement, Recorder transition_phase tool
- **Tests Added:** No (typecheck verification only — pre-existing baseline unchanged)
- **Verified By:** typecheck (common + agents), grep verification (6 checks all pass)
- **Commit/PR:** Pending
- **Archived:** 2026-07-17 14:35 (moved to `dev/fids/archive/`)

## Lessons Learned

- FSM enforcement must account for the full FID lifecycle, not just code implementation
- Subagent state propagation is critical for multi-agent systems — FSM state must inherit
- Tool gating must be comprehensive — missing a tool (`apply_patch`) creates an bypass
- Separation of Duties is not just documentation — it must be enforced at the tool level
