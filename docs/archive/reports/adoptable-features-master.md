# Adoptable Features & Ideas — Master Synthesis

> **Generated:** 2026-07-19
> **Scope:** 16 open-source coding agents / AI platforms scanned
> **Purpose:** Cross-cutting synthesis of the most impactful and novel ideas for improving savant-code
> **Method:** Independent Explore-agent scans of each repo → cross-cutting theme analysis
> **⚠️ Archival note (2026-07-23):** The `resources/` directory containing the 16 reference repos has been removed from disk. This synthesis and the companion `feature-parity-report.md` are preserved as historical research. The `docs/reports/repos/` subfolder retains the individual per-repo analysis files. Feature parity gaps identified here may have changed — run a fresh baseline pass before acting on any recommendation.
>
> **Superseded (2026-07-25):** A fresh scan of 116 repos was performed on 2026-07-25. The new master synthesis lives at [`adoptable-features-2026-07-25.md`](./adoptable-features-2026-07-25.md) and supersedes this document for the 116-repo scan. This 2026-07-19 master remains as historical research covering the original 16 repos; the 2026-07-25 report covers a broader ecosystem and incorporates spot-verification of high-impact claims against actual source.

---

## Executive Summary

Scanned 16 repositories spanning Python, TypeScript, Rust, and Go. The following synthesis ranks adoptable features by **impact on savant-code** (how much it improves the product) and **novelty** (how unusual the pattern is in the ecosystem). Features are grouped into **20 numbered items across 4 tiers** (Critical / High Impact / Medium Impact / Novel).

**The single highest-leverage adoption is the Extensibility Triad: MCP + Plugin SDK + Skills Marketplace.** Every mature agent in the ecosystem has converged on this unified pattern. savant-code currently has scattered primitives (an MCP client tool loader, 3 bundled MCP servers, a skills loader, 7 bundled skills) but no consolidated `packages/mcp/` workspace, no plugin SDK, and no skills marketplace — the same scaling ceiling the reference products solved by unifying these into a single extensibility surface.

---

## Tier 1: Critical (Must-Have for Parity)

### 1. MCP Client + Server

**The ecosystem has converged.** All 16 repos either implement or plan MCP support. savant-code has a **partial** MCP layer — a client tool loader (`packages/agent-runtime/src/mcp.ts`) with per-server failure isolation, a multi-source config merger (`sdk/src/agents/load-mcp-config.ts`) resolving project + user + env-var sources, and three bundled MCP servers in `research/servers-main/` (sequentialthinking, memory, filesystem) built on `@modelcontextprotocol/sdk/server/mcp.js`. **Gaps:** no dedicated `packages/mcp/` workspace, no OAuth, no InProcessTransport, no MCP proxy/namespace-mounting.

| Repo | Implementation |
|------|---------------|
| Agno | `tools/mcp/` — client + multi-MCP server merging |
| AionUi | Centralized MCP management, "configure once, sync to all" |
| Cline | Full client with OAuth, policy enforcement, settings sync |
| Codex | Bidirectional (client + server), plugin-contributed MCP |
| Gemini CLI | Full client with per-agent MCP servers |
| Goose | 70+ MCP server extensions via ExtensionManager |
| Hermes | Full client with sampling, parallel tool calls |
| OpenCode | Full client with OAuth, InProcessTransport |
| OpenHands | Server + proxy pattern (namespace-mount remote servers) |
| OpenClaude | InProcessTransport, SDK control transport bridge |
| OpenClaw | Bidirectional with channel bridging |
| Zero | Bidirectional (client + server), OAuth |

**Adoptable patterns:**

- **InProcessTransport** (OpenCode) — Run embedded MCP servers without subprocess overhead
- **Multi-MCP merging** (Agno) — Connect to multiple servers, merge tools into single namespace
- **MCP proxy** (OpenHands) — Namespace-mount remote servers without exposing API keys
- **Per-agent MCP servers** (Gemini CLI) — Agent-specific tool ecosystems
- **Malware checking** (Goose) — Query OSV for MAL-* advisories before running npm/PyPI packages

**Impact:** Critical — unblocks every subsequent feature adoption
**Effort:** Medium (consolidate existing `mcp.ts` + `load-mcp-config.ts` + `research/servers-main/` into `packages/mcp/`; add OAuth + InProcessTransport; not a from-scratch build)

---

### 2. Plugin / Extension SDK

