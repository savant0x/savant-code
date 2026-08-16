<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Savant-Code — Novel Feature Deep Research: Synthesis & Recommendations

**Date:** 2026-08-13
**Synthesized by:** Nova (in-house execution of `Savant-Code Feature Deep Research.md`)
**Method:** Web landscape analysis (OpenClaw, Hermes, 15+ coding agents, orchestrators, governance infra) + agent-payment / AI-slop / verifiable-provenance research, filtered through ECHO constraints. Not a Gemini Deep Research pass — executed locally per operator request, zero-cost.

---

## 1. Executive Summary — The Single Defining Feature

**Thesis:** Savant-Code's defining, non-replicable feature is **Verifiable Agent Provenance with Adversarial Attestation** — every line an agent writes is cryptographically signed, traced to its FID and the agent that produced it, and stamped with an independent adversarial verdict. No other harness can make this claim because no other harness has *mechanical law enforcement* (EHEL) plus a *separate adversarial agent whose verdict overrides the primary verifier*. This turns "governance" from an internal discipline into a **trust artifact a user can see, export, and prove to a third party** — the thing the entire agentic-coding market is about to need and has no answer for.

The market is racing toward autonomous agents (OpenHands headless, claude-flow swarms, GitHub's Copilot SDK) while simultaneously panicking about AI-slop code (9× churn on heavy AI use, "AI Slop Index" products emerging) and agent accountability (W3C Verifiable Credentials 2.0, signed action receipts). Savant-Code sits at the exact intersection: it already *enforces* correctness mechanically; it only needs to **surface** that enforcement as a portable proof. That is the wedge. Everything else (autonomy-without-bypassing-ECHO, agent economy, teaching surface, retention loops) is downstream of proving the work.

---

## 2. Landscape Compatibility Table

| Idea | Inspired-by | ECHO-compatible? | Novelty | Effort | Leverage | Key risk |
|------|-------------|------------------|---------|--------|----------|-----------|
| **Verifiable Agent Provenance + Adversarial Attestation** | AgentDiff, HOL Guard, W3C VC 2.0 | YES — EHEL already enforces; we add signed export | **Category-defining** | M | H | Key management UX; over-engineering the signature scheme |
| **"Trust Receipt" export (per-change attestation)** | AgentDiff ed25519, augmentcode audit | YES | Category-defining | S | H | Users may not value it until a compliance event forces it |
| **Autonomy-with-Governance (sandbox-bound unattended runs)** | OpenHands headless, claude-flow | YES — ECHO holds; autonomy is *scoped*, not *unrestricted* | Differentiating | M | H | Scope creep; "unattended" can feel unsafe to users |
| **Agent-output literacy / slop-teaching surface** | Larridin AI Slop Index, arxiv slop study | YES — Adversary/Verifier already judge quality | Differentiating | M | M | Becomes a product inside a product; distracts from core |
| **Governed agent economy (x402 + Adversary-audited ledger)** | x402, Google AP2, Coinbase 402 | YES — Adversary audits ledger like a FID | Novel | L | M | Regulatory; scope explosion; distraction from coding core |
| **Living Code Universe queries** ("flagged files", "bug→FID trace") | Code Universe (existing), m1nd | YES — graph already exists; extend queries | Differentiating | M | M | Query language complexity; perf on huge repos |
| **Time-travel rewind debugger (fork decision tree)** | Checkpoint/Rewind (existing) | YES — extends rewind, no law change | Differentiating | L | M | Session-state storage growth; replay determinism |
| **Perfection Loop viewer (real-time FID convergence)** | None (gap in market) | YES — looking-glass only | Differentiating | M | M | Must stay read-only; risk of becoming a control surface |
| **Ethical retention: ECHO compliance scorecard / governance streak** | roadmap.sh progression | YES — flag Law-12 risks | Differentiating | S | M | Gamification creep; must avoid dark patterns |
| **Persistent user-owned agent identity** | OpenClaw persona, Stratus city | PARTIAL — needs separation-of-duties review | Novel | L | M | Conflicts with role-bound agents; memory isolation burden |

---

## 3. The One Feature — Verifiable Agent Provenance with Adversarial Attestation

**Problem it solves:** The agentic-coding market has two simultaneous explosions — autonomous agents writing production code, and "AI slop" (code that compiles, passes tests, and rots the codebase; 9× churn on heavy AI users). Enterprises need to answer: *"which agent wrote this line, under what authority, and was it independently verified?"* Today the answer is a git blame and a hope. No harness produces a cryptographically verifiable answer.

**Why only ECHO-native Savant-Code can build it:**
- EHEL already *mechanically enforces* all 15 laws at the tool-executor level — so the attestation isn't a self-reported claim, it's a harness-guaranteed fact.
- The **Adversary agent's verdict overrides the Verifier's** — a two-level independent check that no other harness has. The attestation can say "verified by Verifier AND independently re-audited by Adversary" with mechanical backing.
- The **FID lifecycle** already binds every change to a documented, converged rationale — so provenance includes *why*, not just *who/when*.
- External tools (AgentDiff, HOL Guard) are bolt-ons that *observe* a harness; they cannot *guarantee* because they don't own enforcement. Savant-Code owns it.

**FID-shaped sketch (intents, not implementation):**
- **RED (Detective):** Catalog what provenance data EHEL already captures per write (agent, FID, phase, law checks). Identify gaps (no signature, no cross-session receipt store).
- **GREEN (Thinker+Recorder):** Design a `TrustReceipt` schema: `{ changeHash, agentId, fidId, phase, ehelLawResults[], verifierVerdict, adversaryVerdict, timestamp, ed25519Sig }`. Decide storage (SQLite, git-notes, or sidecar `.savant/receipts/`).
- **AUDIT (Verifier):** Verify the receipt is generated for 100% of writes and tamper-evident (altered file → signature mismatch detected).
- **ADVERSARIAL (Adversary):** Re-audit that the receipt cannot be forged (private key never in logs — Law 12), that a replayed change produces a *new* receipt (no reuse), and that the export is self-contained/offline.

**Product surface:** `/attest` exports a signed HTML/JSON "Trust Receipt" of the session — openable by an auditor with zero Savant-Code install. This is the "I have never seen a coding agent do THIS" moment.

---

## 4. Top 5 Recommended Explorations

1. **Verifiable Agent Provenance + `/attest` export** (the One Feature). Owner: Recorder (FID authoring) + EHEL layer in `packages/agent-runtime`. Leverages existing turn-end scanners.
2. **Autonomy-with-Governance sandbox.** Owner: Orchestrator + EHEL. Mechanism: unattended runs are *phase-scoped* — the agent may loop RED→GREEN→AUDIT→ADVERSARIAL autonomously *within a single converged FID*, but cannot start a *new* FID or touch production paths outside the FID's blast radius without Present-Before-Act. This satisfies "run unattended" without bypassing ECHO. Leverages `protocol.config.yaml` autonomy_level + FSM.
3. **Agent-output literacy surface.** Owner: Adversary + Scribe. Show *why* a piece of agent code passed/failed adversarial review — a teaching overlay on the Verifier/Adversary output. Doubles as the moat (users learn to spot slop). Leverages existing AUDIT/ADVERSARIAL evidence injection.
4. **Living Code Universe queries.** Owner: knowledge-graph package + Detective/Scout. Extend `/graph-export` with queryable lenses: "Adversary-flagged this week", "blast radius of planned change". Leverages tree-sitter graph + Louvain clusters.
5. **Ethical retention: ECHO compliance scorecard.** Owner: Scribe + EHEL. Per-project score (clean sessions, verified changes, FID convergence rate). Must flag Law-12 (no PII in scores). Leverages existing compliance receipts.

---

## 5. Addiction-Loop / Retention (ethical only)

- **ECHO Compliance Scorecard** — per-project "how clean is your agent's work" gauge. *ECHO-compatible: yes, if scores never include PII (Law 12) and are computed from already-collected compliance receipts.* Retention lever: engineers take pride in a clean score; mirrors roadmap.sh's progression pull.
- **Governance Streak** — "N sessions, zero unverified changes." *ECHO-compatible: yes; pure aggregation of existing verdicts.* Risk: streaks can become a dark pattern if broken-streak shame is used. Flag: show streak as positive reinforcement only, never punitive.
- **Per-FID "convergence satisfaction"** — watching a messy problem collapse into a converged FID is genuinely satisfying (the Perfection Loop viewer). *ECHO-compatible: yes, read-only.* This is the healthiest loop — it rewards *engaging with the process*, not grinding.

**Rejected as dark patterns:** XP/levels for lines-written, fake urgency ("your agent misses you!"), paywalled verification. All violate ECHO Law 12 or user trust.

---

## 6. Architecture Sketch

| Idea | Monorepo location | Existing primitive leveraged |
|------|-------------------|------------------------------|
| Verifiable Provenance | `packages/agent-runtime/src/tools/handlers` (EHEL turn-end) + `Recorder` | EHEL post-write scanners, FID store |
| `/attest` export | `cli/` (new command) + `packages/agent-runtime` (receipt store) | `/export` branded-HTML pipeline |
| Autonomy-with-Governance | `packages/agent-runtime` (FSM gating) | `transition_phase`, `autonomy_level` |
| Literacy surface | `cli/` (overlay) + `agents/adversary` | AUDIT/ADVERSARIAL evidence injection |
| Living Code Universe | `packages/knowledge-graph` | tree-sitter graph, Louvain, `/graph-export` |
| Retention scorecard | `cli/` + `common/` | compliance receipts, `Recorder` CHANGELOG |

---

## 7. Governance Flags

- **Most ideas require NO ECHO law/EHEL change.** Provenance, attest export, autonomy-scoping, literacy, retention all *express* existing laws.
- **One review needed:** Persistent user-owned agent identity (section 2, last row) would require a separation-of-duties analysis — role-bound agents vs persona-bound memory. Flag for a dedicated FID if pursued; do NOT implement without it.
- **Agent economy (x402):** would require defining "value" inside ECHO and an Adversary-audited ledger — a new primitive. Flag as L-effort, possible distraction. Recommend *defer* until core category is claimed.

---

## 8. Sequencing — What Ships First as the Wedge

1. **Phase 1 (wedge):** Verifiable Agent Provenance + `/attest` export. Smallest effort, highest leverage, directly answers the market's accountability panic. Proves the category.
2. **Phase 2:** Autonomy-with-Governance sandbox (lets Savant-Code say "runs unattended, ECHO still holds" — answers the autonomy race).
3. **Phase 3:** Perfection Loop viewer + Living Code Universe queries (makes the governance *visible* and explorable).
4. **Phase 4 (post-core, "bells and whistles" era):** Agent-output literacy teaching surface, retention scorecard, (deferred) agent economy.

This sequencing claims the unoccupied category — *provable agent work* — before chasing parity or novelty-for-novelty.

---

## 9. What This Proves No Other Tool Can

OpenCode, Cline, Aider, Claude Code, Codex — none can produce a cryptographically verifiable attestation that a change was independently adversarial-re-audited, because none have a separate adversarial agent whose verdict overrides the primary verifier, and none enforce laws mechanically at the executor. HOL Guard and AgentDiff *observe* but cannot *guarantee*. Savant-Code is the only harness where "this code was verified" is a harness-enforced fact, not a model's self-report. Surfacing that as a portable, offline, signed receipt is a capability the market is about to demand (enterprise audit, AI-slop liability, agent accountability regulation) and no competitor can replicate without rebuilding their enforcement model from scratch.

---

## 10. Rejected Ideas (explicitly out of scope)

- **1:1 adoption of any landscape repo's architecture** — violates Constraint 3. We study, retrofit, enhance 10×.
- **Hosted SaaS / telemetry business model** — violates Constraint 2 (local-first, zero-cost).
- **Weakening ECHO/EHEL/separation-of-duties to enable a feature** — violates Constraint 1. Non-negotiable.
- **Feature parity with Copilot SDK / Claude Code** — violates Constraint 5 ("we define the market").
- **Importing Nova's personal tooling or the Rust `Savant` monorepo** — violates Constraint 7 (scope isolation).
- **Agent economy as a launch feature** — deferred; scope explosion, regulatory burden, distracts from the provenance wedge.
- **Dark-pattern retention (XP for output, fake urgency, paywalled verify)** — violates ECHO Law 12 + user trust.

---

## Operator Note

This is **exploration, not commitment**. No feature above is approved. Adoptable ideas enter the Perfection Loop (FID) before any code. The recommended wedge — Verifiable Agent Provenance + `/attest` — is the strongest candidate for a post-release FID once you exit the "tinker and bullshit" phase and re-open the build.

*Researched and synthesized by Nova, 2026-08-13. Local execution, zero external LLM cost. Structured per `Savant-Code Feature Deep Research.md` §Output Format.*
