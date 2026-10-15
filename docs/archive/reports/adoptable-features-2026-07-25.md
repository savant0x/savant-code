# Adoptable Features & Ideas — Master Synthesis (2026-07-25)

> **Generated:** 2026-07-25
> **Scope:** 116 open-source repositories scanned in `resources/`
> **Purpose:** Cross-cutting synthesis of the most impactful and novel ideas for improving savant-code, sourced from a fresh deep review
> **Method:** Orchestrator extracted README inventory for all 116 repos → 6 parallel general sub-agents deep-read README + key source files per repo, returning path-cited findings per the ECHO Cross-Agent Claim Rule (`ECHO.md:275-286`) → Orchestrator spot-verified 3 high-impact claims against actual source (os-moda ledger, goose compaction, cline checkpoints — all confirmed) → consolidated into capability-gap-organized synthesis
> **Predecessor:** [`adoptable-features-master.md`](./adoptable-features-master.md) (2026-07-19, 16-repo scan, archived). This document supersedes it for the 2026-07-25 scan of 116 repos; the predecessor remains as historical research.

---

## Executive Summary

Scanned 116 repositories spanning TypeScript, Python, Rust, Go, Swift, and Zig. The synthesis below ranks adoptable features by **impact on savant-code** (how much it improves the product) and **novelty** (how unusual the pattern is relative to savant-code's existing ECHO Protocol governance). Features are grouped into **28 numbered items across 4 tiers** (Critical / High Impact / Medium Impact / Novel), organized by capability gap rather than by source repo. Where multiple repos solved the same gap, they are combined with comparison tables.

**The single highest-leverage adoption is the Audit + Isolation Triad: tamper-evident ledger + git worktree-per-FID + git-ref checkpoints.** Savant-Code's FID lifecycle is documented in trivially-editable markdown with no integrity guarantee, Forge writes directly to the workspace with no isolation, and the Perfection Loop's SELF-CORRECT has no per-run checkpoint to roll back to. These three capabilities compose: every FID transition gets hash-chained, every Forge run happens in an isolated worktree, and every Perfection Loop iteration gets a git-ref checkpoint the Verifier can roll back to on test failure. Together they transform the FID lifecycle from a document-based gentlemen's agreement into a tamper-evident, crash-safe, rollback-capable system.

**Spot-verification performed by the Orchestrator (not sub-agent-reported):**

- `os-moda/crates/agentd/src/ledger.rs:1-50` — `Event` struct, `GENESIS_PREV_HASH`, WAL pragma confirmed
- `goose/crates/goose/src/context_mgmt/mod.rs:227-256` — `filter_tool_responses`, middle-out removal confirmed
- `cline/sdk/packages/core/src/hooks/checkpoint-hooks.ts:1-20` — `CheckpointEntry`/`CheckpointMetadata` confirmed

**Per the Cross-Agent Claim Rule (`ECHO.md:280-283`):** The remaining features are based on sub-agent reports that cite paths but the Orchestrator has not personally read every line. Before implementing any feature, re-verify the cited path against current source.

---

## Tier 1: Critical (Must-Have for Production-Grade FID Lifecycle)

### 1. Tamper-Evident Audit Ledger

Savant-Code's FID lifecycle (`dev/fids/`, `dev/session-summaries/`, `CHANGELOG.md`) is plain markdown — trivially editable, no integrity guarantee. Three repos solve this independently:

| Repo | Pattern | Source |
|------|---------|--------|
| os-moda | Hash-chained SQLite ledger; `hash = SHA-256(id\|ts\|type\|actor\|payload\|prev_hash)` pipe-delimited; WAL + synchronous=FULL; FTS5 virtual table with BM25 + Porter stemming; `verify()` walks chain recomputing every hash; `incidents` + `incident_steps` tables | `crates/agentd/src/ledger.rs:10-21,102-117,291-330,379-439` |
| bernstein | HMAC-chained Merkle lineage spine; `.sdd/lineage/<run_id>/spine.jsonl`; `entry_hash = H(prev_hash, artifact_path, content_hash, actor, step_id, model, timestamp)` + HMAC tag; `verify` names first divergent step | `src/bernstein/core/lineage/spine.py:1-36,88-100` |
| bernstein | Durable work ledger (crash-safe resume); hash-chained JSONL; `ledger resume` verifies chain end-to-end, rebuilds scheduler state by deterministic replay; secrets scrubbed before hashing | `README.md:81` |

**Recommended adoption:** os-moda's SQLite+FTS5 design. Append-only SQLite is the right substrate for Savant-Code's TypeScript monorepo (Bun has native SQLite); FTS5 gives full-text search over event history for free; WAL + synchronous=FULL is the correct durability profile. Layer bernstein's `ledger resume` deterministic-replay semantics on top for crash recovery.

**Impact:** Critical — every FID transition + every Forge/Verifier tool call gets hash-chained; tamper-evident, offline-verifiable via `savant verify-ledger`
**Effort:** High (new `packages/audit-ledger/` workspace; hash chain, FTS5, verify CLI, incident workspaces)

---

### 2. Git Worktree-per-FID with Rollback

Savant-Code's Forge writes directly to the workspace. Multiple repos solve this at different trust levels:

| Repo | Pattern | Source |
|------|---------|--------|
| kagan | Worktree-per-task with rollback on failure; creates git worktree on `kagan/<slug>` BEFORE registering plugin or running setup; if anything after worktree creation fails, rolls back by removing worktree + branch; `taskWorktreePath()` derives stable path from `Bun.hash(mainWorktree)` | `src/task/create.ts:21-66`, `src/git/runner.ts:78-82` |
| kilocode | Worktree-as-session with create/list/remove/reset; `Worktree` service at `~/.local/share/{app}/worktree/{projectId}/{slug}`; `reset` does `git fetch` + `git reset --hard {defaultBranch}` + `git clean -ffdx` + `git submodule update --init --recursive --force` | `packages/opencode/src/worktree/index.ts:191-310,536-622` |
| brood-box | COW snapshot + per-file review with hash-verified flush (TOCTOU protection); `FSFlusher.Flush()` re-verifies SHA-256 of each snapshot file before copying; refuses with "file modified between diff and flush"; `O_NOFOLLOW` to avoid symlinks; strips setuid/setgid/sticky bits; VM stopped before review | `internal/infra/review/flusher.go:34-122`, `internal/infra/review/reviewer.go:77-120` |
| OpenHands | Docker sandbox service; `DockerSandboxService` + `SandboxService` abstract interface + `ProcessSandboxService` (local fallback) + `RemoteSandboxService` (cloud); user-scoped access control, lifecycle | `openhands/app_server/sandbox/` |
| zed | Per-thread sandbox grants with `allow_unsandboxed` escape hatch; macOS Seatbelt, Linux Bubblewrap, Windows Bubblewrap-via-WSL; `.git` dirs protected | `crates/agent/src/sandboxing.rs:1-77` |

**Recommended adoption:** kagan's worktree-per-FID as the foundation (TypeScript-native, `Bun.hash` for stable paths, clean rollback on failure). Layer brood-box's hash-verified flush when Verifier needs TOCTOU protection on promotion. Reserve OpenHands Docker sandbox for untrusted-codebase onboarding.

**Impact:** Critical — parallel FIDs don't collide; failed GREEN attempts leave zero trace; Verifier runs tests in isolation
**Effort:** Medium (worktree service in `packages/agent-runtime/`; FID-to-worktree mapping in Recorder)

---

### 3. Git-Ref Checkpoints per Perfection Loop Iteration

Savant-Code's Perfection Loop has SELF-CORRECT but no per-run checkpoint to roll back to.

| Repo | Pattern | Source |
|------|---------|--------|
| cline | Git-ref-based checkpoints with runCount; stores each agent run as private git ref `refs/cline/checkpoints/{sessionId}/{runCount}` plus a stash; `CheckpointMetadata { latest, history }` persisted in session metadata; `compareCheckpointToWorkspace` returns `CheckpointWorkspaceCompareResult` for diff/restore | `sdk/packages/core/src/hooks/checkpoint-hooks.ts:7-15,97-140,155+` |
| zero | `/rewind` session rollback; temporal undo of conversation + agent state (distinct from `/resume` which continues) | `README.md:207` |
| os-moda | SafeSwitch (deploy with TTL probation + health checks + auto-rollback); `SwitchSession { ttl_secs, health_checks, previous_generation, status }`; `HealthCheck` enum: SystemdUnit/TcpPort/HttpGet/Command; auto-rollback to previous generation on failure | `crates/osmoda-watch/src/switch.rs:4-45,47-90` |

**Recommended adoption:** cline's git-ref checkpoint pattern as the foundation (TypeScript-compatible via `child_process` git calls). Each Perfection Loop iteration gets `refs/savant/checkpoints/{fidId}/{iteration}/`; on AUDIT failure, Verifier can `git reset` to the last-known-good checkpoint instead of re-running RED→GREEN. Layer os-moda's SafeSwitch TTL+health-check pattern for the AUDIT phase.

**Impact:** Critical — bad GREEN edits can be cleanly undone at the session level; AUDIT failures don't require full RED→GREEN re-runs
**Effort:** Medium (checkpoint service in `packages/agent-runtime/`; FID-iteration-to-ref mapping in Recorder)

---

### 4. SpendMeter — Per-Agent Per-UTC-Day Token+USD Kill-Switch

Savant-Code has no token tracking UI, no spend cap, no per-agent budget. The Perfection Loop's circuit breaker (max 10 iterations) bounds iterations but not cost.

| Repo | Pattern | Source |
|------|---------|--------|
| os-moda | `SpendMeter.check()` called BEFORE model invoke; accumulates per-agent per-UTC-day; over-cap refuses with typed `spend_cap_exceeded` + human reason; alerts at 80%/100% (warn/halt), once per threshold per day; `0`/undefined = unlimited | `packages/osmoda-gateway/src/spend.ts:1-119` |
| agenttrace | Loop fingerprinting + loop-waste cost attribution; `loop_fingerprints()` groups repeated tool calls by `(tool_name, result_hash)`; `loop_cost()` computes retry_cost + tool_loop_cost as $ wasted; `loop_waste_percent()` | `crates/agenttrace-core/src/diagnostics.rs:43-52,248-259` |
| forge | Token-source bucket classifier (5 buckets); splits input tokens into instructions/tool_definitions/tool_results/repo_reads/prose; chars/4 estimate; self-consistency check (sum within ±10% of total) | `scripts/forge-token-bucket.cjs:1-80` |
| cc-tempo | Active-work-time parser from transcript JSONL; computes real wall-clock work time (not inflated `api_duration_ms`); 3 idle protections that only ever reduce time; parallel SubAgents don't inflate | `bin/calc_active_time.py:1-182` |

**Recommended adoption:** os-moda's SpendMeter as the foundation (TypeScript-native, `state/spend.json` persistence, per-UTC-day reset). Layer agenttrace's loop-waste attribution and forge's 5-bucket classifier. cc-tempo's active-work-time parser feeds the statusline.

**Impact:** Critical — runaway budgets go undetected today; per-FID spend cap prevents a single bad FID from burning unbounded budget
**Effort:** Low for SpendMeter (single file, ~120 lines); Medium for full observability stack

---

## Tier 2: High Impact (Strongly Recommended)

### 5. Context Compaction Pipeline

Savant-Code's Hybrid Mode can hit context limits on long FID-bound tasks. The predecessor report (2026-07-19, item 4) recommended OpenCode's structured summary; the 2026-07-25 scan found richer patterns.

| Repo | Pattern | Source |
|------|---------|--------|
| goose | Progressive compaction with middle-out tool-response removal; on `ContextLengthExceeded`, `do_compact` retries with progressively larger removal percentages `[0,10,20,50,100]`; `filter_tool_responses` removes tool-response messages from the middle outward (preserves most recent + oldest) | `crates/goose/src/context_mgmt/mod.rs:227-275,277-351,432-595` |
| SWE-agent | Pluggable HistoryProcessor pipeline; `AbstractHistoryProcessor.__call__(history) -> History` protocol; YAML-configurable; `ClosedWindowHistoryProcessor` (replaces old file-view windows with "Outdated window with N lines omitted"), `CacheControlHistoryProcessor` (sets Anthropic `cache_control: {type: ephemeral}` on last N messages), `RemoveRegex` (strips `<diff>.*</diff>`) | `sweagent/agent/history_processors.py:13-17,215-258,261-302,305-337` |
| entroly | Cache Aligner; hashes injected context per-client; if new context is >90% similar (Jaccard over tokens), reuses previous version verbatim to preserve provider prefix cache (~90% read discount on cached prefixes) | `entroly/cache_aligner.py:1-20,45-113` |
| hermes-agent | Prompt caching as sacred invariant; hard rule: never alter past context mid-conversation, never swap toolsets, never reload memories — anything that mutates past context invalidates prefix cache and multiplies cost; slash commands that mutate system-prompt state default to deferred invalidation | `AGENTS.md` |

**Recommended adoption:** Compose all four. Goose's progressive compaction as the reactive engine; SWE-agent's pluggable pipeline as the architecture (configure per-phase in `protocol.config.yaml`); entroly's Cache Aligner for cache preservation; hermes-agent's sacred-invariant rule as an explicit runtime constraint (FID state injected once per session, not re-injected per turn).

**Impact:** High — essential for long-running FID-bound sessions; preserves prompt-cache hits (cost multiplier)
**Effort:** Medium (new compaction module in `packages/agent-runtime/`; pipeline config in `protocol.config.yaml`)

---

### 6. Background Memory Pipeline

Savant-Code's `dev/LEARNINGS.md` is flat unstructured prose. The predecessor report (2026-07-19, item 10) recommended Codex's two-phase pipeline; the 2026-07-25 scan found complementary patterns.

| Repo | Pattern | Source |
|------|---------|--------|
| codex | 2-phase background memory pipeline; Phase 1: per-rollout extraction (async bounded jobs, parallel with concurrency cap, produce `raw_memory` + `rollout_summary`, redact secrets); Phase 2: global lock, sync to git-baselined memory workspace, render `phase2_workspace_diff.md`, spawn **sandboxed consolidation sub-agent** (no-approvals, no-network, local-write-only) to update `MEMORY.md` / `memory_summary.md` / `skills/`; watermarks prevent rework | `codex-rs/memories/README.md:29-157` |
| agno | Multi-store Learning Machine; 6 typed memory stores (`user_profile`, `user_memory`, `session_context`, `entity_memory`, `learned_knowledge`, `decision_log`); each independently enabled; each exposes tools to agent; each has `LearningMode` (ALWAYS/AGENTIVE/PROPOSE/HITL) | `libs/agno/agno/learn/machine.py:52-788` |
| spartan-ai-toolkit | 3-layer agent memory; Layer 1: `.memory/index.md` (~150 chars/line, always loaded, pointers only); Layer 2: `.memory/{decisions,patterns,knowledge,blockers}/` (loaded on demand); Layer 3: `.memory/transcripts/` (never loaded, grep-only archive) | `README.md:230-247` |
| spartan-ai-toolkit | Memory-consolidate; detects stale (verify claims against current codebase), duplicates, contradictions, derivable-from-code; uses `git log --follow` to check for renames before declaring stale | `toolkit/commands/spartan/memory-consolidate.md:33-110` |
| agno | Memory Curator; `prune(user_id, max_age_days, max_count)` removes old memories; `deduplicate()` normalizes text and removes exact/near-exact dupes | `libs/agno/agno/learn/curate.py:27-185` |
| hermes-agent | Background skill curator (inactivity-triggered); auxiliary-model task that auto-transitions lifecycle states (active→stale→archived) based on usage timestamps; spawns forked review agent that can pin/archive/consolidate/patch; uses auxiliary client to never touch main session's prompt cache | `agent/curator.py:1-20,70-86` |
| os-moda | Auto-generated SKILL.md from repeated tool sequences (SKILLGEN loop); 6h interval; `find_tool_sequences(db, min_sessions=3)`; deduplicates via Jaccard overlap (≥0.8 skips); writes full SKILL.md with YAML frontmatter + step-by-step body | `crates/osmoda-teachd/src/skillgen.rs:15-37,40-107,110-169,245-263` |

**Recommended adoption:** Codex's 2-phase pipeline as the architecture (Phase 1 extracts per-FID learnings, Phase 2 consolidates cross-FID via sandboxed Scribe sub-agent). Layer agno's typed stores. Use spartan-ai-toolkit's 3-layer structure for the storage layout. Use spartan-ai-toolkit's memory-consolidate as the Scribe's periodic maintenance pass. Use os-moda's SKILLGEN loop to auto-generate `.agents/skills/` from observed recurring tool-call patterns.

**Impact:** High — cross-session learning is a key differentiator; replaces manual LEARNINGS.md maintenance
**Effort:** High (memory subsystem; Phase 1/2 pipeline, consolidation sub-agent, curator loop, SKILLGEN loop)

---

### 7. Deterministic Tool-Call Guardrails

ECHO's Law 2 (Present Before Act) and Law 14 (error paths handled) are prompt-enforced. Multiple repos enforce deterministically.

| Repo | Pattern | Source |
|------|---------|--------|
| pi-steering-hooks | Deterministic regex-based guardrails with override + audit; `Rule { tool, field, pattern (violation=match), requires (AND), unless (exemption), reason, noOverride }`; default rules: `no-force-push`, `no-hard-reset`, `no-rm-rf-slash` (noOverride), `conventional-commits`, `no-long-running-commands`; override via `# steering-override: <rule-name> — <reason>` in any comment syntax | `src/index.ts:25-104` |
| zed | Hardcoded security rules (non-overridable terminal-command denylist); `HARDCODED_SECURITY_RULES` `LazyLock` of compiled regexes blocking `rm -rf /`, `rm -rf ~`, `$HOME` variants; flag-position normalization prevents `-rfv`/`--recursive --force` bypass | `crates/agent/src/tool_permissions.rs:12-60` |
| codex | execpolicy: Starlark-based command policy engine; `prefix_rule(pattern, decision=allow\|prompt\|forbidden, justification, match, not_match)` + `host_executable(name, paths)` to whitelist exact binary paths; rules load from `.rules` files, multiple merge in order, strictest severity wins; examples validated at load time as unit tests | `codex-rs/execpolicy/README.md:5-95` |
| goose | Adversary inspector: LLM-as-judge for tool calls; `AdversaryInspector` reads `~/.config/goose/adversary.md` (frontmatter selects tools + rules body); sends recent user messages + call to LLM with BLOCK/ALLOW decision; default rules block data exfiltration, destructive ops, privilege escalation | `crates/goose/src/security/adversary_inspector.rs:14-60` |

**Recommended adoption:** Layer all four. zed's hardcoded security floor as the non-overridable base. pi-steering-hooks' regex rules as the project-configurable layer in `protocol.config.yaml`. codex's execpolicy as the advanced policy engine. goose's adversary inspector as the LLM-judge second pass for gray-area commands.

**Impact:** High — safety is non-negotiable for autonomous agents; today's "bash AUDIT-only" gating is binary and insufficient
**Effort:** Low for pi-steering-hooks pattern; Medium for execpolicy; Medium for adversary inspector

---

### 8. Risk-Tiered Change Classifier (Auto Hybrid vs FID-Bound)

Savant-Code's Hybrid Mode vs FID-Bound Execution decision is currently a manual judgment call.

| Repo | Pattern | Source |
|------|---------|--------|
| great_cto | Risk-tiered change classifier (T0/T1/T2); T2 hard floor if any behavioral file matches `migrations/`, `auth/`, `pricing/`, `_domains.json`, OR new write-capable connector, OR `deployTarget=production`, OR behavioral file count ≥ `bulkThreshold` (default 50); T0 only if every file is non-behavioral; explicit `tier:tN` label can up/down-grade within non-floored range but never downgrades past T2 | `scripts/lib/change-tier.mjs:15-112` |
| great_cto | Spec-critic adversarial prompt; 7 attack vectors (wrong-problem, scope-explosion, internal-contradictions, missing-stakeholders, untested-assumptions, irreversibility-traps, missing-failure-spec) run BEFORE implementation begins | `packages/cli/assets/skills/brainstorming/spec-critic-prompt.md:17-80` |
| OpenSpec | Explore-First phase; `/opsx:explore` is pre-proposal phase where AI reads code, weighs options, shapes plan with user BEFORE anything is written; explicitly "no-stakes" — no artifacts committed | `README.md:49-77,142` |
| blueprint | Interactive Q&A planning with multiple-choice questions; agent reads codebase then asks MC questions that surface real design choices; questions start broad, get more specific; repeat until user decides to stop, then generate plan | `README.md:13-23,67-74` |

**Recommended adoption:** great_cto's T0/T1/T2 classifier as the auto-routing engine (TypeScript-native, file-pattern matching). Layer the spec-critic adversarial prompt into Detective's RED phase. Add OpenSpec's Explore-First as a PRE-FID phase. Add blueprint's MC Q&A to Detective RED phase to resolve ambiguity.

**Impact:** High — auto-routes Hybrid vs FID-Bound based on changed-file signature; force FID-Bound for migrations/auth/pricing
**Effort:** Medium (T0/T1/T2 classifier); Low for spec-critic prompt; Low for Explore-First; Low for blueprint Q&A

---

### 9. Code Intelligence Beyond Tree-Sitter

Savant-Code's `packages/code-map` extracts tokens + calls via tree-sitter. No cross-reference linking, no back-links, no graph algorithm, no vector index.

| Repo | Pattern | Source |
|------|---------|--------|
| aider | PageRank-based repo map with personalization; builds `networkx.MultiDiGraph` of def→ref edges; runs `nx.pagerank(G, weight="weight", personalization=...)` with chat-file/mentioned-file/mentioned-identifier weights | `aider/repomap.py:365-525` |
| refact | AST indexer with cross-references in LMDB; 7 tree-sitter parsers, two-phase indexing (parse+store → link cross-references); LMDB storage with key prefixes (`d|` defs, `c|` fuzzy lookup, `u|` back-links, `classes|` inheritance); background thread with batch processing | `refact-agent/engine/AGENTS.md` AST section |
| refact | VecDB with AST-aware + markdown + trajectory chunkers; SQLite + vec0 extension; chunkers: trajectory JSON (4 msgs/chunk), Markdown (heading-aware), code (AST-aware token windows); cosine KNN → reject threshold → normalize usefulness | `refact-agent/engine/crates/refact-vecdb/src/` |
| refact | Knowledge graph (petgraph DiGraph) with builder/cleanup/staleness/query; staleness tracks file-modified timestamps | `refact-agent/engine/crates/refact-knowledge-graph/src/lib.rs:1-5` |
| reflex | Trigram inverted-index + runtime tree-sitter symbol detection (lazy parsing); indexing extracts 3-char trigrams only; symbol queries narrow 62K files → ~10-100 candidates via trigrams, then parse only those with tree-sitter (2-224ms) | `CLAUDE.md` Runtime Symbol Detection Architecture |
| codesight | BFS blast-radius through import graph; builds reverse + forward adjacency maps from import edges, BFS to depth 3; maps affected files → affected routes (by handler file), affected models (by `db` tag), affected middleware | `src/detectors/blast-radius.ts:7-85` |
| sourcebook | Co-change coupling analysis; `analyzeGitHistory` returns `coChangeClusters: [fileA, fileB, commitCount][]`; if `auth.ts` co-changes with `session.ts` in 88% of commits, flags `session.ts` as missing from diff | `src/scanner/git.ts:5-24` |

**Recommended adoption:** Compose by capability. aider's PageRank for "what's relevant to this FID" subgraph. refact's LMDB back-links for "who calls this function?" without grep. refact's VecDB for "find similar past FIDs" semantic search. reflex's trigram index for sub-100ms large-repo symbol queries. codesight's blast-radius for Detective RED. sourcebook's co-change for Verifier AUDIT.

**Impact:** High — codebase understanding is essential for multi-agent coding; today's tree-sitter-only is the floor
**Effort:** Medium for PageRank; High for LMDB back-links; High for VecDB; High for trigram index; Medium for blast-radius; Medium for co-change

---

### 10. Parallel Execution & Best-of-N

Savant-Code's Perfection Loop runs once per FID. No competing implementations, no parallel sub-FIDs.

| Repo | Pattern | Source |
|------|---------|--------|
| kimi-code | Tool-call scheduler with resource-access conflict detection; `ToolScheduler<Result>` adds tool calls; if `ToolAccesses.conflict(task.accesses, candidate.accesses)` is false for all active + queued, task starts immediately; results handed back in provider order | `packages/agent-core/src/loop/tool-scheduler.ts:28-99` |
| bernstein | Tournament runs; task declares `attempts: N`; scheduler fans out N sibling attempts in isolated worktrees with byte-identical inputs; winner is pure function of evaluator outputs (test pass rate, lint, coverage delta, mutation score) with stable attempt-hash tie-break; emits signed `TournamentReceipt` | `README.md:86` |
| SWE-agent | Multi-attempt reviewer + preselector + chooser (best-of-N); `AbstractReviewer.review() -> ReviewerResult { accept: bool\|float, outputs, messages }`; `PreselectorOutput.chosen_idx: list[int]` filters N to shortlist; `ChooserOutput.chosen_idx: int` picks winner | `sweagent/agent/reviewer.py:30-100` |
| SWE-agent | AskColleagues action sampler; `AskColleaguesConfig { n_samples: int = 2 }`; `get_colleague_discussion(completions)` concatenates all parsed completions into "Your colleagues had the following ideas: ..." so model picks best of N | `sweagent/agent/action_sampler.py:23-60` |
| LoopTroop | LLM Council (draft → vote → refine → verify); multiple independent model instances draft plans, score each other using weighted rubric, vote on proposals; winner refines its draft by synthesizing strongest ideas from losing drafts, then verifies coverage | `server/workflow/phases/beadsPhase.ts:1-7,23`, `README.md:104-113` |

**Recommended adoption:** kimi-code's tool-call scheduler as the foundation for parallel read-only Detective calls. bernstein's tournament runs for GREEN phase (Forge spawns N parallel attempts in worktrees, Verifier picks winner deterministically). SWE-agent's AskColleagues for Thinker. LoopTroop's LLM Council for high-stakes FID planning.

**Impact:** High — cuts latency in Hybrid Mode; enables competing implementations for high-stakes FIDs
**Effort:** Low for tool-call scheduler; Medium for tournament; Low for AskColleagues; High for LLM Council

---

### 11. Goal/Budget-Bound Perfection Loop

Savant-Code's Perfection Loop has a circuit breaker (max 10 iterations) but no semantic goal or budget.

| Repo | Pattern | Source |
|------|---------|--------|
| kimi-code | Goal state machine with completionCriterion + SetGoalBudget; `CreateGoalTool` accepts `{objective, completionCriterion?, replace?}`; `SetGoalBudgetTool` caps work (tokens / tool calls / turns); `goalForModel(snapshot)` serializes for model context | `packages/agent-core/src/tools/builtin/goal/create-goal.ts:17-77` |
| openclaude | Goal evaluator (LLM-judge for session goal completion); `GoalEvaluatorDecision { complete, confidence, reason, next_instruction }`; system prompt: "Mark complete only when recent conversation shows the goal condition is satisfied. If verification is missing for a development task, mark incomplete." | `src/services/goal/evaluator.ts:6-77`, `src/services/goal/types.ts:1-32` |
| pi-ralph | max_activations per hat; `HatConfig.max_activations?: number`; before dispatching, checks `count > nextHatConfig.max_activations` → stops loop with `reason: "Hat 'X' exhausted (N activations)"` | `lib.ts:20,622-629` |

**Recommended adoption:** kimi-code's Goal state machine as the foundation (each FID becomes a Goal with a `completionCriterion` = the AUDIT pass condition and a `budget` = max Forge iterations before escalation). Layer openclaude's Goal evaluator as the Verifier's LLM-judge. Layer pi-ralph's max_activations as per-agent caps.

**Impact:** High — today's Perfection Loop can loop forever on a bad FID; semantic goal + budget forces convergence
**Effort:** Medium (Goal state machine in `packages/agent-runtime/`; LLM-judge evaluator in Verifier)

---

### 12. Hookable Lifecycle Events

Savant-Code's FSM transitions are internal. Users can't plug in CI/notifications without forking.

| Repo | Pattern | Source |
|------|---------|--------|
| codex | Lifecycle hooks with JSON Schema I/O contracts; 9 typed hook contracts as JSON schemas: `pre-tool-use`, `post-tool-use`, `pre-compact`, `post-compact`, `session-start`, `session-end`, `subagent-start`, `subagent-stop`, `stop`, plus `permission-request`; each has `*.input.schema.json` + `*.output.schema.json` | `codex-rs/hooks/` |
| openase | Workflow lifecycle hooks with failure policies + template variables; declarative `on_activate` / `on_reload`; each `{cmd, timeout, on_failure}` where `on_failure` ∈ `{block, warn, ignore}`; commands support `{{project.id}}`, `{{workflow.id}}`, etc. shell-quoted | `internal/workflow/hooks.go:19-43,66-95,210-249,300-322` |
| octomind | Declarative guardrails as TOML; `.agents/guardrails.toml` with four section types: `[[pipe]]` (pre-model input transform), `[[guard]]` (pre-call deny rule with `match=capture(arg_name=regex)`), `[[hook]]` (post-result script where non-zero exit injects stdout into agent's inbox), `[[validator]]` (end-of-turn script over new call-log slice) | `src/config/guardrails.rs:15-41`, `README.md:182-213` |

**Recommended adoption:** codex's JSON Schema I/O contracts as the typed-hook foundation (expose FSM transitions as hookable events: `pre-GREEN`, `post-AUDIT`, `pre-FID-archive`). Layer openase's failure policies and template variables. Layer octomind's TOML guardrails as the project-configurable surface in `protocol.config.yaml`.

**Impact:** High — extensibility without core changes; users plug in custom CI/notifications/slack
**Effort:** Medium (hook registry + dispatcher + JSON Schema contracts)

---

### 13. Per-FID File Scope Enforcement

Savant-Code gates by FSM phase but not by per-FID file scope. Forge can write anywhere in GREEN.

| Repo | Pattern | Source |
|------|---------|--------|
| bernstein | In-process verification gates via adapter hooks; task's `owned_files` become write allowlist; `Stop` hook runs required verification in-session and refuses to end turn while it fails; `PreToolUse` matcher refuses out-of-scope writes (realpath-contained, so `..` traversal or in-scope symlink resolving outside worktree is refused) | `README.md:80` |
| spartan-ai-toolkit | Freeze mode; `/spartan:freeze <dir>` locks file creation/edit/deletion to `<dir>/**`; reads anywhere always allowed; test directory auto-unlocked: `src/main/kotlin/.../module/` → also allows `src/test/kotlin/.../module/` | `toolkit/commands/spartan/freeze.md:9-46` |
| kagan | Push protection via tool.execute.before hook; `guardGitPush()` intercepts bash tool calls, runs `isGitPushCommand()` (tokenizes, handles `&&`/`||`/`;`/`|` separators, skips `-C`/`-c` flags); throws `PUSH_DENIED_MESSAGE` if supervised | `src/server.ts:44-58`, `src/git/runner.ts:43-76` |

**Recommended adoption:** bernstein's `owned_files` write allowlist as the foundation (FID declares its target files; Forge can only write those). Layer spartan-ai-toolkit's freeze mode for the test-directory auto-mapping. Layer kagan's push protection (block `git push` during GREEN/AUDIT unless explicitly approved).

**Impact:** High — prevents Forge from writing outside its FID's declared scope; aligns with ECHO's per-FID isolation
**Effort:** Medium for owned_files allowlist; Low for freeze mode; Low for push protection

---

## Tier 3: Medium Impact (Recommended)

### 14. Code Review Format / PR Packing

Savant-Code's Verifier audits diffs but has no structured review format.

| Repo | Pattern | Source |
|------|---------|--------|
| prpack | Diff + full post-change file content packing; per-file emits the diff AND the full post-change file content so reviewer model can see what didn't change but matters; `pickFence` finds longest backtick run and emits fence one char longer | `src/pack.js:190-257` |
| prpack | Adjacent-test auto-discovery; `collectAdjacentTests` + `guessTestSiblings` maps `foo.ts`→`foo.test.ts`, `foo.go`→`foo_test.go`, `foo.py`→`test_foo.py`, `foo.rb`→`foo_spec.rb` | `src/pack.js:152-188` |
| prpack | Four focused review-angle prompts; security/performance/tests/architecture, each forcing `[SEVERITY] file:line — summary / Why it matters / Suggested fix` format and `Bottom line: ship | fix-before-ship | hold` verdict | `src/prompts.js:1-181`, `THE_TECHNIQUE.md:130-149` |
| sourcebook | Two-layer diff-completeness gate; Layer A rules-based (<1s, no LLM): co-change + test-file detection + import graph + hub detection; Layer B sends diff+context to Claude Sonnet; every AI suggestion requires dependency citation, hallucinated paths filtered | `README.md:106-119`, `CLAUDE.md` Architecture |

**Recommended adoption:** prpack's packing technique as the Verifier's review-artifact format. Layer the four focused review-angle prompts for four-pass AUDIT. Layer sourcebook's two-layer gate (rules-based first pass, LLM second pass with citation requirement).

**Impact:** Medium — structured review artifacts catch more than ad-hoc diff inspection
**Effort:** Low for packing; Low for review-angle prompts; Medium for two-layer gate

---

### 15. AGENTS.md Linting & Auto-Generation

Savant-Code's `AGENTS.md` is hand-edited, never linted or auto-generated.

| Repo | Pattern | Source |
|------|---------|--------|
| cc-audit | 12-rule AGENTS.md linter; `RULE_SIGNALS` checks for keyword signals of 12 baseline rules; `ANTI_PATTERNS` regex-detects leaked GitHub PATs (`ghp_…`), AWS keys (`AKIA…`), `sk-` API keys, paypal me links, literal passwords; `COMPLIANCE_CLIFF = 200` lines | `cc_audit.py:35-148` |
| caliber | Deterministic config-quality scoring; scores against actual filesystem on 6 axes (Files & Setup 25pts, Quality 25pts, Grounding 20pts, Accuracy 15pts, Freshness 10pts, Bonus 5pts); score-regression guard with auto-revert | `src/scoring/checks/accuracy.ts:1-60`, `README.md:178-193` |
| faf-cli | AGENTS.md authoring from structured data; deterministically projects a `.faf` into AGENTS.md (orientation line, setup/build commands sorted by `setupRank`, verify bar, guardrails, DoD); managed block wrapped in `<!-- faf:start -->` / `<!-- faf:end -->` | `src/interop/agents.ts:33-100` |
| faf-cli | Trophy-gated bi-directional sync; blocks `--pull` unless project scores 100% (Trophy tier) | `src/commands/sync.ts:70-107` |

**Recommended adoption:** cc-audit's 12-rule linter as the Verifier AUDIT phase gate (one Python file, ~240 lines, zero deps — easy port to TypeScript). Layer caliber's deterministic scoring as `savant score` command. Layer faf-cli's managed-block AGENTS.md authoring so Scribe can auto-regenerate boilerplate sections.

**Impact:** Medium — catches stale paths, leaked secrets, compliance-cliff violations in the canonical context file
**Effort:** Low for cc-audit port; Medium for caliber scoring; Medium for faf-cli authoring

---

### 16. LSP Integration

| Repo | Pattern | Source |
|------|---------|--------|
| kilocode | LSP integration with document symbols + diagnostics; `Range`, `Symbol`, `DocumentSymbol`, `Status`; `SymbolKind` enum; `lsp/client.ts` + `lsp/server.ts` + `lsp/launch.ts` for spawning language servers; exposes `lsp.updated` events | `packages/opencode/src/lsp/lsp.ts:19-80` |

**Recommended adoption:** kilocode's LSP client. LSP diagnostics are ground truth for "did the code compile?" Forge could subscribe to `lsp.updated` after each write to catch type errors immediately (much stronger than grep-based verification).

**Impact:** Medium — improves code understanding and post-edit verification
**Effort:** High (LSP client in `packages/code-map/`; per-language server spawning)

---

### 17. Autonomous / Scheduled Execution

Savant-Code waits for user input. No background FIDs, no scheduled audits.

| Repo | Pattern | Source |
|------|---------|--------|
| cline | Cron scheduler with materializer + SQLite store + resource limiter; 5-field cron parser with ranges/steps/names; `cron-materializer.ts` (turns schedules into runnable jobs); `resource-limiter.ts` (concurrency cap); `sqlite-cron-store.ts` (durable persistence) | `sdk/packages/core/src/cron/schedule/scheduler.ts:1-80` |
| os-moda | Autonomous agent loop engine; `POST /loops` creates loop with `interval` + `iteration_cap` + `stop_sentinel` that fires real LLM turn each tick toward standing goal; loops persist across restarts; pause after 3 consecutive errors; spend-capped | `CLAUDE.md` Agent loop engine section |
| golembot | Proactive task coordinator with result delivery; `ProactiveCoordinator` runs scheduled prompts through agent, captures streamed reply + cost + duration; records execution history; delivers results to target channels | `src/proactive.ts:30-159` |

**Recommended adoption:** cline's cron scheduler as the foundation (TypeScript-native, SQLite-durable, resource-limited). Layer os-moda's autonomous loop engine for long-running autonomous FIDs. Layer golembot's proactive coordinator for autonomous background FIDs.

**Impact:** Medium — enables overnight FID batches, scheduled re-audits, autonomous refactors
**Effort:** High (cron module + loop engine + result delivery)

---

### 18. Loop / Stuck Detection

Savant-Code's Perfection Loop can spin on the same fix.

| Repo | Pattern | Source |
|------|---------|--------|
| ccg-workflow | Loop detection with break-loop protocol injection; tracks turns per (phase, nextAction); when same phase+nextAction repeats 3+ turns, injects `⚠️ LOOP DETECTED` warning with forced break-loop protocol | `templates/hooks/workflow-state.js:23-48` |
| ctxlint | Session loop detection; flags 3+ consecutive identical commands or cyclic A,B,A,B patterns in session history | `README.md:90` |
| LoopTroop | Ralph-style recovery loop with context wipe; on failure: log compact error trace, reset worktree, discard contaminated session, begin fresh run with clean context plus note from previous failures; repeats until tests pass or retry limits reached | `README.md:144-152`, `server/workflow/phases/beadsPhase.ts:69` |

**Recommended adoption:** ccg-workflow's loop detection as the foundation. Layer ctxlint's cyclic-pattern detection. Layer LoopTroop's Ralph-style recovery (on Verifier rejection, Forge retries with fresh context window carrying only compact failure trace).

**Impact:** Medium — detects stuck FIDs, forces Thinker re-analysis, prevents context drift
**Effort:** Low for ccg-workflow; Medium for ctxlint; Medium for Ralph-style recovery

---

### 19. Output Filtering (Context Budget Preservation)

| Repo | Pattern | Source |
|------|---------|--------|
| forge | Per-class Bash output filter; PostToolUse hook condenses verbose Bash output by command class: package-install keeps first 5 + warn/err + last 3; build keeps warn/err + last 3; git-diff keeps 100 lines/file; find keeps first 50 + last 10; curl keeps 1024 body bytes; 3-second safety timeout | `hooks/output-filter.js:1-100` |
| forge | Test-output filter (failures + summary only); keeps failure blocks with 8 lines of context + summary tail (10 lines), drops passing-noise lines; 2000-char threshold, 3-second timeout | `hooks/test-output-filter.js:1-100` |
| forge | Auto-backprop hook (PostToolUse → spec-gap detection → new AC + regression test); detects test failures; on failure, writes `.forge/.auto-backprop-pending.json` with failure context (capped 4000 bytes); stop-hook prepends backprop request to next prompt, traces bug to acceptance criterion that should have caught it, proposes tightened criterion, generates regression test | `hooks/auto-backprop.js:1-213` |

**Recommended adoption:** forge's output filter + test-output filter (condense before context window). Layer auto-backprop for Verifier AUDIT (when test failure detected, automatically trace to FID acceptance criterion gap, propose tightened criterion, generate regression test).

**Impact:** Medium — preserves context budget; closes loop between AUDIT failure and FID refinement
**Effort:** Low for output filters; Medium for auto-backprop

---

### 20. Cross-Agent Shared Memory & Audit

| Repo | Pattern | Source |
|------|---------|--------|
| imcodes | Managed MCP tool surface with runtime-bound identity; daemon-managed stdio MCP server exposes memory recall, agent-to-agent messaging, cron scheduling; every tool call bound to current session/project/user/server at runtime; agents cannot forge namespace, user, server, token, or routing fields | `README.md:100-109,181-184` |
| imcodes | Supervised execution with idle-boundary completion classification; at each turn's idle boundary, supervisor classifies turn as `complete`/`continue`/`ask_human` then auto-dispatches next continue prompt; optional `supervised_audit` mode triggers audit/rework loop before returning control | `README.md:111-122,163-168` |
| sidecar | Unified multi-agent conversation browser; 10 adapters (amp, claudecode, codex, copilot, cursor, geminicli, kiro, opencode, piagent, warp); `Plugin` struct aggregating `adapters map[string]adapter.Adapter` with session list state, message pagination, render-cache | `internal/plugins/conversations/plugin.go:25-100` |

**Recommended adoption:** imcodes' runtime-bound identity for tool calls (bind tool calls to active FID so agent working on FID-A cannot write to FID-B's namespace). Layer imcodes' supervised execution (auto-continue Perfection Loop's GREEN→AUDIT→GREEN retry without human "continue" prompts). Layer sidecar's conversation browser for Scribe.