**Every mature agent has a plugin system.** savant-code has a **partial** skills surface — `packages/agent-runtime/src/tools/handlers/tool/skill.ts` is a runtime skill loader with frontmatter validation, multi-directory search (`~/.agents/skills/`, `~/.claude/skills/`, project `.agents/skills/`, `.claude/skills/`), and 7 bundled skills (`.agents/skills/`: coding-csharp, coding-go, coding-java, coding-python, coding-rust, coding-typescript, release-workflow). **Gaps:** no plugin SDK, no plugin manifest schema, no plugin sandbox, no marketplace/registry, no contribution points.

| Repo | Pattern |
|------|---------|
| Agno | PluginManager with discovery |
| AionUi | `aion-extension.json` manifest with 7 contribution points |
| Cline | Contribution-based (tools, commands, rules, message builders, providers, MCP, shortcuts, flags) |
| Codex | Plugin directory with skills, MCP servers, hooks, apps |
| Goose | Dual format (Gemini + OpenPlugins), auto-update |
| Hermes | 4-source discovery (bundled, user, project, pip) |
| OpenClaw | 159 extensions with typed SDK (150+ subpath exports) |
| Zero | `plugin.json` manifest (tools, hooks, skills) |

**Adoptable patterns:**

- **Manifest-based plugins** (AionUi, Zero, OpenClaw) — JSON manifests declare capabilities without code
- **Contribution points** (AionUi) — VS Code-style `contributes` pattern
- **4-source discovery** (Hermes) — Bundled → user → project → entry points
- **Plugin sandbox** (Cline `SubprocessSandbox`) — IPC-based isolation with auto-reinit on crash
- **Plugin hooks for system transform** (Kilo) — `experimental.chat.system.transform`, `experimental.session.compacting`

**Impact:** Critical — force multiplier for every other feature
**Effort:** Medium-High (plugin loader, manifest schema, sandbox)

---

### 3. Provider Architecture (25+ Providers)

**savant-code supports ~8 model prefixes.** The references support 25-150+.

| Repo | Count | Pattern |
|------|-------|---------|
| Agno | 54 | Per-provider adapter classes |
| AionUi | 30+ | ClientFactory / RotatingApiClient |
| Cline | 10+ | Provider handlers with Zod validation |
| Codex | 25+ | Provider-neutral CompletionRequest/StreamEvent |
| Gemini CLI | 5+ | Composite routing strategy |
| Goose | 15+ | Declarative YAML-based custom providers |
| Hermes | 35 | Plugin-based providers |
| OpenCode | 10+ | **Four-axis route: Protocol/Endpoint/Auth/Framing** |
| OpenHands | 5+ | LiteLLM-based |
| OpenClaude | 20+ | OpenAI shim normalization |
| OpenClaw | 30+ | Extension-based with auth rotation |
| Zero | 25+ | Provider-neutral runtime types |

**Recommended adoption: OpenCode's Four-Axis Route Architecture.** DeepSeek, TogetherAI, Cerebras all reuse `OpenAIChat.protocol` — each provider deployment is 5-15 lines. Bug fixes propagate to every consumer. Rationale: orthogonal axes are more maintainable than per-provider adapter classes (Agno, Hermes) or declarative YAML (Goose) for savant-code's TypeScript monorepo.

**Adoptable patterns:**

- **Four-axis decomposition** (OpenCode/Kilo) — Protocol, Endpoint, Auth, Framing as orthogonal axes
- **Auth profile rotation with cooldown** (OpenClaw) — Mark failures, track cooldown expiry, select soonest-available
- **Provider-neutral runtime types** (Zero) — `CompletionRequest`/`StreamEvent` decoupled from provider specifics
- **Declarative providers** (Goose) — YAML config instead of code for new providers

**Impact:** Critical — provider breadth is table stakes
**Effort:** Medium (refactor `getModelForRequest()` into registry + routing)

---

### 4. Context Compaction

**Every agent hits context limits.** How they manage it varies dramatically.

| Repo | Pattern |
|------|---------|
| Aider | Recursive split-then-summarize with logical boundaries |
| Cline | Chunked compaction with payload recovery |
| Codex | Multi-strategy with hook integration and replacement history |
| Gemini CLI | Graph-based with processor pipeline |
| Goose | Inline in reply loop with stop-hook gating |
| Hermes | Structured summary with Resolved/Pending questions |
| OpenCode | **Durable session runner with structured Markdown summary** |
| OpenClaw | Staged summarization with identifier preservation |
| Zero | **Proactive + reactive with per-provider calibration** |
**Recommended adoptions:**

