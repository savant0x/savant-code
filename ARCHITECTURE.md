# Savant-Code — ECHO Protocol Agent Architecture

## Overview

Savant-Code is an engineering agent framework built on the ECHO Protocol v0.2.0.
The framework enforces a separation-of-duties agent model where each phase
of the Perfection Loop is handled by a specialized agent. Code is never
written until a FID (Feature Implementation Document) has converged through
the Perfection Loop.

This monorepo ships **Savant-Code** (CLI, SDK and desktop shell), sharing one
runtime and one set of engineering laws (ECHO). The separate Savant-Free
product was retired on 2026-10-15.

**Hybrid Mode exception:** the convergence rule above applies to complex tasks.
For simple tasks the Orchestrator writes code directly without a FID (ECHO.md
Hybrid Mode; runtime path `idle → green`), then verifies immediately.
FID-2026-0803-001 ECHO-4.

---

## Agent Roster

| # | Agent | Phase | Responsibility | Tools |
|---|-------|-------|----------------|-------|
| 1 | **Orchestrator** | ALL | Routes work through Perfection Loop, enforces protocol compliance, spawns agents | spawn_agents, fid_worktree, read_files, read_subtree, recover_evidence, run_readonly_command, write_todos, suggest_followups, ask_user, read_url, skill, skill_manage, set_output, list_directory, glob, render_ui, gravity_index, update_goal, get_goal, transition_phase, write_file, str_replace, apply_patch (phase-gated), set_scaffold_complete (scaffold mode) |
| 2 | **Detective** | RED | Codebase analysis, grep call-graphs, find issues, catalog source evidence | code_search, set_output, list_directory, glob, read_files, read_subtree, recover_evidence, query_blast_radius, query_node_edges, query_domain_clusters |
| 3 | **Forge** | GREEN | Implementation only. Writes code following the converged FID spec. Cannot self-verify. | read_files, write_file, str_replace, set_output (FID-2026-0824-031) |
| 4 | **Verifier** | AUDIT | Audit supplied source bytes, test output and call-graph evidence; return cited PASS, FAIL or NEEDS-REVIEW | *(no tools — receives message history and injected raw evidence)* |
| 5 | **Recorder** | FID | Create, track, archive FIDs. Update CHANGELOG. Ensure no FID closes without AUDIT evidence | write_file, read_files, glob, code_search, set_output |
| 6 | **Thinker** | Planning | Deep reasoning via sequential thinking engine. Critiques specs, plans, implementations | sequentialthinking, end_turn |
| 7 | **Scout** | Explore | Find/rank files, read subtrees and gather context; return a structured discovery artifact | glob, list_directory, read_files, read_subtree, recover_evidence, set_output, query_blast_radius, query_node_edges, query_domain_clusters |
| 8 | **Researcher** | Research | Web search, documentation lookup, external API research | web_search, read_url, deep_research, recover_evidence (web); read_docs (docs) |
| 9 | **Scribe** | Docs | Session summaries, LEARNINGS.md, knowledge files, quarantined skill drafts and end-of-session capture | read_files, write_file, glob, code_search, set_output, skill_manage |
| 10 | **Adversary** | ADVERSARIAL | Meta-verification: refutes every Verifier FAIL, re-audits every unevidenced PASS, resolves citations, re-rates severities; verdicts override the Verifier's (FID-2026-0805-004) | read_files, code_search, glob, list_directory, set_output |

The tool inventory follows the definitions under `agents/`. Orchestrator tools
are conditional on mode/options in `agents/savant/savant.ts`: for example,
plan/analyze modes omit `fid_worktree`, analyze mode omits writes/transitions,
and scaffold mode substitutes `set_scaffold_complete` for `apply_patch`.
Runtime capability, containment, sandbox and protocol gates still apply.

> **Orchestrator writes:** `write_file`, `str_replace` and `apply_patch` pass
> through `packages/agent-runtime/src/tools/tool-executor/write-gate.ts`.
> Contained `dev/fids/`, `dev/nova/` and `dev/scratchpad/` paths are exempt from
> its FSM phase requirement. Source writes normally require `green` or
> `self_correct`; scaffold mode relaxes that phase check. Tool availability
> does not by itself authorize a write or bypass EHEL. Hybrid Mode permits
> direct simple-task implementation; complex implementation belongs to Forge.

