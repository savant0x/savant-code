# Savant-Code — ECHO Protocol Agent Architecture

## Overview

Savant-Code is an engineering agent framework built on the ECHO Protocol v0.2.0.
The framework enforces a separation-of-duties agent model where each phase
of the Perfection Loop is handled by a specialized agent. Code is never
written until a FID (Feature Implementation Document) has converged through
the Perfection Loop.

Two products ship from this monorepo: **Savant-Code** (paid CLI + SDK) and
**Savant-Free** (ad-supported variant). Both share one runtime, one SDK,
and one set of engineering laws (ECHO).

---

## Agent Roster

| # | Agent | Phase | Responsibility | Tools |
|---|-------|-------|----------------|-------|
| 1 | **Orchestrator** | ALL | Routes work through Perfection Loop, enforces protocol compliance, spawns all agents | spawn_agents, read_files, read_subtree, write_todos, suggest_followups, ask_user, read_url, skill, set_output, list_directory, glob, render_ui, transition_phase, write_file, str_replace |
| 2 | **Detective** | RED | Codebase analysis, grep call-graphs, find issues, catalog evidence with file paths | code_search, set_output |
| 3 | **Forge** | GREEN | Implementation only. Writes code following the converged FID spec. Cannot self-verify. | write_file, str_replace, set_output |
| 4 | **Verifier** | AUDIT | Double-audit, run tests, check call-graph reachability, reject hallucinated claims | *(no tools — reads only via message history)* |
| 5 | **Recorder** | FID | Create, track, archive FIDs. Update CHANGELOG. Ensure no FID closes without AUDIT evidence | write_file, read_files, glob, grep, set_output |
| 6 | **Thinker** | Planning | Deep reasoning via sequential thinking engine. Critiques specs, plans, implementations | sequentialthinking |
| 7 | **Scout** | Explore | File/code search, glob, read subtrees, context gathering | glob, list_directory, read_files, read_subtree, set_output |
| 8 | **Researcher** | Research | Web search, documentation lookup, external API research | web_search, read_url (web); read_docs (docs) |
| 9 | **Scribe** | Docs | Session summaries, LESSONS.md, knowledge files, end-of-session capture | read_files, write_file, glob, grep, set_output |

> **Note on Orchestrator write tools:** Per FID-2026-0718-008, the Orchestrator has `write_file` + `str_replace` in its toolName list, but they are GATED to exempt paths only (`dev/fids/`, `dev/scratchpad/`, `dev/nova/`) by `tool-executor.ts`. For all non-exempt paths, these tools are blocked unless FSM phase is `green`. This satisfies ECHO separation-of-duties for production code while allowing FIDs/scratchpad without ceremony.

---

## Perfection Loop — FID-Bound

The Perfection Loop runs on the **FID document**, not on the code.
Code implementation begins only after the FID converges to COMPLETE.

```
┌──────────────────────────────────────────────────────────┐
│                 FID PERFECTION LOOP                       │
│  (iterates on the FID document until convergence)         │
│                                                          │
│  ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐ │
│  │   RED   │──>│  GREEN   │──>│  AUDIT  │──>│COMPLETE │ │
│  │ PHASE   │   │  PHASE   │   │  PHASE  │   │(fid     │ │
│  └─────────┘   └────┬─────┘   └─────────┘   │converged│ │
│       ^              │             │         └────┬────┘ │
│       │              │     ┌───────┴───────┐      │      │
│       │              │     │ SELF-CORRECT  │      │      │
│       │              │     │ (audit failed) │      │      │
│       │              │     └───────────────┘      │      │
│       │              │                            │      │
│       └──────────────┘ (new issues → re-enter RED)│      │
│                                                    │      │
└────────────────────────────────────────────────────────┘      │
                                                           │
                    ┌──────────────────────────────────────┘
                    ▼
          ┌─────────────────┐
          │  IMPLEMENTATION │  Only after FID converges
          │  (Forge agent)  │
          └─────────────────┘
                    │
                    ▼
          ┌─────────────────┐
          │  VERIFICATION   │  Verifier validates the code matches FID
          │  (Verifier)     │
          └─────────────────┘
```

### Phase Mapping

| FID Phase | Agent | What Gets Produced |
|-----------|-------|-------------------|
| **RED** | Detective | Issue catalog with evidence: file paths, line numbers, grep output, call-graph |
| **GREEN** | Thinker + Recorder | Proposed fix in FID, all questions answered, most robust defaults chosen |
| **AUDIT** | Verifier + Recorder | Verification output pasted into FID, call-graph grep results, double-audit evidence |
| **SELF-CORRECT** | Thinker + Recorder | Revised fix, updated FID sections |
| **COMPLETE** | Recorder | FID closed, archived to `dev/fids/archive/`, CHANGELOG.md updated |
| *Post-FID: Forge* | Forge | Code implementation matching the FID spec |
| *Post-FID: Verify* | Verifier | Code verified: typecheck, tests, lint, call-graph check |

---

## Thinker — Sequential Thinking Engine

The Thinker agent uses the `sequentialthinking` tool for all non-trivial reasoning.
This is a direct copy+integration of the `SequentialThinkingServer` class from
the MCP reference implementation, stripped of MCP transport.

### How It Works

The Thinker calls `sequentialthinking` iteratively in a loop:

```
thought 1:  "Analyze the problem... what exactly needs to be solved?"
thought 2:  "Identify constraints... boundaries, requirements, non-negotiables
..." 
thought 3:  "Wait, that approach has a flaw — revising thought 2"
   (isRevision: true, revisesThought: 2)
thought 4:  "Alternative approach branching from thought 1"
   (branchFromThought: 1, branchId: "approach-b")
thought 5:  "Compare approach A vs approach B..."
...
thought N:  "Final recommendation. nextThoughtNeeded: false"
```

### State Tracking

The `SequentialThinkingServer` instance lives in the Thinker agent's state,
persisting across steps within a single think session:

- `thoughtHistory[]` — every thought step, in order
- `branches{}` — branching thoughts keyed by branchId
- Each call returns: current thought number, total thoughts, branch list, thought history length

### Tool Schema

```typescript
{
  thought: string,           // Current thinking step
  nextThoughtNeeded: boolean, // true unless fully converged
  thoughtNumber: number,     // Current position in sequence
  totalThoughts: number,     // Current estimate (auto-adjusts)
  isRevision?: boolean,      // Revising a previous thought
  revisesThought?: number,   // Which thought is being revised
  branchFromThought?: number,// Branching from this thought number
  branchId?: string,         // Branch identifier
  needsMoreThoughts?: boolean// Need to extend beyond initial estimate
}
```

### Integration Points

- `agents/thinker/thinker.ts` — gets `useSequentialThinkingTool: true`
- `common/src/tools/constants.ts` — new tool name `sequentialthinking`
- Tool handler in `packages/agent-runtime/src/tools/` — wraps `SequentialThinkingServer`

---

## Runtime Enforcement

### FSM State in AgentState

The Orchestrator tracks current Perfection Loop phase in AgentState:

```typescript
type PerfectionLoopPhase = 'idle' | 'red' | 'green' | 'audit' | 'self_correct' | 'complete'
```

- Phase transitions are explicit via the `transition_phase` tool
- The runtime validates that transitions follow the FSM legal paths
- Invalid transitions (e.g., idle → audit) are rejected

### Circuit Breakers (per-session)

Tracked in AgentState:

```typescript
{
  charChangeTotal: number,       // Running total for 10% cap
  iterationCount: number,        // Current loop iteration
  oscillationDetections: number, // Same issue reappearing
  lastIssueIds: string[],        // Last 3 issues for oscillation detection
}
```

### Tool Gating (active)

Tools are gated by FSM phase in `tool-executor.ts`:

| Tool | Allowed Phases | Status |
|------|---------------|--------|
| write_file, str_replace, apply_patch | GREEN only (exempt paths: dev/fids/, dev/nova/, dev/scratchpad/) | ✅ Active |
| run_terminal_command (bash) | AUDIT only | ✅ Active |
| sequentialthinking | Thinker only (id starts with `thinker`) | ✅ Active |
| grep, read, glob, list_dir | ALL | ✅ Active (no gating needed) |
| spawn_agents | ALL | ✅ Active (template-level only) |
| bash (destructive) | Never | ⏭️ Future phase (command classification not yet implemented) |
| create_fid, update_fid, archive_fid | Recorder only | ⏭️ Future phase (these are conceptual roles, not registered tools) |

---

## Boot Sequence

1. Load ECHO.md — establish identity
2. Load `protocol.config.yaml` — get project commands
3. Review `dev/fids/` — flag open FIDs
4. Create session summary at `dev/session-summaries/`
5. Enter IDLE phase — wait for user input

---

## Open Decisions

1. FSM enforcement (`transition_phase` tool + tool gating): implement now or defer?

---

## Helper Tool Libraries (Filesystem-Only) — Added 2026-07-19

The 9-agent roster above represents **ECHO runtime roles** — the conversational agents that the Orchestrator spawns through the Perfection Loop.

The filesystem under `agents/` may also contain **helper tool libraries** which are consumed by the canonical 9 roles but do NOT constitute independent conversational agents:

| Helper Dir | Consumed By | Notes |
|------------|-------------|-------|
| `browser-use/` | `agents/savant/savant.ts:74`, `agents/context-pruner.ts`, `common/src/constants/free-agents.ts`, `common/src/__tests__/free-agents.test.ts` | Browser automation helper used by Orchestrator + context-pruner |
| `editor/` | `cli/src/commands/init.ts` (scaffolding), `agents/__tests__/context-pruner.test.ts`, `evals/buffbench/eval-savant-code-hard.json` | Editor scaffolding helper used by `init` command |
| `file-explorer/` | `common/src/constants/agents.ts`, `evals/buffbench/*.json` | File listing helper consumed by agent-registry constants |
| `librarian/` | `agents/context-pruner.ts` | Knowledge/context helper used by context-pruner |
| `types/` | `agents/base-chat.ts`, `agents/savant/savant.ts`, `agents/savant/savant-deep.ts`, `agents/basher.ts`, `agents/browser-use/browser-use.ts` | Type-only shared imports across all agents + basher |

**Hierarchy:**
- 9 canonical ECHO runtime roles (Orchestrator + 8 specialists)
- + 5 helper tool libraries (above)
- = 14 directories in `agents/` (post-FID-017 prune, where 2 truly-orphaned `e2e/` + `__tests__/` were deleted)

These two counts are NOT in conflict: the 9-agent roster represents runtime conversation entities; the 14-dir count represents filesystem entries. Future checklists/audits should not confuse them.

**Pre-rebrand note (0.0.2 push):** All `@savant-code/*` workspace names + import paths remain intact at this checkpoint. The full rebrand (rename all `savant-code`/`savant-free` instances to `savant-code`/`savant-free`) ships in the NEXT push.