**Impact:** Medium — FID-scoped tool isolation; reduces human-in-the-loop friction
**Effort:** High for runtime-bound identity; Medium for supervised execution; High for conversation browser

---

### 21. Provider Status & Quota Management

| Repo | Pattern | Source |
|------|---------|--------|
| models | Provider status registry with OfficialFirst strategy + fallback; `STATUS_REGISTRY` has 22 entries across 7 status-page platforms; each entry has `StatusStrategy::OfficialFirst { official, fallback_source_slug }` | `src/status/registry.rs:12-80` |
| onwatch | Auto quota-starter; detects unstarted window; fires `SendStarterPing()` in goroutine; `allowStarterPing()` enforces rolling rate cap (max 5 pings per 4h per window); ping sends minimal request asking model to reply "Quota Resumed" (~62 tokens) | `internal/agent/codex_agent.go:20-32,88-190,245-275` |
| onwatch | OAuth token rotation to bypass 429; when `FetchQuotas()` returns `ErrAnthropicRateLimited`, refreshes OAuth token (rate limits are per-access-token, not per-account); saves BOTH new access token AND new refresh token immediately | `internal/agent/anthropic_agent.go:241-256,458-615` |

**Recommended adoption:** models' provider status registry as the Researcher's pre-FID check. Layer onwatch's auto quota-starter. Layer onwatch's OAuth token rotation (when provider 429s during FID, automatically rotate OAuth token for fresh rate-limit window).

