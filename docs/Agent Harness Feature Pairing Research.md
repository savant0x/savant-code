# Agent Harness Feature Pairing Research

**Author:** Savant
**Date:** 2026-08-03
**Status:** research — no FIDs opened yet
**Scope:** Full catalog scan of `resources/` (~120 repos, 0 unscanned), consolidating
two prior scan reports plus four live sweeps, distilled into feature pairings
relevant to Savant-Code.

---

## 1. Method

- `resources/_SCAN_REPORT.md` and `resources/SCANNING-REPORT.md` cover 44 repos
  (Bernstein, Forge, Entroly, ctxlint, Cline, Zero, mini-swe-agent, Kimi Code,
  OpenCode, Aider, Codex, Goose, OpenHands, Hermes, Gemini CLI, and others).
- Four additional sweeps covered the remaining ~76 repos, with deep dives on the
  high-signal candidates: DeepSeek-Reasonix, sourcebook, OpenSpec, agenttrace,
  ORCH, pi-steering-hooks, prpack, LoopTroop, IM.codes, TokenWise, codesight,
  iwe, brood-box, Shep, Spartan, onUI, Jctx, SwarmVault, GolemBot, and more.
- Findings were relevance-filtered against Savant-Code's architecture (agent
  runtime, CLI, SDK, ECHO Protocol, checkpoints, permissions, sub-agents).

The organizing principle is **feature pairing**: single features rarely move the
needle; pairs that multiply each other's value are what ship.

---

## 2. The Pairing Map

### 2.1 Coding ↔ Coding pairs

| Pair | Why they multiply | Proven by |
| --- | --- | --- |
| Guardrails ↔ Audited override | Deterministic blocking works because of a logged escape hatch; agent proceeds with `# steering-override: <rule>` but it is audited; `noOverride` rules stay absolute | pi-steering-hooks |
| Checkpoints ↔ Per-file landing review | Snapshot before is half; reviewing each change before it lands (COW snapshot + accept/reject) is the other half | brood-box, Savant FID-2026-0803-004 |
| Tier routing ↔ A/B verification | Routing to cheap models is faith without proof; run the same task on two tiers, diff outputs, then trust the router | TokenWise |
| Spec artifacts ↔ Verify gates | Proposal/spec/design/tasks pay off only when implementation is checked against them (scored PASS/REWORK/BLOCKED) | OpenSpec, Spartan, IM.codes |
| Memory ↔ Graph retrieval | Storing facts is useless without graph-structured recall (parent-context expansion, fuzzy find) | iwe, SwarmVault, Entroly |
| Worktrees ↔ Parallel agents | One agent per isolated branch: zero conflicts, review diffs, merge wins | Shep, ORCH, parallel-code |
| CI-watch ↔ Auto-fix loop | Agent opens PR, harness watches CI, failure logs loop back to the agent before merge | Shep |
| Context isolation ↔ Sub-agents | Bead-level context (only active unit + its files) prevents rot the way sub-agent firewalls do | LoopTroop, OpenCode |
| Evidence ledger ↔ Completion gates | Receipts per tool call + `complete_step` proof means no completion claim without evidence | DeepSeek-Reasonix, Bernstein |
| Diff completeness ↔ Review | Detect files the agent forgot to change (co-change, siblings, missing tests) before review | sourcebook |
| Full-file context ↔ Review | Reviewer gets full post-change file contents + sibling tests, not just diffs | prpack |

### 2.2 Coding ↔ General bridges

| Pair | The bridge | Proven by |
| --- | --- | --- |
| Coding agent ↔ IM gateway | Coding agents get Slack/Telegram/Discord/Feishu/WeChat bodies — the agent you already have becomes a 24/7 teammate | GolemBot (13k+ OpenClaw skills) |
| Coding agent ↔ UI annotation | Annotate any webpage (intent+severity markers, draw regions, export formats) → direct agent input | onUI |
| Coding agent ↔ Knowledge wiki | Docs/code/transcripts → durable markdown wiki + queryable graph handed to agents | SwarmVault, iwe |
| Coding agent ↔ OpenAPI→formats | One OpenAPI spec → MCP server + CLAUDE.md + AGENTS.md + .cursorrules + A2A card + CLI | agentify |
| Coding agent ↔ Remote session | Mobile/web terminal access to running sessions, git views, localhost preview, pair invites | IM.codes |
| Coding agent ↔ Asset registry | Typed-contract install of skills, prompts, MCP configs, workflows | TokRepo |
| Coding agent ↔ Always-on scheduler | Heartbeats + cron + delegation → autonomous agents that keep working | SwarmClaw, Dorothy |
| Coding agent ↔ Supervision board | Reviewer agent files ranked findings against task; nothing reaches Done until triaged | Kagan |

### 2.3 General ↔ General pairs

| Pair | Why | Proven by |
| --- | --- | --- |
| Org chart ↔ Delegation | Role hierarchy visualized with live activity → natural delegation | SwarmClaw |
| Conversation ↔ Skill learning | Reviewed conversations become reusable skills (user-reviewed, not silent) | SwarmClaw, Hermes |
| Kanban ↔ Auto-assignment | Tasks auto-assigned to agents by capability; dependency chains | Dorothy, Cline |
| Vault ↔ Audit | Hash-chained append-only ledger + atomic rollback on every change | os-moda, Bernstein |

---

