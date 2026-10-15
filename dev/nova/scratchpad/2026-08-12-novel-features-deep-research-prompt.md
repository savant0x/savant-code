<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Deep Research Prompt — Novel & Game-Changer Feature Ideas for Savant-Code

**Prepared:** 2026-08-12
**Target system:** Savant-Code (TypeScript/Bun multi-agent AI coding assistant, governed by ECHO Protocol v0.2.0)
**Purpose:** Gemini Deep Research pass to map the multi-agent / coding-harness landscape and surface NOVEL, market-defining, "game-changer" feature ideas — not incremental improvements, not 1:1 adoptions.
**How to use:** Attach the files listed in "Files To Attach" below, paste this entire prompt into Gemini Deep Research, set research depth to maximum, and request the structured output format at the end. This prompt is self-contained; the attached files provide the authoritative governance text Gemini should honor.

---

## Files To Attach (read 0-EOF before research)

1. `ECHO.md` — the 15 ECHO Laws + Perfection Loop FSM + 10-agent roster + separation-of-duties. NON-NEGOTIABLE.
2. `ARCHITECTURE.md` — agent roster, tool gating, runtime enforcement (EHEL), boot sequence.
3. `protocol.config.yaml` — project config, quality bar, perfection-loop circuit breakers.
4. `README.md` — current feature surface, provider model, execution modes, export workflows.
5. `templates/FID-TEMPLATE.md` — the FID authoring contract (how ideas become tracked work).
6. `CHANGELOG.md` — what v0.0.23 actually shipped (the current capability ceiling).

---

## Context — What Savant-Code Is

Savant-Code is a **terminal-native, local-first, multi-agent AI coding assistant** built on the **ECHO Protocol v0.2.0**. It is NOT a single chat loop. It is a 10-agent harness where each phase of a "Perfection Loop" (RED → GREEN → AUDIT → ADVERSARIAL → SELF-CORRECT → COMPLETE) is owned by a specialized agent with restricted tools:

- **Orchestrator** — routes work, spawns agents, writes code in Hybrid Mode
- **Detective** (RED) — codebase analysis, grep call-graphs, evidence catalog
- **Forge** (GREEN) — implementation only, cannot self-verify
- **Verifier** (AUDIT) — double-audit, zero tools, receives evidence via harness injection
- **Recorder** — FID lifecycle, CHANGELOG
- **Thinker** — sequential-thinking reasoning engine
- **Scout** — read-only exploration
- **Researcher** — web search + deep_research
- **Scribe** — docs
- **Adversary** (ADVERSARIAL) — meta-verification; verdicts OVERRIDE the Verifier

**ECHO non-negotiables (these constrain every feature idea):**
- Law 1: Read 0-EOF before any edit
- Law 2: Present before act (user approval before code is written or a work item dropped)
- Law 3: Verify before proceed (zero errors, zero warnings)
- Law 4: Verify call-graph reachability (compilation ≠ verification)
- Laws 5–15: no placeholders/TODOs, type-safe, search-before-create, sensitive data never in logs, build stays clean, etc.
- **EHEL** enforces all 15 laws mechanically at the tool-executor level — features cannot bypass them.
- **FID-Bound Execution:** code is never written until a FID converges through the Perfection Loop.
- **Separation of duties:** the agent that writes code cannot verify it.

**Current differentiators already shipped (v0.0.23):**
- Unified provider registry (Ollama, OpenRouter, Nous, TokenHarbor, TokenRouter, NVIDIA, CommandCode, OpenCode Go, Cloudflare Workers AI) — one typed `PROVIDER_REGISTRY`, provider-agnostic, local-first.
- Codebase knowledge graph (tree-sitter, SQLite, Louvain clustering) → offline "Code Universe" interactive HTML export.
- Checkpoint & Rewind (`/rewind` restores code/conversation/both/fork — no git required).
- Loadable design-system library (74 offline presets, deterministic manifest, EHEL-scanned).
- Hardened reversible release engine with binary-asset verification.
- Adversary meta-verification layer (unique — most harnesses have no adversarial re-audit).
- Skills system (OpenClaw-format `SKILL.md`), MCP discovery, `/goal` + `/loop` schedulers.