**Impact:** Medium — prevents FID stalls on provider quota issues; reduces 429 interruptions
**Effort:** Medium for status registry; Medium for auto quota-starter; Medium for OAuth rotation

---

### 22. Portable Config & Overlay

| Repo | Pattern | Source |
|------|---------|--------|
| claude-snapshot | Portable config tarball with `$HOME` path normalization; `normalizePaths` rewrites exporter's home dir to literal `$HOME` token; `resolvePaths` rewrites back on apply; `sanitizeSettings` rewrites nvm-pinned Node paths to bare `node`; every overwritten file backed up as `.bak` first | `src/snapshot.mjs:46-93` |
| claude-overlay | Surgical config overlay with tracked managed keys; writes `.claude/provider-overlay.json` recording exactly which keys it manages; `merge` (enable) unions them into settings; `remove` (disable) subtracts only those keys — user's custom config never touched; `_atomic_write` writes to temp then `os.rename` (atomic), `chmod 0600` | `lib/engine.py:26-120` |
| claude-overlay | `env:` prefix for secrets; config values starting with `env:` are read from named env var at runtime, so credentials never touch disk | `lib/engine.py:115-120` |

**Recommended adoption:** claude-snapshot for Scribe (export/import full Savant-Code config as portable tarball for team onboarding). Layer claude-overlay for Orchestrator (let users swap LLM providers/model tiers without touching base `protocol.config.yaml`). Adopt claude-overlay's `env:` prefix convention for API keys.

