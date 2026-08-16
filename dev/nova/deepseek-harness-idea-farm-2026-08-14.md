<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Idea Farm — `resources/deepseek-harness` (`dsh`)

**Auditor:** Nova
**Date:** 2026-08-14
**Clock:** Friday, 04:00 AM EDT
**Target:** `C:\Users\spenc\dev\savant-code\resources\deepseek-harness\` (DeepSeek Harness `dsh`, dev preview `v0.1.0-rc.5`, MIT)
**Purpose:** Competitive idea-farming — what in `dsh` is worth porting to **Savant-Code**, and what Savant-Code already covers (so we don't rebuild it). NOT a security review (that exists separately at `dev/nova/deepseek-harness-deep-audit-2026-08-14.md`).

---

## 0. What `dsh` is (product read)

`dsh` is a **plugin-everything AI coding-agent harness** on a vendored Cordis DI container. A running instance is a **plugin tree composed at boot** from ordered layers: a `profile` lists `bundle`s, each bundle is Cordis config rows + the code they mount, and `cordis.patch.yml` overlays let any layer replace any row. There is **no privileged core** — model adapter, tool registry, session log, and agent loop are all plugins.

Core model: **capability seams** (Service Definition / Provider / Consumer triad), an **event-driven agent loop** (`agent/pre-step` waterfall → `tools/*` pipeline → `step/end`), and a **session-event log as the single source of model context** ("model-visible means logged" — a runtime invariant). Capability packages: subagent, workflow (worker-thread), plan, todo, skill, compaction, self-modification, hooks (Claude Code / Codex bridges), session (persistence/query/title/telemetry), identity, settings, credentials.

---

## 1. Idea-farm matrix — `dsh` capability → Savant-Code

| `dsh` capability | Worth porting? | Savant-Code status | Verdict |
|---|---|---|---|
| **Plugin-tree composition** (profiles/bundles/`cordis.patch.yml` layered overrides) | **Maybe** | Savant-Code has ONE `savant.ts` with mode preambles + ECHO-gated tools. No runtime plugin-tree. | Interesting as a *composition* pattern, but Savant's ECHO FSM + FID system already enforces what `dsh` does with patch-layers. Don't copy the mechanism; note the "every part replaceable from config" philosophy. |
| **Capability seams** (Definition/Provider/Consumer triad) | **Yes (concept)** | Savant has tool handlers + agent defs but no uniform seam contract. | The triad is a clean way to express "swappable capability." Worth borrowing the *vocabulary* for Savant's own extension points. |
| **Session-event log = single model-context source** + "model-visible means logged" invariant | **Strong yes** | Savant has `provenance` (ZTAP receipts) + TUI snapshot, but NOT a single append-only session log that *is* the model context. | This is the cleanest idea in `dsh`. Savant's context comes from `messageHistory` + injected state; `dsh`'s "derive model history from one log" is more robust for fork/resume/telemetry. **Farm this.** |
| **Subagent seam** (continuable children, **cold-resume from persisted session**, depth-monotone `delegationDepth`, parent-authority-scoped follow-up/interrupt) | **Strong yes** | Savant has `spawn-agents`/`spawn-agent-inline` (verdict-binding spawners, FID-023) but **no general delegation seam** with resume/depth-authority. | `dsh`'s subagent seam is the most mature thing here. Continuable + cold-resume + monotone depth is exactly what Savant lacks for multi-agent orchestration. **Farm this — highest-value find.** |
| **`agent/pre-step` waterfall** (rewrite/reject claimed messages before the model sees them) | **Yes** | Savant's loop has pre-step enforcement (ECHO `beforeToolCall`) but not a message-rewrite waterfall. | The "intercept + rewrite the model's input" hook is a clean extension point. Savant's ECHO could express this as a Law. |
| **Plan mode as logged state** (`plan` package) | **Maybe** | Savant has FID planning + Teacher, but no in-harness "plan mode" the model can toggle. | Low priority — Savant's FID process already covers planning better than a toggle. |
| **Todo/write tool** | **No** | Trivial; not a differentiator. | Skip. |
| **Workflow (worker-thread provider)** | **Maybe** | Savant runs agents in-process/background. | Only relevant if Spencer wants parallel worker threads. Note, don't prioritize. |
| **Self-modification** (agent inspects/mounts its own plugins) | **No (yet)** | Out of Savant's scope; ECHO forbids self-modification by design (immutable core). | Deliberately NOT a fit — Savant's immutable-core + co-sign rule is the *opposite* philosophy, and that's correct. |
| **Hooks (Claude Code / Codex bridge)** | **Yes (FID-003 already covers this)** | FID-2026-0814-003 is porting kimi-code's hook architecture. | `dsh`'s hook bridges are a *second reference* for FID-003. Cross-check. |
| **Compaction as a seam** (`compaction` + `tool-result-pruner`, model-free pruning) | **Yes** | Savant has `context-compactor` + `context-pruner` (FID-001/006). | `dsh`'s "model-free tool-result pruner" seam is a cleaner abstraction than Savant's inline pruner. Compare for FID-006. |

---

## 2. Top 3 to farm (ranked)

### 🥇 #1 — Subagent delegation seam with cold-resume + monotone depth
`dsh`'s `ctx.subagents` API (`start`, `startContinuable`, `followup`, `interrupt`, `listDescendants`) is the single most valuable idea here. Key insights to port:
- **Continuable children** persist a `subagent/descriptor` session event; cold-resume reconstructs the child's composition from the log (not the deployment default).
- **`delegationDepth` is monotone** — a resumed child can never be re-counted as top-level (prevents depth-escalation bugs).
- **Follow-up/interrupt authority is scoped to the exact live direct parent** — a wrong/stale/self-targeting caller is rejected (`UNAUTHORIZED`).
- **`applyChildComposition(childCtx, parent, composition)`** joins the parent's preset before applying the child's persona/tool-filter — composing a child *without* the join is unrepresentable at call sites (defensive design).

**Why Savant wants it:** Spencer's multi-agent roster (Orchestrator/Forge/Verifier/etc.) currently spawns via `spawn-agents`/`spawn-agent-inline` with verdict-binding semantics. A general, resumable, depth-bounded delegation seam would let Savant do long-running subagent trees without the current ad-hoc spawners. This is a structural upgrade, not a tweak.

### 🥈 #2 — Session-event log as the single model-context source
`dsh` makes the append-only `SessionEvent` log *the* context the model sees (`deriveMessages()` projects history from it; "model-visible means logged" is a runtime invariant). Fork, resume, transcript, telemetry, persistence all derive from one stream.
**Why Savant wants it:** Savant's context is currently `messageHistory` + injected agent state + ZTAP receipts. A single log-as-source-of-truth would make resume/fork/audit (ZTAP!) cleaner — and ZTAP receipts could become first-class log events. This aligns with Spencer's "knowledge graph / provenance" direction.

### 🥉 #3 — Capability-seam triad as Savant's extension vocabulary
Even if Savant doesn't adopt Cordis, the **Service Definition / Provider / Consumer** triad is a clean mental model for Savant's own extension points (LLM providers, tools, sandbox, approval). Use it to document Savant's seams consistently — especially for FID-003 (hooks) and the provider-agnostic compute strategy.

---

## 3. What Savant-Code already does better (don't farm)

- **ECHO Protocol** (15-law FSM, Perfection Loop, circuit breakers, immutable core + co-sign) — `dsh` has *no* equivalent enforcement. Its guards are per-tool timeouts, not a process-law system. Savant's discipline is strictly stronger.
- **ZTAP signed provenance** — `dsh`'s credential/telemetry seams are good, but nothing matches Ed25519-signed verdict receipts.
- **Teacher / Agent-Steering** — no `dsh` equivalent.
- **Adversary override** — `dsh` has no adversarial review layer.
- **FID system** — `dsh` has "Agent Notes" per change, not evidence-backed FIDs.

**Net:** `dsh` is a cleaner *composition/runtime* architecture; Savant is a stronger *governance* architecture. The farm is runtime mechanics (subagent seam, log-as-source), not governance.

---

## 4. Cross-reference to active FIDs

- **FID-2026-0814-003 (hooks):** `dsh`'s `hooks-claude-code` / `hooks-codex` packages are a *second reference* alongside kimi-code. Cross-check the EHEL-wins composition rule.
- **FID-2026-0814-006 (compaction):** `dsh`'s `compaction-tool-result-pruner` (model-free pruning seam) is a cleaner abstraction than Savant's inline `context-pruner`. Compare for the "no visible lifecycle" fix.
- **FID-2026-0814-002 (goal mode):** `dsh` has no goal engine either — kimi-code remains the better port reference there.

---

## 5. Recommendation

**Farm #1 (subagent seam) and #2 (log-as-source) into a future Savant-Code RFC.** Both are structural upgrades to Spencer's multi-agent runtime that his current spawner-based approach lacks. #3 is documentation-only.

**Do NOT farm:** self-modification (antithetical to ECHO immutable-core), plan/todo (covered), workflow worker-threads (nice-to-have).

**Priority:** #1 subagent seam > #2 session log > #3 vocabulary. None are urgent vs. the six FIDs already in flight; park as a post-release architecture RFC.

---

*Idea-farm by Nova, 2026-08-14 (04:00 AM EDT). Source: `dsh` AGENTS.md, docs/architecture.md, docs/capability-seams.md, packages/subagent README, packages/core/agent. Competitive research only — no code modified.*