**Why this research:** The space is now crowded (GitHub just shipped an official Copilot SDK; ~60+ open coding agents exist). Savant-Code's governance layer is its moat, but governance alone is not a *selling point* to a new user. We need the novel, defensible, "I would switch for THIS" features — the ones that combine ECHO's integrity with capabilities no other harness has. We do NOT want feature parity. We want the features that define a new category.

---

## Landscape Map — Example / Reference Agents & Harnesses (NOT the target system)

> These are EXAMPLES to study for ideas. They are NOT Savant-Code. Study them, retrofit the idea through ECHO, move on. Do not propose adopting their architecture 1:1.

### Personal / general agent frameworks
- **OpenClaw** — `https://github.com/openclaw/openclaw` — personal AI assistant, runs locally, multi-channel (WhatsApp/Slack/Discord/Telegram), skills + tools, ~386k stars. Notable: channel-native, persona-driven, community ecosystem (nanobot, ZeroClaw, IronClaw, NullClaw, Moltis).
- **Hermes Agent** — `https://github.com/NousResearch/hermes-agent` — self-improving CLI agent, persistent memory, automated skill creation, sandboxed code execution via Unix-socket RPC, 300+ models, multi-platform reach. Notable: skill self-evolution, memory durability.

### Terminal-native coding agents (open source)
- **OpenCode** — `https://github.com/anomalyco/opencode` — ~196k stars, MIT, most-starred open harness; provider-agnostic, LSP, privacy-first.
- **Claude Code** — `https://github.com/anthropics/claude-code` — Anthropic's reference agent; deep-reasoning on long tasks; sub-agents.
- **Codex CLI** — `https://github.com/openai/codex` — OpenAI, Apache-2.0, sandboxed, Rust.
- **Cline** — `https://github.com/cline/cline` — Apache-2.0; IDE extension + CLI + SDK; Plan/Act approval modes.
- **Aider** — `https://github.com/Aider-AI/aider` — Apache-2.0; git-native pair programming; every edit a commit; polyglot benchmark.
- **OpenHands** — `https://github.com/All-Hands-AI/OpenHands` — MIT; most autonomous; sandboxed runtime; headless CI.
- **Roo Code** — `https://github.com/RooCodeInc/Roo-Code` — multi-mode (architect/code/debug/orchestrator); checkpoints.
- **Kilo Code** — `https://github.com/Kilo-Org/kilocode` — orchestrator mode, 100s of LLMs, skills.
- **Goose** — `https://github.com/aaif-goose/goose` — MCP-driven general automation.
- **Plandex** — `https://github.com/plandex-ai/plandex` — plan-first, 2M token context.
- **SWE-agent** — `https://github.com/SWE-agent/SWE-agent` — issue/PR resolution, SWE-bench.
- **AutoCodeRover** — `https://github.com/AutoCodeRoverSG/auto-code-rover` — autonomous program improvement via code search.

### Orchestration / multi-agent loops
- **claude-flow** — `https://github.com/ruvnet/claude-flow` — multi-agent swarms, coordinated workflows.
- **AgentsMesh** — `https://github.com/AgentsMesh/AgentsMesh` — remote AI workstations (AgentPods), PTY sandbox + git worktree isolation, Kanban + MR/PR, A2A hub.
- **zeroshot** — `https://github.com/the-open-engine/zeroshot` — planner/implementer/validator isolated loops.
- **Traycer, Bernstein, fractal, h5i, kodo, LoopTroop** — various parallel-agent + verifier orchestrators.
- **great_cto** — `https://github.com/avelikiy/great_cto` — 34 specialist agents across SDLC with compliance gates (PCI/HIPAA/FedRAMP/GDPR/EU AI Act).

### Agent infrastructure / observability / governance
- **HOL Guard** — `https://github.com/hashgraph-online/hol-guard` — intercepts tool calls before files change or network contacted; pre-tool hooks, approval center. Supports Claude Code, Codex, Gemini, Copilot CLI, Hermes, OpenCode.
- **agenttrace** — `https://github.com/luoyuctl/agenttrace` — inspects session logs across 8+ agents; cost/latency/anomaly/health gates.
- **AgentDiff** — `https://github.com/codeprakhar25/agentdiff` — git-native provenance; records which agent wrote which line, ed25519-signed.
- **Vestige** — `https://github.com/samvallad33/vestige` — cognitive memory MCP; FSRS-6 retention, active forgetting, provenance.
- **m1nd** — `https://github.com/maxkle1nz/m1nd` — neuro-symbolic code graph; calibrated-trust retrieval (returns `abstain` instead of guessing).
- **Gate4Agent, OSOP, RoleCraft, skillreaper** — transport/proof/logging/skill-hygiene utilities.