**Impact:** Medium — team onboarding, provider switching, secret hygiene
**Effort:** Medium for snapshot; Medium for overlay; Low for `env:` prefix

---

## Tier 4: Novel / Worth Noting

### 23. Session Fork / Rewind / Side-Conversation

| Repo | Pattern | Source |
|------|---------|--------|
| zero | `/btw` side-conversation fork; asks question in isolated session fork without adding side conversation to main session's context | `README.md:208` |
| zero | `/rewind` session rollback; temporal undo of conversation + agent state (distinct from `/resume` which continues) | `README.md:207` |
| pi-ralph | Steering queue; user messages during active loop queued, injected into next hat; `LoopState.steering: string[]`; pushed instead of interrupting; injected in `buildHatInjection()`, then cleared | `lib.ts:76,752-758` |

**Recommended adoption:** zero's `/btw` for Orchestrator (let user ask "btw, why did Detective flag this file?" mid-FID without polluting FID transcript). Layer zero's `/rewind` for Orchestrator (rewind FID session to before bad Forge implementation, re-run GREEN from checkpoint). Layer pi-ralph's steering queue (queue user steering messages during FID's Perfection Loop, inject into next agent's prompt rather than interrupting mid-turn).

**Impact:** Medium — better UX for interactive sessions; prevents context pollution
**Effort:** Low for `/btw`; Medium for `/rewind`; Low for steering queue