1. **OpenCode** — Structured summary template (Objective, Work State, Next Move, Relevant Files) preserves actionable state
2. **Zero** — Proactive (before provider call) + reactive (after context-limit error) dual-path with per-provider calibration
3. **OpenClaw** — Identifier preservation (UUIDs, hashes, URLs not summarized away)

**Adoptable patterns:**

- **Structured summary template** (OpenCode) — Preserve file paths, error strings, commands
- **Proactive + reactive dual-path** (Zero) — Don't wait for context-limit error
- **Identifier preservation** (OpenClaw) — Don't lose FIDs, SHAs, paths during summarization
- **Turn-boundary widening** (Zero) — Never split tool_use/tool_result pairs

**Impact:** Critical — essential for long-running sessions
**Effort:** Medium (new compaction module in agent-runtime)

---

## Tier 2: High Impact (Strongly Recommended)

### 5. Multi-Agent Orchestration

| Repo | Pattern |
|------|---------|
| AionUi | Team mode with mailbox + task dependency graph |
| Cline | AgentTeamsRuntime with persistence, completion guard |
| Codex | Role-based registry with config layering |
| Gemini CLI | Subagent with complete_task + acknowledgement |
| Goose | Delegate/Summon with background tasks |
| Hermes | Kanban work queue + delegation with role-based tool blocking |
| OpenClaw | Subagent registry with SQLite persistence |
| Zero | **Swarm with mailbox-based communication + task handoff** |

**Recommended adoption: Zero's Swarm.** Mailbox-based inter-agent communication (not just parent-child), task handoff between agent types, channel-based `WaitSettled` (not polling), deferred tool loading that adapts to swarm state. Rationale: more mature than parent-child spawning (Cline, Gemini CLI); SQLite-persisted alternatives (OpenClaw) are heavier than savant-code's 10-agent roster needs.

**Adoptable patterns:**

- **Mailbox-based communication** (Zero) — More mature than parent-child spawning
- **Task handoff between agent types** (Zero) — Agents can transfer work to specialists
- **Completion guard** (Cline) — Prevents premature exit while tasks are in progress
- **Role-based tool blocking** (Hermes) — Leaf vs orchestrator tool restrictions
- **Agent acknowledgement** (Gemini CLI) — User must approve unknown agent definitions

**Impact:** High — savant-code's 10-agent roster needs production-grade orchestration
**Effort:** High (new orchestration layer)

---

### 6. Tool Search / Deferred Loading

**As tool count grows, context windows fill with schemas.** The solution: defer and discover.

| Repo | Pattern |
|------|---------|
| OpenClaude | `ToolSearchTool` — keyword search + direct selection |
| OpenClaw | `tool_search` / `tool_describe` / `tool_call` — code mode variant |
| Zero | **State-dependent un-deferral** — coordination tools surface when swarm exists |

**Recommended adoption: Zero's state-dependent un-deferral.** Tools are advertised as compact lines. The agent searches by name/description and loads matching tools. Coordination tools automatically surface when a swarm becomes active. Rationale: state-dependent surfacing is more adaptive than OpenClaude/OpenClaw's keyword-search-only variants.

**Impact:** High — prevents tool bloat from overwhelming context
**Effort:** Medium (tool registry refactor)

---

### 7. Execution Policy / Safety Engine

| Repo | Pattern |
|------|---------|
| Codex | **Starlark rules** — prefix matching, host executable resolution, self-validating rules |
| Gemini CLI | **Wildcard policy rules** with multi-dimensional matching (tool, args regex, MCP server, annotations) |
| Kilo | Profile-based sandboxing (filesystem/network/environment) |
| OpenCode | Wildcard pattern matching with composable rulesets |
| SWE-agent | Command blocklist with prefix/exact/regex matching |
| Zero | **Dual-layer** — tool metadata + sandbox with structured Block codes |

**Recommended adoption: Zero's dual-layer model.** Tool-level permission metadata PLUS sandbox engine evaluation. Structured `Block` codes (`symlink_traversal`, `destructive_command`, `outside_workspace`) give agents actionable denial reasons. Command-prefix grants (`allow_prefix_for_session`) approve a class of commands once. Rationale: structured block codes are more actionable for agents than Codex's Starlark rules or Gemini CLI's wildcard patterns alone.

**Impact:** High — safety is non-negotiable for autonomous agents
**Effort:** Medium (policy engine + sandbox integration)

---

### 8. Hook System