### What the landscape tells us (hypotheses to test, not conclusions)
1. **Provider-agnostic + local-first is now table stakes** (opencode, Cline, Aider all do it). Savant-Code matches this; not a differentiator alone.
2. **Autonomy is the axis everyone is racing** (OpenHands headless, claude-flow swarms, great_cto 34 agents). Savant-Code's autonomy is *governed* (ECHO) — that is the unexploited angle.
3. **Observability/governance tooling (HOL Guard, agenttrace, AgentDiff) is emerging but fragmented** — built as external bolt-ons, not native. Savant-Code has EHEL native. This is a likely wedge.
4. **No mainstream harness has an Adversary meta-verification layer.** This is genuinely unique to Savant-Code.
5. **Agent-to-agent commerce / economies (x402, MCP money) is nascent** — almost nobody ships a native agent economy.
6. **"Addiction loops" / retention mechanics are absent from dev tools** — the category treats users as engineers, not as players. roadmap.sh proved 2.8M users want graph-based progression; gamified learning is open.

---

## Constraints (hard boundaries for every idea)

1. **ECHO is non-negotiable.** Any feature that requires bypassing a law, weakening EHEL, or collapsing separation-of-duties is rejected. Features must *express* ECHO, not fight it.
2. **Local-first, zero-cost preference.** Ideas that require paid SaaS, hosted lock-in, or telemetry leaving the machine are deprioritized. The provider registry model (BYOK, Ollama) is the standard.
3. **No 1:1 adoption.** We study these repos to extract the *idea*, then run it through the Perfection Loop and enhance it 10x with ECHO. Do not propose "add feature X from opencode."
4. **Novel, not derivative.** The goal is the feature that makes a user say "I have never seen a coding agent do THIS." Parity features are explicitly out of scope.
5. **We define the market, not follow it.** Do not optimize for what Claude Code or GitHub Copilot shipped. Optimize for the unoccupied category.
6. **Browser dashboards are opt-in, looking-glass only** (observation, not control) when visual. Terminal/CLI is the primary surface.
7. **Scope-isolate to Savant-Code.** Do not import Nova's personal tooling, the Rust `Savant` monorepo, or other agents' internals. They are separate systems.

---

## Targeted Questions (answer all; name specific ECHO mechanisms where relevant)

### A. Novel / game-changer features
1. What is the single **defining feature** that would make Savant-Code a category of its own rather than "another governed coding agent"? Force a ranked top-3 with a clear #1.
2. The **Adversary meta-verification layer** is unique. What product surface turns that internal discipline into something a user can *see and trust* (e.g., a public "audit trail" view, a trust score, a live adversarial re-check badge)? How does this become a selling point, not just an internal mechanism?
3. **EHEL native governance** vs the bolt-on observability market (HOL Guard, agenttrace, AgentDiff). What native capability — that only a harness with mechanical law enforcement can build — is currently impossible for those external tools? Propose 2–3.
4. **Agent autonomy + safety** is the unresolved tension. How can Savant-Code let an agent run unattended (like OpenHands headless or claude-flow swarms) while ECHO's Present-Before-Act and Verify-Before-Proceed still hold — without making autonomy useless? Design the mechanism.
5. **Agent-to-agent economy / x402 / MCP-money**: almost no harness ships a native agent economy. What would a *governed* agent economy look like inside ECHO (agents earning/spending, with Adversary auditing the ledger)? Is this a defining feature or a distraction?
6. **Code Universe knowledge graph** already exists. What novel interaction turns a static codebase map into a living, navigable, *queryable* surface — e.g., "show me every file the Adversary flagged this week," "trace this bug to its FID," "visualize the blast radius of a planned change before it's made"? Propose the most novel 2.
7. **Checkpoint & Rewind** exists. What if rewind were *fork-aware and branchable like a time-travel debugger* — visualize the decision tree of an agent session, jump to any node, and replay from there with different constraints? How does ECHO's FID loop interact with that?