> **Verification execution:** command-capable helpers such as `basher` run
> builds, tests, lint and reachability commands. Verifier audits the supplied
> results and raw evidence; it cannot execute commands or read the filesystem.
> Adversary can resolve citations through its own read-only tools. Both require
> raw evidence (`requiresRawEvidence` in their definitions).

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
│  ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌──────────────┐ │
│  │   RED   │──>│  GREEN   │──>│  AUDIT  │──>│ ADVERSARIAL  │ │
│  │ PHASE   │   │  PHASE   │   │  PHASE  │   │    PHASE     │ │
│  └─────────┘   └────┬─────┘   └─────────┘   └───┬──────┬────┘ │
│       ^              │             │            │      │      │
│       │              │     ┌───────┴───────┐    │      │      │
│       │              │     │ SELF-CORRECT  │<───┘      │      │
│       │              │     │ (findings)    │            │      │
│       │              │     └───────┬───────┘            │      │
│       │              │             │     ┌──────────────┘      │
│       │              │             ▼     ▼                     │
│       │              │        ┌──────────────┐                 │
│       │              │        │   COMPLETE   │                 │
│       │              │        │ (converged)  │                 │
│       │              │        └──────────────┘                 │
│       └──────────────┘ (new issues → re-enter RED)             │
└────────────────────────────────────────────────────────────────┘
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
| **AUDIT** | Verifier + Recorder | Verification output pasted into FID, call-graph grep results, double-audit evidence, per-finding `file:line` citations (FID-2026-0805-004) |
| **ADVERSARIAL** | Adversary | Meta-verification: refuted/evaluated Verifier findings (CONFIRMED/REFUTED/ADJUSTED), resolved citations, re-rated severities; verdicts override (FID-2026-0805-004) |
| **SELF-CORRECT** | Thinker + Recorder | Revised fix, updated FID sections |
| **COMPLETE** | Recorder | FID plan marked `converged`; implementation may begin |
| *Post-FID: Forge* | Forge | Code implementation matching the FID spec |
| *Post-FID: Verify* | Command-capable helpers + Verifier + Adversary | Executed checks and source evidence, cited review and meta-review |
| *Post-implementation: Close* | Recorder + Orchestrator | After committed implementation and passing gates, mark `closed`, archive and update CHANGELOG |

The diagram's COMPLETE node denotes **plan convergence**, not FID closure.
The status definitions in `ECHO.md` distinguish `converged` (pre-implementation)
from `closed` (implemented, committed and verified). Observation windows and
external acceptance remain separate in `dev/tracking/internal-followups.json`;
implementation closure does not certify an unobserved production outcome.

## Concurrent agent execution and result delivery

The orchestrator can place repeated roles or mixed independent roles in one
`spawn_agents` call. Ordinary batches dispatch through `Promise.allSettled`
in `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts`:

```text
Orchestrator → spawn_agents → child A ─┐
                          → child B ─┼→ all settled → reports → Orchestrator
                          → child C ─┘
```

- Children run concurrently; the parent resumes after the entire batch settles.
  Background parent work and consumption of individual early completions are
  not part of this dispatch contract.
- `MAX_SUBAGENT_FAN_OUT = 32` and `MAX_SUBAGENT_DEPTH = 8` live in
  `common/src/constants/agents.ts`. The model selects the batch composition
  under existing prompts; no automatic two- or three-Verifier quorum exists.
- An optional research `plan` validates local source bytes, dependency stages
  and returned artifacts before accepting steps. Its role allowlist excludes
  audit and effectful roles; ordinary batches support multiple Verifiers.
- Each child passes through `spawn-agents-child-run.ts` and
  `execute-subagent.ts`. Host-issued `spawnOrigin` (spawning tool-call ID and
  declared index) accompanies start/finish events. CLI matching uses that
  identity, preserving same-role result ownership despite reordered starts;
  legacy events without it retain the role-based fallback.
- Scout and Detective return structured artifacts and preserve authored
  `set_output` after STEP. Their fallback retains actual discovery evidence.
  Verifier returns last-message review text. Parent reports preserve batch
  order; the CLI headless answer joins the complete final assistant turn.

Source acceptance and limitations are recorded in
`docs/reports/source-fanout-verification-2026-10-19.md`. Independent work can
overlap; a review depending on implementation or another report must receive
that evidence before it can meaningfully evaluate it.

---

## Thinker — Sequential Thinking Engine

The Thinker agent uses the `sequentialthinking` tool for all non-trivial reasoning.
Its typed `ThoughtSession` core in `common/src/tools/sequential-thinking.ts`
supports branching, revision and convergence without an MCP transport.

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

`packages/agent-runtime/src/tools/thought-session-store.ts` owns a registry
keyed by `runId`. Each Thinker run receives an isolated `ThoughtSession`;
accepted calls append immutable thought snapshots and update branch state.
Snapshots expose ordered thoughts, branches and convergence. Terminal paths
clean up the session and remove its registry entry.

The runtime convergence gate requires at least one accepted thought and a
final `nextThoughtNeeded: false` call. It builds a structured final artifact
with terminal status, synthesis, metrics and thoughts; success requires a
non-null payload. Premature completion produces retry guidance, and failure,
exhaustion or cancellation is reported explicitly.

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