| Repo | Events | Notable Pattern |
|------|--------|-----------------|
| Cline | 7 | `beforeModel` can inject messages and modify tools per-request |
| Codex | 11 | Full lifecycle including SubagentStart/Stop |
| Gemini CLI | 10 | **BeforeModel synthetic responses** (bypass model call entirely) |
| Goose | 11 | Regex-matched, `Stop` hook can block |
| SWE-agent | 3 layers | Agent/Env/Run with Combined dispatch |
| Zero | 6 | stdin-JSON payload (not env vars), audit trail |

**Recommended adoption: Gemini CLI's BeforeModel synthetic responses.** A hook can return a synthetic LLM response, completely bypassing the model call. Enables caching, testing, and safety interception. Rationale: model-call bypass is a capability no other repo's hook system offers; high leverage for savant-code's AUDIT phase.

**Impact:** High — extensibility without core changes
**Effort:** Low-Medium (hook registry + dispatcher)

---

### 9. Repo Map / Code Intelligence

| Repo | Pattern |
|------|---------|
| Aider | **PageRank + tree-sitter** — graph-based with 10x snake_case weight, 0.1x private identifier weight |
| Gemini CLI | Graph-based context management with typed nodes |
| Kilo | Tree-sitter indexing with language detection |
| OpenClaude | **PageRank + tree-sitter** with file-stat fingerprinting cache |
| Zero | Deterministic repo map, 4 KiB cap |

**Recommended adoption: Aider's PageRank approach.** Builds a directed graph of identifier references, runs personalized PageRank, ranks files by importance relative to chat context. Token-budgeted output. The key insight: PageRank is more principled than embedding-based retrieval for code navigation. Rationale: deterministic, debuggable, and cheaper than embedding-based retrieval; OpenClaude's file-stat fingerprinting cache is a useful optimization to layer on top.

**Impact:** High — codebase understanding is essential for multi-agent coding
**Effort:** Medium (extend `packages/code-map/` with PageRank)

---

### 10. Memory System

| Repo | Pattern |
|------|---------|
| Agno | Strategy-based memory (summarize) with 24 vector DB backends |
| Codex | **Two-phase pipeline** — extraction (parallel) → consolidation (git-baseline diff) |
| Hermes | FTS5 session search + pluggable backends (8 providers) |
| Kilo | Indexed search with secret filtering |
| OpenClaude | Auto-dream (24h time gate, 5+ session gate, lock) |
| OpenClaw | **Dreaming** — light (periodic) and REM (deeper consolidation) |
| OpenCode | System Context Algebra with source-based composition |

