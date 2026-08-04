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

**Hybrid Mode exception:** the overview rule below applies to complex tasks.
For simple tasks the Orchestrator writes code directly without a FID (ECHO.md
Hybrid Mode; runtime path `idle → green`), then verifies immediately.
FID-2026-0803-001 ECHO-4.

---

## Agent Roster

| # | Agent | Phase | Responsibility | Tools |
|---|-------|-------|----------------|-------|
| 1 | **Orchestrator** | ALL | Routes work through Perfection Loop, enforces protocol compliance, spawns all agents | spawn_agents, read_files, read_subtree, run_readonly_command, write_todos, suggest_followups, ask_user, read_url, skill, set_output, list_directory, glob, render_ui, gravity_index, transition_phase, write_file, str_replace, apply_patch (phase-gated), set_scaffold_complete (scaffold mode) |
| 2 | **Detective** | RED | Codebase analysis, grep call-graphs, find issues, catalog evidence with file paths | code_search, set_output, list_directory, glob, read_files, read_subtree |
| 3 | **Forge** | GREEN | Implementation only. Writes code following the converged FID spec. Cannot self-verify. | write_file, str_replace, set_output |
| 4 | **Verifier** | AUDIT | Double-audit, run tests, check call-graph reachability, reject hallucinated claims | *(no tools — reads only via message history)* |
| 5 | **Recorder** | FID | Create, track, archive FIDs. Update CHANGELOG. Ensure no FID closes without AUDIT evidence | write_file, read_files, glob, code_search, set_output |
| 6 | **Thinker** | Planning | Deep reasoning via sequential thinking engine. Critiques specs, plans, implementations | sequentialthinking, end_turn |
| 7 | **Scout** | Explore | File/code search, glob, read subtrees, context gathering | glob, list_directory, read_files, read_subtree, set_output |
| 8 | **Researcher** | Research | Web search, documentation lookup, external API research | web_search, read_url (web); read_docs (docs) |
| 9 | **Scribe** | Docs | Session summaries, LESSONS.md, knowledge files, end-of-session capture | read_files, write_file, glob, code_search, set_output |

> **Note on Orchestrator write tools:** Per FID-2026-0718-008, the Orchestrator has `write_file` + `str_replace` in its
  toolName list, but they are GATED to exempt paths only (`dev/fids/`, `dev/scratchpad/`, `dev/nova/`) by
  `tool-executor.ts`. For all non-exempt paths, these tools are blocked unless FSM phase is `green` or `self_correct`
  (see Tool Gating). This satisfies ECHO separation-of-duties for production code while allowing FIDs/scratchpad without
  ceremony. FID-2026-0803-001 ECHO-5 reconciled this table with `agents/savant/savant.ts` (`run_readonly_command`,
  `gravity_index`, `apply_patch`, `set_scaffold_complete` are model-visible for the Orchestrator).

> **Note on Recorder archive ownership:** the Recorder has no filesystem move/archive tool; the CLI/orchestrator
  executes the `dev/fids/ → dev/fids/archive/` move while the Recorder authors the FID + CHANGELOG content and evidence.
  FID-2026-0803-001 ECHO-6.

---

## Perfection Loop — FID-Bound

The Perfection Loop runs on the **FID document**, not on the code.
Code implementation begins only after the FID converges to COMPLETE.

```text
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

```text
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
| write_file, str_replace, apply_patch | GREEN + SELF_CORRECT (exempt paths: dev/fids/, dev/nova/, dev/scratchpad/) | ✅ Active |
| run_terminal_command (bash) | AUDIT + GREEN | ✅ Active |
| sequentialthinking | Thinker only (id starts with `thinker`) | ✅ Active |
| code_search, read_files, glob, list_directory | ALL | ✅ Active (no gating needed) |
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

---

## Helper Tool Libraries (Filesystem-Only) — Added 2026-07-19

The 9-agent roster above represents **ECHO runtime roles** — the conversational agents that the Orchestrator spawns
through the Perfection Loop.

The filesystem under `agents/` may also contain **helper tool libraries** which are consumed by the canonical 9 roles
but do NOT constitute independent conversational agents:

| Helper Dir | Consumed By | Notes |
|------------|-------------|-------|
| `browser-use/` | `agents/savant/savant.ts:132`, `agents/context-pruner.ts`, `common/src/constants/free-agents.ts`, `common/src/__tests__/free-agents.test.ts` | Browser automation helper used by Orchestrator + context-pruner |
| `editor/` | `cli/src/utils/implementor-helpers.ts`, `agents/editor/best-of-n/*` | Editor scaffolding/best-of-N helper agents used by the CLI implementor flow |
| `file-explorer/` | `common/src/constants/agents.ts`, `agents/file-explorer/*` | File listing helpers (`directory-lister`, `glob-matcher`) |
| `librarian/` | `agents/context-pruner.ts` | Knowledge/context helper used by context-pruner |
| `types/` | `agents/base-chat.ts`, `agents/savant/savant.ts`, `agents/basher.ts`, `agents/browser-use/browser-use.ts` | Type-only shared imports across all agents + basher |
| `debug/` | *(none — transient output)* | Browser-agent trace output dir (`agents/debug/browser-agent-traces/`); not a helper library |

**Hierarchy:**

- 9 canonical ECHO runtime roles (Orchestrator + 8 specialists)
- + 6 helper tool libraries (above; `debug/` is a transient trace-output dir)
- = 15 directories in `agents/` (FID-2026-0803-001 ECHO-9 reconciled the count
  after the `savant-deep`/`e2e`/`__tests__` removals)

These two counts are NOT in conflict: the 9-agent roster represents runtime conversation entities; the 14-dir count
represents filesystem entries. Future checklists/audits should not confuse them.

**Current release note (0.0.15):** The repository uses the `@savant-code/*` workspace names and import paths. Historical
rebrand and checkpoint decisions remain in the archived session records and release history; this architecture document
tracks the current repository state.