---

### 24. Streaming DAG with AC-Level Dependency Granularity

| Repo | Pattern | Source |
|------|---------|--------|
| forge | Streaming DAG with AC-level dependency granularity + witness-hash invalidation; extends task dependencies from task-level (`depends: [T003]`) to AC-level (`depends: [T001.R001.AC3]`); when upstream emits `ac-met` for an AC downstream needs, scheduler dispatches downstream provisionally in its own worktree; on `task-verified`, provisional promotes; if upstream regresses the AC (witness hash changes on verify), every downstream that consumed old witness is marked STALE and re-queued; safety caps: `maxProvisional=3` per chain, `maxFailuresBeforeFallback=2` | `scripts/forge-streaming-dag.cjs:1-80` |

**Recommended adoption:** Orchestrator — FID-level dependency tracking with witness hashes so a regression in one FID invalidates only dependent FIDs, not the whole queue. Enables parallel FID execution with AC-level granularity.

**Impact:** High novelty, Medium direct impact — enables fine-grained parallel FID execution
**Effort:** High

---

### 25. Intent Capsules with Deterministic Drift Escalation

| Repo | Pattern | Source |
|------|---------|--------|
| bernstein | Intent capsules; at approval time the goal is compiled into an intent capsule (allowed action classes, file-scope globs, permitted adapters, egress classes, cost-envelope, expiry) bound to audit chain; deterministic drift monitor maps observed journal events to action classes and compares against the capsule; on divergence emits a signed escalation receipt | `README.md:74` |