- `agents/thinker/thinker.ts` — declares `sequentialthinking` and `end_turn`,
  structured output and the final-thought contract.
- `common/src/tools/constants.ts` — registered tool name `sequentialthinking`.
- `packages/agent-runtime/src/tools/handlers/tool/sequential-thinking.ts` —
  routes accepted thoughts into the current run's session.
- `packages/agent-runtime/src/tools/thinker-convergence-gate.ts` — enforces
  convergence and constructs the final artifact consumed by the parent.

---

## Runtime Enforcement

### FSM State in AgentState

The Orchestrator tracks current Perfection Loop phase in AgentState:

```typescript
type FsmPhase =
  | 'idle'
  | 'red'
  | 'green'
  | 'audit'
  | 'adversarial'
  | 'self_correct'
  | 'complete'
```

- Phase transitions are explicit via the `transition_phase` tool
- The runtime validates that transitions follow the FSM legal paths
- Invalid transitions (e.g., idle → audit) are rejected
- `green → complete` requires verification credit after the last dirtying
  write. Loop-phase entry to `green` requires an active FID file; this is a
  presence check, not proof that its plan converged. `idle → green` is the
  Hybrid Mode path. See `tools/handlers/tool/transition-phase.ts` in the runtime.

### Circuit Breakers (per-session)

The FSM handler tracks `iterationCount` on AgentState. It increments on
`self_correct → green`, resets on `complete` or `idle`, and blocks entry to
`green` at the configured maximum (`perfection_loop.max_iterations`, default
10). See `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts`.
Change-size and oscillation requirements belong to the protocol's process
rules; the FSM iteration counter measures loop repetitions.

### Tool Gating (active)

Tool execution composes capability checks, containment/FSM gates, sandbox
policy, lifecycle hooks and EHEL. Runtime entrypoints are under
`packages/agent-runtime/src/tools/tool-executor/`; the table lists boundaries,
not blanket grants of permission.

| Tool | Allowed Phases | Status |
|------|---------------|--------|
| write_file, str_replace, apply_patch | GREEN + SELF_CORRECT (exempt paths: dev/fids/, dev/nova/, dev/scratchpad/) | ✅ Active |
| run_terminal_command (bash) | AUDIT + GREEN + SELF_CORRECT | ✅ Active (FID-2026-0806-016 F4) |
| sequentialthinking | Declared by the Thinker template | ✅ Capability allowlist + runtime convergence gate |
| code_search, read_files, glob, list_directory | ALL | ✅ No FSM phase restriction; capability/protocol checks still apply |
| spawn_agents | ALL, subject to declared spawnable agents and child limits | ✅ Active; optional plan validation imposes additional research constraints |
| Known destructive shell patterns | Denied before sandbox policy/dev override | ✅ Active denylist floor in `sandbox-gate.ts` and `sandbox/shell-denylist.ts` |
| create_fid, update_fid, archive_fid | Conceptual workflow operations | Not registered tool names; Recorder uses its actual file tools |

`run_readonly_command` validates its commands in its own handler. EHEL also
classifies command mutations for write accounting and worktree reconciliation;
mutation classification is not a universal destructive-command detector.
`execution-policy.ts` limits development overrides to explicitly non-strict
harness sessions; the destructive-pattern floor and EHEL remain authoritative.

### Lifecycle hooks (FID-2026-0814-003)

The tool executor exposes a project-scoped **hook system** declared in
`protocol.config.yaml` under `hooks:`. Hooks fire at lifecycle points
(`PreToolUse`/`PostToolUse`/`PostToolUseFailure` + session/subagent events) and
compose with the EHEL `beforeToolCall` gate — an **additional** gate, never a
bypass. Hooks are fail-open: only exit code 2 or a JSON
`"permissionDecision": "deny"` blocks a tool. See
`docs/design/hook-system.md`.

### Durable goal engine (FID-2026-0814-002)

The Orchestrator owns a durable, budgeted goal record on `agentState`
(`active | paused | blocked | complete`) driven by a continuation driver and
the `update_goal`/`get_goal` tools. See `docs/design/goal-mode.md`.

### Durable state discipline (FID-2026-1006-002)

One sentence governs every durable mutation: **compute one complete next state
in memory, then commit it atomically.** Two mechanisms enforce it.

- **Single durable-write seam** — every domain write in `@savant-code/database`
  (`sessions`, `message_history`, `cost_tracking`, `agent_templates`,
  `fid_documents`) flows through `runCommit()` in
  `packages/database/src/commit-journal.ts`, so the exact ordered write surface
  of a transaction is observable and asserted against
  `docs/durable-race-catalog.md` (`write-order-conformance.test.ts`).