## 3. Top 5 Adoptions for Savant-Code

Each is a *pair*, not a single feature. Verified against the codebase.

| # | Pair | Savant fit | Effort |
| --- | --- | --- | --- |
| 1 | Guardrails + audited override (pi-steering-hooks) | plugs into `/permissions` + `run-readonly-command.ts`; zero-token ECHO enforcement | S–M |
| 2 | Checkpoints + per-file landing review (brood-box) | extends checkpoint-store (review diffs before accepting writes) | L–M |
| 3 | Tier routing + A/B verification (TokenWise) | plugs into model picker + per-agent model config | M |
| 4 | Spec artifacts + verify gates (OpenSpec/Spartan) | grafts onto FID lifecycle (scored PASS/REWORK/BLOCKED) | M |
| 5 | Coding agent + IM gateway (GolemBot) | biggest product expansion: Savant as a team teammate | L |

### Detailed notes on the top 5

**1. Guardrails + audited override.** Rule format `{ tool, field, pattern,
requires?, unless?, reason, noOverride? }` intercepts tool calls before
execution. The override comment (`# steering-override: <rule>`) lets the agent
proceed with a logged reason; `noOverride: true` rules (e.g. `rm -rf /`) cannot
be bypassed. Default rules block long-running commands and enforce conventional
commits. Zero token cost, 100% reliability — the "ratchet rule" from harness
engineering made literal.

**2. Checkpoints + per-file landing review.** brood-box boots a COW workspace
snapshot, lets the agent work, then requires interactive per-file diff review
before anything lands. Savant already has checkpoint-store (per-turn snapshots,
first-capture dedup, restore). Adding a pre-landing review gate (accept/reject
each changed file with unified diffs) completes the edit-safety story.

**3. Tier routing + A/B verification.** TokenWise cites Anthropic issue #27665:
93.8% of Max-subscriber tokens flow to Opus even when Haiku suffices. Three
tiers (mechanical / scoped reasoning / synthesis) with safety caps: cheap tier
never spawns subagents, max spawn depth 2, trivial tasks run inline, context
>30k tokens escalates a tier. The `/ab` command runs a task on two tiers, diffs
outputs, scores quality before trusting the router. Every routed call logs
NDJSON with real token/cost.

**4. Spec artifacts + verify gates.** OpenSpec's change directory
(`proposal.md → specs/ → design.md → tasks.md → apply → verify → sync →
archive`) with `/opsx:verify` checking three dimensions (completeness,
correctness, coherence) and reporting CRITICAL/WARNING/SUGGESTION. IM.codes
adds automatic module scoring (spec/tasks/implementation/tests/risk) with
PASS/REWORK/BLOCKED verdicts and rework gates. Grafts onto the FID lifecycle.

**5. Coding agent + IM gateway.** GolemBot connects existing coding agents
(Claude Code, Codex, OpenCode) to Slack, Telegram, Discord, Feishu, DingTalk,
WeCom, WeChat, or any HTTP client — "the agent you already have is the brain."
One config block routes any provider; no framework, no prompt engineering.

---

## 4. Validated as already-correct in Savant-Code

The catalog repeatedly validated Savant's existing machinery — no adoption
needed:

- Context isolation + sub-agent firewalls (FID-007 tool-set filtering)
- Multi-tier compaction with stale-tool-result clearing and reactive compact
- Checkpoints/rewind (matches Claude Code and DeepSeek-Reasonix designs)
- Skills with progressive disclosure (matches the skills standard)
- Permission modes + dangerous-command regex blocking
- Phase-gated tool access (schema-level gating)
- Forge/Verifier split (Generator-Evaluator separation)
- Ratchet-rule loop (FID → LEARNINGS → eslint rules)

---

## 5. Notable ecosystem patterns observed (for context)

- **Content-addressed everything** (Bernstein, Entroly, Forge): hash every
  artifact and journal entry; same inputs reproduce byte-identical outputs.
- **Merkle-chained event journals** (Bernstein, os-moda): tamper detectable at
  the exact step.
- **Disk-based state machines** (Forge, Bernstein): crash recovery from disk,
  not memory.
- **Select-then-compress** (Entroly): choose highest-value evidence before
  compressing; keep originals recoverable.
- **Fail-open hooks** (Kimi Code): hooks enhance, never block the agent.
- **Steering accuracy beats prompts** (pi-steering-hooks, Strands Agents):
  deterministic before-tool rules over instruction-following.

---

## 6. Sources

- HumanLayer — "Skill Issue: Harness Engineering for Coding Agents" (Mar 2026)
- Anthropic Engineering — harness design for long-running agents
- OpenAI Engineering — "Harness engineering: leveraging Codex in an agent-first
  world"
- ETH Zürich — agentfile study (138 agentfiles)
- Chroma — context rot research; LongCLI-Bench
- Repos in `resources/` (see method above): pi-steering-hooks, brood-box,
  TokenWise, OpenSpec, Spartan, IM.codes, sourcebook, prpack, LoopTroop,
  GolemBot, SwarmVault, iwe, onUI, agentify, Shep, ORCH, agenttrace, tokscale,
  onwatch, WhereMyTokens, Kilo Code, Refact, codesight, Jctx, DeepSeek-Reasonix,
  os-moda, SwarmClaw, Dorothy, Kagan, and the repos covered by the two prior
  scan reports.