**Recommended adoption:** Verifier AUDIT — prove a FID's execution stayed within its declared scope cryptographically. This is ECHO's FSM tool-gating taken further: not just "which phase allows which tools" but "did the agent actually stay within the FID's declared scope."

**Impact:** High novelty, Medium direct impact — cryptographic proof of FID scope adherence
**Effort:** High

---

### 26. Spec-to-Task-Graph with Requirement-Hash Lineage

| Repo | Pattern | Source |
|------|---------|--------|
| bernstein | Spec-to-task-graph; three-stage pipeline: draft extracts EARS-shaped acceptance lines into content-addressed requirement set, approve binds the hash into audit chain, compile turns approved set into task graph as pure model-free transformation where each node is content-addressed over requirement lines | `README.md:88` |

**Recommended adoption:** Recorder (FID phase) — make FID tasks content-addressable over requirement lines so post-approval edits break the chain visibly. This is a stronger FID integrity guarantee than the hash-chained ledger (item 1): it binds requirements to tasks cryptographically.

**Impact:** High novelty, Medium direct impact — FID requirements become tamper-evident at the task level
**Effort:** Medium

---

### 27. Build Probes & A/B Test Across Model Tiers

| Repo | Pattern | Source |
|------|---------|--------|
| tokenwise | Build probes; at install time, runs two probes: (1) Routing probe — spawns probe Task at Haiku tier asking it to return "TOKENWISE_PROBE_OK", verifies model param took effect; if not, refuses to install; (2) Env-var probe — sets `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` and reads it back to verify env vars are honored | `skills/install/SKILL.md:35-44`, `README.md:250-256` |
| tokenwise | A/B test across model tiers; `/tokenwise:ab "<task>"` runs same task on multiple tiers separately, diffs outputs, scores quality, writes report with recommendation | `README.md:153-159,199-215` |
| tokenwise | Safety caps for model routing; Haiku never spawns further subagents; max spawn depth = 2; trivial-task floor: tasks under 100 chars with no file context run inline; input bump: if subagent context would exceed 30k tokens, escalate one tier | `README.md:69-74` |