**Recommended adoption: Codex's two-phase pipeline.** Phase 1 extracts structured memories from completed conversations (parallel with concurrency caps). Phase 2 consolidates into workspace artifacts via git-baseline diff. DB-backed job claiming, lease management, watermark tracking. Rationale: two-phase extraction doesn't block the agent loop (unlike Hermes' inline strategy); OpenClaw's dreaming + OpenClaude's auto-dream gating are useful as the consolidation scheduler.

**Adoptable patterns:**

- **Two-phase extraction → consolidation** (Codex) — Don't block the agent loop
- **Dreaming** (OpenClaw) — Background cron during idle periods
- **Auto-dream gating** (OpenClaude) — Cheap checks first (time → session count → lock)
- **Secret filtering** (Kilo) — Prevent accidental credential leakage
- **Identifier preservation** (OpenClaw) — Don't summarize away FIDs/SHAs

**Impact:** High — cross-session learning is a key differentiator
**Effort:** Medium-High (memory subsystem)

---

## Tier 3: Medium Impact (Recommended)

### 11. Eval / Testing Framework

| Repo | Pattern |
|------|---------|
| Aider | Polyglot benchmark + SWE-bench with Docker isolation |
| Cline | 3-layer pyramid (contract → smoke → E2E) with pass@k metrics |
| Gemini CLI | **Behavioral eval with dynamic baselines** — nightly scoring, automated promotion |
| OpenHands | YAML-defined QA scenarios with maturity scoring |
| Zero | **Process-level assertions** — required trace events, forbidden changed files |

**Recommended adoptions:**

1. **Gemini CLI** — Dynamic baseline verification (fails on main → marked "Pre-existing"), trustworthiness filter (60%+ per-night), automated promotion from USUALLY→ALWAYS
2. **Zero** — `requiredTraceEvents` tests process, not just output. `forbiddenChangedFiles` prevents overreach.

**Impact:** Medium — essential for quality assurance
**Effort:** Medium (extend `evals/` package)

---

### 12. Scheduling / Cron

| Repo | Pattern |
|------|---------|
| AionUi | Conversation-bound or new-conversation, keep-awake |
| Cline | Markdown spec files with YAML frontmatter |
| Goose | Runs actual agent sessions (not just shell commands) |
| Hermes | Natural language scheduling, job chaining |
| OpenClaude | In-memory and durable modes |
| OpenClaw | Production-grade with heartbeat, pacing, retry |
| Zero | Built-in recipes (git-recap, ci-watch, todo-pulse) |

**Adoptable patterns:**

- **Markdown-based specs** (Cline) — Developer-friendly, version-controllable
- **Recipe presets** (Zero) — Pre-configured common tasks
- **Conversation-bound execution** (AionUi) — Preserves context history
- **Full-context scheduled execution** (Goose) — Runs agent sessions, not shell commands

**Impact:** Medium — enables automated workflows
**Effort:** Low-Medium (cron module + CLI command)

---

### 13. LSP Integration

| Repo | Pattern |
|------|---------|
| OpenCode | Diagnostics, symbol lookup, document symbols |
| OpenClaude | Symbol information, diagnostics, formatting |
| Zero | **Background async diagnostics** — non-blocking file checking |

**Recommended adoption: Zero's background async diagnostics.** Checks changed files for errors asynchronously rather than blocking the agent loop. Rationale: non-blocking is the right tradeoff for savant-code's Perfection Loop — diagnostics inform AUDIT without stalling GREEN.

**Impact:** Medium — improves code understanding and post-edit verification
**Effort:** Low-Medium (LSP client in agent-runtime)

---

### 14. Session Management (Fork/Rewind/Steer)

| Repo | Pattern |
|------|---------|
| Agno | Session forking for branching explorations |
| Codex | Fork (branch) + rollback |
| OpenCode | **Steer/Queue input delivery** — mid-execution intervention |
| OpenClaude | Session resume & fork |
| Zero | Resume/fork/rewind with append-only event log |

**Recommended adoption: OpenCode's Steer/Queue.** `steer` promotes user input at next safe boundary (resets step count). `queue` ensures ordered processing. Solves the "user types while agent is working" problem. Rationale: safe-boundary promotion is more robust than Agno's session forking or Codex's thread/fork for interactive savant-code sessions.

**Impact:** Medium — better UX for interactive sessions
**Effort:** Medium (session input manager)

---

### 15. Git Worktree Isolation

| Repo | Pattern |
|------|---------|
| Kilo | Full lifecycle with Windows fsmonitor cleanup |
| OpenCode | Clean isolation with revert support |
| OpenClaude | Enter/exit with state persistence |
| Zero | First-class worktree support |

**Impact:** Medium — parallel work without branch conflicts
**Effort:** Low (git worktree commands)

---

## Tier 4: Novel / Worth Noting

### 16. Adaptive Self-Regulation (Zero's Execution Profile Controller)

**The most novel pattern in the ecosystem.** Observes per-turn signals (tool failure streak, risky mutations, self-correct failures) and one-shot escalates loop parameters (turn ceiling, reasoning effort, completion gate). Safety: escalation targets are the displaced values — can never introduce unauthorized knobs.

**Impact:** High novelty, medium direct impact
**Effort:** Medium

### 17. Completion Policy (Zero's Headless Gating)

**Solves a real problem.** In headless/CI mode, validates that the agent actually finished work before declaring success. Checks for pending plan items, continuation cues, task-grounded acceptance.

**Impact:** High novelty, high for CI/automation
**Effort:** Low-Medium

### 18. ACI Design Philosophy (SWE-agent)

**Tool design matters more than tool availability.** Curated, agent-optimized surfaces (windowed file viewer, linting-gated editors, succinct search) dramatically outperform raw shell access.

**Impact:** High principle, medium implementation
**Effort:** Medium (tool redesign)

### 19. JIT Context Discovery (Gemini CLI)

**Load subdirectory context on-demand.** When a tool accesses a file/directory, dynamically discover and load project instruction files from that path. Crucial for large monorepos.

**Impact:** Medium, high for monorepos
**Effort:** Low

### 20. Prompt Cache Warming (Aider)

**Background thread keeps Anthropic prompt caches alive.** Periodic pings prevent cache expiration during long sessions.

**Impact:** Medium (cost optimization)
**Effort:** Low

---

## savant-code Differentiators to Preserve

During parity work, these unique strengths must be preserved:

| Differentiator | Evidence |
|---------------|----------|
| **ECHO Protocol governance** | FID-bound Perfection Loop + 9-role separation of duties |
| **Free-tier model catalog** | `savant-free-models.ts` — MiniMax M3, DeepSeek V4, MiMo, Kimi, GLM, HY3 |
| **Disciplined small roster** | 9 fixed, well-scoped agents vs. open-ended dynamic spawning |
| **ChatGPT-OAuth direct route** | Responses-API ↔ Chat-Completions transform |

---

## Prioritized Adoption Roadmap

### Phase 0 — Extensibility Foundation (unblocks everything)

1. **MCP consolidation** — promote existing `packages/agent-runtime/src/mcp.ts` + `sdk/src/agents/load-mcp-config.ts` + `research/servers-main/` (sequentialthinking, memory, filesystem) into a `packages/mcp/` workspace; add OAuth + InProcessTransport + MCP proxy/namespace-mounting. Not a from-scratch build.
2. **Plugin loader + manifest schema** (`extensions/` dir) — savant-code has no plugin SDK today (only a skills loader); build manifest-based plugins modeled on AionUi `aion-extension.json` / Zero `plugin.json`.
3. **Skills marketplace** — savant-code has a runtime skill loader (`packages/agent-runtime/src/tools/handlers/tool/skill.ts`) and 7 bundled skills (`.agents/skills/`); gap is a registry/marketplace (ClawHub-style) + remote skill discovery (OpenCode `skill/discovery.ts`).

### Phase 1 — Provider & Context

4. **Provider registry** (promote `getModelForRequest()` to 4-axis architecture)
5. **Context compaction** (structured summary + proactive/reactive dual-path)
6. **Repo map** (PageRank + tree-sitter)

### Phase 2 — Safety & Orchestration

7. **Execution policy engine** (wildcard rules + structured block codes)
8. **Multi-agent orchestration** (mailbox-based with completion guard)
9. **Tool search / deferred loading**

### Phase 3 — Intelligence & Memory

10. **Hook system** (7+ events with BeforeModel synthetic responses)
11. **Memory system** (two-phase extraction → consolidation)
12. **LSP integration** (background async diagnostics)

### Phase 4 — Automation & Quality

13. **Cron scheduler** (markdown specs + recipe presets)
14. **Eval framework** (3-layer pyramid + process-level assertions)
15. **Session fork/rewind**

---

## Evidence Index

**Individual repo reports:** `docs/reports/repos/{agno,aider,AionUi,cline,codex,gemini-cli,goose,gpt-pilot,kilocode,opencode-dev,OpenHands,SWE-agent,hermes-agent,openclaude,openclaw,zero}.md`

**Companion parity report:** `docs/reports/feature-parity-report.md` (16-repo product-first
analysis — per-repo snapshots, 6 category gap matrices, detailed per-gap evidence). This
master synthesis is the feature-first counterpart (20 numbered features, each with per-repo
comparison tables and "Recommended adoption" picks).

**Source repos:** `resources/{agno,aider,AionUi,cline,codex,gemini-cli,goose,gpt-pilot,kilocode,opencode-dev,OpenHands,SWE-agent,hermes-agent,openclaude,openclaw,zero}/`

---

## Synthesis-Audit Note

> **Added 2026-07-20.** This master synthesis was originally sourced from `docs/reports/feature-parity-report.md` (2026-07-19) for the savant-code baseline. A re-verification pass against the actual codebase found two false "absent" claims that have been corrected in this revision:
>
> 1. **MCP** — savant-code has a partial MCP layer (client tool loader + multi-source config merger + 3 bundled MCP servers), not "none." Gap is consolidation into `packages/mcp/`, OAuth, and InProcessTransport.
> 2. **Skills** — savant-code has a runtime skill loader (`packages/agent-runtime/src/tools/handlers/tool/skill.ts`) and 7 bundled skills (`.agents/skills/`), not "compiles all capabilities into the core." Gap is a plugin SDK, manifest schema, sandbox, and marketplace/registry.
>
> **Unverified claims remaining:** The "no plugin SDK / no plugin sandbox" claims are accurate (no plugin-loader code in workspace). Other savant-code baseline claims (no OS sandbox, no cron, no persistent memory, no LSP integration, ~8 model prefixes, 2-branch `getModelForRequest()`) were spot-checked and confirmed accurate as of 2026-07-20.
>
> **Recommendation:** Before Phase 0 work begins, run a fresh savant-code baseline pass (independent of this report) to catch any further drift between the reports and the live codebase.

---

*End of master synthesis.*