- **Mutation line** — a next state that depends on the *stored* state is
  computed inside `mutateSessionState()` in
  `packages/database/src/mutation-line.ts`: the read happens inside a per-key
  lane, the transform's returned value is committed verbatim (never a
  field-wise blend of two writers' snapshots), and a mutation that throws
  seals its key — later mutations refuse with `MutationLineSealedError` rather
  than build on a state the line cannot vouch for.

Writing a whole snapshot with `updateSession()` is the *other* supported shape,
and is only correct when the caller already holds a complete next state (the
CLI's in-memory run state does; see `cli/src/utils/db-storage.ts`).

### Pure decision functions with an injected clock (FID-2026-1006-002 WP8)

Loop and orchestration decision logic is **one pure function of explicit
inputs** that returns a discriminated action union, and the clock is one of
those inputs (`now: number`) rather than something the module reads.
`determineNextAction()` in
`packages/agent-runtime/src/run-agent-step/loop-guard-rails.ts` is the
reference: no `Date.now()`, no I/O, no module state, and the same context always
yields the same action. The I/O shell that calls it stays thin — it supplies the
clock, performs the action, and owns nothing else. The convention is pinned by
`packages/agent-runtime/src/__tests__/pure-decision-convention.test.ts`, which
asserts the behaviour AND, statically, that the decision module's source
contains no clock read and no I/O access.

### Zero-Trust provenance (FID-2026-0813-001..010)

When provenance recording/enforcement is enabled, writes record per-role
Ed25519-signed receipts into an append-only hash-only session ledger
(`provenance.mode`: `off | record | enforce`). See
`docs/design/zero-trust-agentic-provenance.md`.

---

## Boot Sequence

The harness grounding set comprises `ECHO.md`, `ARCHITECTURE.md`,
`protocol.config.yaml`, `docs/embedded-learnings.md` and
`templates/FID-TEMPLATE.md`. The protocol generator embeds their full content
in `common/src/constants/protocol-bundle.generated.ts`. In embedded mode,
`common/src/util/embedded-protocol.ts` serves grounding reads from that bundle;
in local mode, project files supply them. Embedded delivery does not pre-credit
the grounding gate: the agent still has to read the documents.

The project workflow is:

1. Read the grounding documents — establish identity, architecture and laws
2. Use `protocol.config.yaml` — resolve project commands and configuration
3. Review `dev/fids/` — flag open FIDs
4. Record session documentation under `dev/session-summaries/YYYY-MM/`
   (the session-end organizer also groups dated files written at the root)
5. Enter IDLE phase — wait for user input

---

---

## Helper Tool Libraries, Infrastructure Agents and Source Directories

The roster defines **ten canonical ECHO roles**. Directory count and spawnable
template count measure different things: Researcher has web/docs definitions,
canonical roles have variants, and infrastructure helpers can themselves run
as independent child agents. For example, the orchestrator explicitly permits
`browser-use`, `database`, `github`, `basher`, `tmux-cli`, `context-pruner` and
`scribe-proposer` in `agents/savant/savant.ts`.

The source inventory checked on 2026-10-19 contains 21 immediate directories:

| Group | Directories | Purpose |
| --- | --- | --- |
| Canonical role definitions (10) | `savant`, `detective`, `forge`, `verifier`, `recorder`, `thinker`, `scout`, `researcher`, `scribe`, `adversary` | Ten logical roles with mode/model variants |
| Infrastructure/support (7) | `browser-use`, `context-pruner`, `database`, `github`, `librarian`, `scribe-proposer`, `tmux-cli` | Child-agent definitions and supporting modules; root `context-pruner.ts` and `tmux-cli.ts` use their corresponding directories |
| Additional helper definitions (2) | `editor`, `file-explorer` | Editor/best-of-N and directory/glob helper definitions |
| Shared types and tests (2) | `types`, `__tests__` | Definition contracts and workspace regressions |

Standalone source files such as `agents/basher.ts` add no directory. Generated
trace output such as `agents/debug/` may appear locally and is not a role or a
source-library invariant. Reconcile inventories against the checkout rather
than deriving role counts from filesystem arithmetic.

`packages/knowledge-graph/` is a separate workspace, not an `agents/` directory.
Detective and Scout call its native `query_blast_radius`, `query_node_edges`
and `query_domain_clusters` tools through runtime graph handlers. Verifier and
Thinker receive relevant graph evidence by injection without receiving graph
tools; Thinker retains its sequential-thinking tools and Verifier stays zero-tool.

**Current state:** The repository uses the `@savant-code/*` workspace names and import paths at version `0.0.36`.
Historical rebrand and checkpoint decisions remain in the archived session records and release history; this architecture
document tracks the current repository state.