**Recommended adoption:** tokenwise's build probes for Orchestrator (on startup, probe LLM provider for known routing/config bugs before starting FIDs; refuse to start if broken). Layer A/B test across model tiers. Layer safety caps when routing FIDs to cheaper models.

**Impact:** Medium novelty, Medium direct impact — prevents silent routing failures; validates model tier sufficiency
**Effort:** Low for build probes; Medium for A/B test; Low for safety caps

---

### 28. Skill Mention Syntax with Collision Detection

| Repo | Pattern | Source |
|------|---------|--------|
| codex | Skill mention syntax with collision detection; `core-skills/src/mention_counts.rs` builds exact + ASCII-lowercase name counts across all loaded skills, excluding disabled paths; `injection.rs` builds `SkillInjection { name, path, contents }` per turn based on `@skill-name` mentions in user input, with `InjectedHostSkillPrompts` dedup set | `codex-rs/core-skills/src/mention_counts.rs:8-23`, `injection.rs:71-80` |
| octomind | Intent-driven skill activation via embedding model; skills describe what they're for; runtime matches user prompt against those descriptions and only loads matching skills; abstains on near-ties | `README.md:219-249` |
| OpenHands | Microagents with frontmatter triggers; per-repo `.openhands/microagents/*.md` with optional frontmatter `triggers: [keyword1, keyword2]`; without frontmatter: always loaded; with triggers: only loaded when user's message matches trigger keyword | `AGENTS.md` Microagents section |

**Recommended adoption:** codex's `@skill-name` mention syntax for CLI UX (`@coding-typescript` injects the skill body for Forge, `@release-workflow` for Recorder). Layer OpenHands' microagent frontmatter triggers. Layer octomind's embedding-based intent-driven activation for the advanced case.

**Impact:** Medium novelty, Medium direct impact — reduces context bloat; enables many more skills without bloating every agent's system prompt
**Effort:** Low for `@mention` syntax; Low for frontmatter triggers; High for embedding-based activation

---

## Savant-Code Differentiators to Preserve

During adoption work, these unique strengths must be preserved:

| Differentiator | Evidence |
|---------------|----------|
| **ECHO Protocol governance** | FID-bound Perfection Loop + 9-role separation of duties + 15 Laws |
| **FID lifecycle** | Created → Analyzed → Fixed → Verified → Closed → Archived with Perfection Loop FSM running on the FID document |
| **Hybrid Mode** | Orchestrator writes code directly for most tasks; FID-Bound Execution for complex tasks |
| **Tool gating by FSM phase** | write tools GREEN-only, bash AUDIT-only, sequentialthinking Thinker-only |
| **Cross-Agent Claim Rule** | Sub-agent claims must cite source paths; "Detective said X" is not a source |
| **Free-tier model catalog** | `savant-free-models.ts` — MiniMax M3, DeepSeek V4, MiMo, Kimi, GLM, HY3 |
| **Disciplined small roster** | 9 fixed, well-scoped agents vs. open-ended dynamic spawning |
| **OpenTUI 0.2.2 + React 19** | Native terminal UI core with TypeScript bindings; already uses DiffRenderable, MarkdownRenderable, CodeRenderable, ScrollBoxRenderable, SelectRenderable, TabSelectRenderable, etc. |

---

## Prioritized Adoption Roadmap

### Phase 0 — FID Integrity Foundation (unblocks safe autonomous operation)

1. **Tamper-evident audit ledger** (item 1) — hash-chained SQLite ledger for every FID transition + tool call; `savant verify-ledger` CLI
2. **Git worktree-per-FID with rollback** (item 2) — each FID runs in isolated worktree; kagan's `Bun.hash` stable paths
3. **Git-ref checkpoints per Perfection Loop iteration** (item 3) — `refs/savant/checkpoints/{fidId}/{iteration}/`; AUDIT can `git reset` on test failure
4. **SpendMeter per-agent daily kill-switch** (item 4) — `state/spend.json`; refuse to invoke model if over cap; alerts at 80%/100%

### Phase 1 — Context & Memory

5. **Context compaction pipeline** (item 5) — goose's progressive compaction + SWE-agent's pluggable HistoryProcessor pipeline + entroly's Cache Aligner + hermes-agent's sacred-invariant rule
6. **Background memory pipeline** (item 6) — codex's 2-phase extraction → consolidation; agno's typed stores; spartan-ai-toolkit's 3-layer structure; os-moda's SKILLGEN loop

### Phase 2 — Safety & Intelligence