### B. Improvement of what exists
8. Given the current feature list (providers, design-systems, graph-export, rewind, skills, `/goal`+`/loop`), what is the **weakest link** a new user hits in the first 10 minutes, and what novel onboarding feature fixes it without diluting ECHO?
9. The **FID lifecycle** is powerful but invisible to users. How might a user *author or watch* a FID converge in real time (a "Perfection Loop viewer") without breaking the no-control looking-glass rule?

### C. Addiction loops / retention (tread carefully — must respect ECHO, no dark patterns)
10. roadmap.sh proved graph-based progression retains 2.8M users. What **ethical progression/retention mechanic** fits a coding agent — e.g., a "governance streak" (every session verified clean), a visible "trust index," a per-project "ECHO compliance scorecard" — that builds habit without manipulative dark patterns? Propose 2–3, flag any that would violate ECHO Law 12 (no sensitive data in logs) or user trust.
11. **Agent personality / continuity** as a retention lever: Savant-Code agents are role-bound, not persona-bound. Would a persistent, user-owned agent identity (memory across sessions, named, with ECHO-bound autonomy) increase retention, and how does that square with separation-of-duties? Reference the Stratus/"living city" pattern (an external user runs a Savant-designed system as a persistent city) as a data point.

### D. General / strategic
12. **GitHub just shipped an official Copilot SDK** (`https://github.com/github/copilot-sdk`) — six-language SDK for embedding Copilot's agentic workflows. What does that validate about the market, and what does it leave wide open that Savant-Code (provider-free, ECHO-governed) should claim?
13. **The "agent-output literacy" gap:** new devs steer agents instead of writing code; few can tell clean output from slop. Could Savant-Code's Adversary/Verifier layer become a *teaching* surface (show users why agent code is good/bad) — a novel feature that doubles as a moat? Map the product shape.
14. **One sentence positioning:** if Savant-Code could only be described by its single most defensible, non-replicable feature, what is it, and what must be built to make that sentence true in the product (not just the protocol)?

---

## Output Format (required)

1. **Executive summary** — 6–9 sentences. State the single defining feature thesis upfront.
2. **Landscape compatibility table** — columns: `idea | inspired-by (repo) | compatible with ECHO? (why/why not) | novelty (derivative→category-defining) | effort (S/M/L) | leverage (H/M/L) | key risk`.
3. **The One Feature** — a dedicated section naming the #1 defining feature, with: problem it solves, why only ECHO-native Savant-Code can build it, and a minimal FID-shaped sketch (RED/GREEN/AUDIT/ADVERSARIAL intents, not implementation).
4. **Top 5 recommended explorations** — concrete, each with ECHO integration notes and which agent(s) would own it.
5. **Addiction-loop / retention section** — ethical mechanics only, each flagged for ECHO compatibility.
6. **Architecture sketch** — where each idea lives in the monorepo (which package: `cli/`, `common/`, `packages/agent-runtime/`, `sdk/`, `packages/knowledge-graph/`, `agents/`), what existing primitive it leverages.
7. **Governance flags** — any ECHO law/EHEL change required (most should require NONE — flag ideas that would need one).
8. **Sequencing** — phased build order; what ships first as the wedge.
9. **What this proves no other tool can** — the unique value proposition paragraph.
10. **Rejected ideas** — features considered but explicitly out of scope (parity, dark patterns, SaaS-lock-in), with the reason.

---

## What We Are NOT Asking

- Do NOT propose adopting OpenClaw/Hermes/opencode/Claude Code architecture 1:1.
- Do NOT propose a hosted SaaS, telemetry-based business model, or cloud lock-in.
- Do NOT propose weakening ECHO, EHEL, or separation-of-duties to enable a feature.
- Do NOT propose feature parity with GitHub Copilot SDK or Claude Code as a goal.
- Do NOT import Nova's personal evolution tooling, the Rust `Savant` monorepo, or any non-Savant-Code system.

---

## Notes

- This is **exploration, not commitment**. No feature here is approved. Adoptable ideas go through the Perfection Loop (FID) before any code.
- "We take the idea and run the loop and make it 10x better than the source." Study → retrofit → enhance.
- The attached `CHANGELOG.md` is the current capability ceiling — do not propose features Savant-Code already ships; build past them.
- Prefer ideas that are **impossible without ECHO's mechanical governance** — that is the moat, and the market has no equivalent.
- Return the structured output above. Depth over breadth; one defining feature beats ten parity features.