7. **Deterministic tool-call guardrails** (item 7) — zed's hardcoded floor + pi-steering-hooks' regex rules + codex's execpolicy + goose's adversary inspector
8. **Risk-tiered change classifier** (item 8) — great_cto's T0/T1/T2 auto-routing Hybrid vs FID-Bound; spec-critic; Explore-First; blueprint Q&A
9. **Code intelligence beyond tree-sitter** (item 9) — aider's PageRank + refact's LMDB back-links + refact's VecDB + reflex's trigram index + codesight's blast-radius + sourcebook's co-change
10. **Per-FID file scope enforcement** (item 13) — bernstein's owned_files allowlist + spartan-ai-toolkit's freeze mode + kagan's push protection

### Phase 3 — Orchestration & Autonomy

11. **Parallel execution & best-of-N** (item 10) — kimi-code's tool-call scheduler + bernstein's tournament runs + SWE-agent's AskColleagues + LoopTroop's LLM Council
12. **Goal/budget-bound Perfection Loop** (item 11) — kimi-code's Goal state machine + openclaude's Goal evaluator + pi-ralph's max_activations
13. **Hookable lifecycle events** (item 12) — codex's JSON Schema hooks + openase's failure policies + octomind's TOML guardrails
14. **Autonomous/scheduled execution** (item 17) — cline's cron scheduler + os-moda's autonomous loop engine + golembot's proactive coordinator

### Phase 4 — Quality & Review

15. **Code review format / PR packing** (item 14) — prpack's diff+full-file+adjacent-tests + four review-angle prompts + sourcebook's two-layer gate
16. **AGENTS.md linting & auto-generation** (item 15) — cc-audit's 12-rule linter + caliber's scoring + faf-cli's managed-block authoring
17. **LSP integration** (item 16) — kilocode's LSP client with `lsp.updated` events
18. **Loop/stuck detection** (item 18) — ccg-workflow's loop detection + ctxlint's cyclic patterns + LoopTroop's Ralph-style recovery
19. **Output filtering** (item 19) — forge's per-class Bash output filter + test-output filter + auto-backprop

### Phase 5 — Provider & UX Polish

20. **Provider status & quota management** (item 21) — models' status registry + onwatch's auto quota-starter + OAuth token rotation
21. **Portable config & overlay** (item 22) — claude-snapshot + claude-overlay + `env:` prefix
22. **Session fork/rewind/side-conversation** (item 23) — zero's `/btw` + `/rewind` + pi-ralph's steering queue
23. **Skill mention syntax & trigger-gated loading** (item 28) — codex's `@skill-name` + OpenHands' microagent frontmatter triggers

---

## Evidence Index

### Sub-Agent Reports (6 parallel `general` agents, path-cited per Cross-Agent Claim Rule)

| Cluster | Repos Covered | Result |
|---------|----------------|--------|
| Coding Agents A | aider, cline, codex, continue, gemini-cli, goose, gpt-pilot, kilocode, kimi-code, opencode-dev, openclaw, OpenHands, refact, SWE-agent, tabby, TabNine, theia | 12 repos with novel features; 5 skipped (gpt-pilot unmaintained/compromised, opencode-dev upstream, openclaw not coding-focused, TabNine closed-source, theia IDE framework) |
| Coding Agents B | agentify, anima, axon, bernstein, blueprint, butterfish, calibre, ccg-workflow, claude-task-master, Dorothy, entroly, hermes-agent, imcodes, LoopTroop, micro-agent, octomind, openagent, openase, ORCH, parallel-code, swarmclaw | 11 repos with novel features; 10 skipped |
| Code Review + Context | baz-cli, cc-audit, claude-lens, claude-overlay, claude-snapshot, code-insights, codesight, ctxlint, faf-cli, git-lrc, Gito, gptcomet, grasp, great_cto, gritql, intelligence-sync, Jctx, minimax-code-review, potpie, pr-agent, pr-triage, prpack, zai-code-review, sidecar | 13 repos with novel features; 11 skipped |
| Sandbox + Memory + Token | agenttier, agenttrace, brood-box, cc-tempo, claude-code-pro-pack, cmux, console, forge, iwe, kagan, models, onwatch, openclaude, openquack, os-moda, pi-ralph, pi-steering-hooks, Poirot, tokrepo, tokscale, tokenwise, WhereMyTokens, vibebox, spartan-ai-toolkit | 16 repos with novel features; 8 skipped |
| Terminal/UI + Research | AionUi, antigravity-link-extension, cli (Shep), cmux, onUI, opentui, reflex, LynxPrompt, sourcebook, skill-optimizer, swarmvault, testdriver, tldraw, WrenAI, zed, awesome-code-docs, ai-coding-guide | 10 repos with novel features; 7 skipped |
| Misc + Remaining | agno, ai-coding-guide, awesome-ai-startups, clave, golembot, issue-ai-agent, mirrord, os-moda, openase, openclaude, openclaw, opencode-dev, OpenSpec, opentui, zero, zed | 7 repos with novel features; 9 skipped |

### Orchestrator Spot-Verification (3 claims verified against actual source)

1. **os-moda ledger** — `crates/agentd/src/ledger.rs:1-50` read directly; `Event` struct, `GENESIS_PREV_HASH` all-zeros, WAL pragma, `synchronous=FULL` pragma all confirmed matching sub-agent report
2. **goose compaction** — `crates/goose/src/context_mgmt/mod.rs:227-256` read directly; `filter_tool_responses`, middle-out removal (`middle = tool_indices.len() / 2`, alternate left/right) confirmed matching sub-agent report
3. **cline checkpoints** — `sdk/packages/core/src/hooks/checkpoint-hooks.ts:1-20` read directly; `CheckpointEntry { ref, createdAt, runCount, kind? }`, `CheckpointMetadata { latest, history }` confirmed matching sub-agent report

### Source Repos

`resources/{116 repos}/` at `C:\Users\spenc\dev\savant-code\resources\`

### Predecessor Reports

- [`adoptable-features-master.md`](./adoptable-features-master.md) (2026-07-19, 16-repo scan, archived) — this document supersedes it for the 2026-07-25 scan
- [`feature-parity-report.md`](./feature-parity-report.md) (2026-07-19, 16-repo product-first analysis)
- [`docs/reports/repos/{16 repos}.md`](./repos/) (2026-07-19, per-repo feature inventories)

---

## Synthesis-Audit Note

> **Added 2026-07-25.** This master synthesis is sourced from 6 parallel `general` sub-agent reports, each covering 16-24 repos with path-cited findings per the ECHO Cross-Agent Claim Rule (`ECHO.md:275-286`). The Orchestrator spot-verified 3 of the highest-impact claims against actual source (os-moda ledger, goose compaction, cline checkpoints — all confirmed).
>
> **Unverified claims remaining:** The remaining features are based on sub-agent reports that cite paths but the Orchestrator has not personally read every line. Per Cross-Agent Claim Rule (`ECHO.md:280-283`), before implementing any feature, re-verify the cited path against current source. Numbers and specific line ranges sourced from sub-agent analysis must be traceable to a record the implementer can grep, read, or query independently.
>
> **Repos intentionally skipped as not novel:** gpt-pilot (unmaintained, supply-chain compromised Aug 2025–Jun 2026), opencode-dev (Savant-Code's own upstream), openclaw (personal assistant, not coding-focused), TabNine (closed-source config only), theia (IDE framework, not an agent), ai-coding-guide/awesome-code-docs/awesome-ai-startups (content lists, not features), opentui (already a Savant-Code dependency), reflex's trigram index (overlaps with code-map, listed in item 9 for the lazy-parsing pattern only).
>
> **Recommendation:** Before Phase 0 work begins, run a fresh savant-code baseline pass (independent of this report) to catch any drift between the reports and the live codebase. Create a FID per feature, run the Perfection Loop (RED → GREEN → AUDIT → COMPLETE) on each before implementation.

---

*End of master synthesis (2026-07-25).*
