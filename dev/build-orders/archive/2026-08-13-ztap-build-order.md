<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Build Order — Zero-Trust Agentic Provenance (ZTAP) & Governance Surface

> **Status note (2026-08-13):** this build order's **P1 wedge was implemented** under FIDs `FID-2026-0813-001` through `FID-2026-0813-010`; the FIDs are closed and archived, and Nova returned an independent implementation sign-off PASS. P2–P4 remain planning-only and are not authorized. See `docs/design/zero-trust-agentic-provenance.md`.

**Date:** 2026-08-13
**Status:** P1 IMPLEMENTED — FIDs 001–010 closed/archived; Nova implementation sign-off PASS. P2–P4 remain planning-only.
**Author:** Nova (build-order lane)
**Target:** Savant-Code v0.0.23+ (`C:\Users\spenc\dev\savant-code`)
**Source research:** `docs/design/Savant-Code Feature Deep Research.md` (Gemini synthesis + Nova in-house pass)
**Execution model:** This is a BUILD ORDER (plan + FID grouping). The target harness model executes the FIDs. Nova does not author FIDs here — she defines the plan and the verification gates.

---

## Thesis (one line)

Cryptographically sign every agent-written change at the EHEL write boundary, proving it passed RED→GREEN→AUDIT→ADVERSARIAL, and surface that proof as a visible trust artifact — turning Savant-Code's invisible governance into a category-defining, non-replicable selling point.

**Value case (for the trigger decision):** This is an *enterprise/compliance* feature, not a "code faster" feature. It is cheap to build (EHEL already enforces everything; we add signing + export). It is impossible for competitors (OpenCode, Claude Code, Copilot SDK) to replicate because none have mechanical law enforcement + a separate adversarial agent whose verdict overrides the verifier. The market is about to demand agent-code accountability (AI-slop liability, attribution regulation). This claims that category before anyone else.

---

## Phase Sequencing

| Phase | Scope | Leverage | Effort | Trigger gate |
|-------|-------|----------|--------|--------------|
| **P1 — Wedge** | ZTAP signing + `/attest` export + Live Adversarial Trust Matrix | Highest | M | Spencer resolves design Q1–Q4 |
| **P2 — Retention** | ECHO Compliance Scorecard + FSRS-6 Scribe memory | Medium | M | P1 shipped + stable |
| **P3 — Deep architecture** | Multiverse Counterfactual Debugging + Semantic Vulnerability Topography | Medium | L | P2 adopted |
| **P4 — Economic horizon (DEFERRED)** | x402 agent bounties | High but risky | L | Post-core; regulatory review |

P1 is the wedge. P4 is explicitly deferred — scope explosion + stablecoin regulation. Do not trigger P4 until P1–P3 proven.

---

## Phase 1 — ZTAP Wedge (the build)

### P1.A — Ed25519 Provenance at the EHEL Boundary

**What it does:** When Forge (or any agent) finalizes a write, EHEL intercepts the `write_file`/`apply_patch` payload, computes a SHA-256 hash of the change, and holds the write pending until the AUDIT and ADVERSARIAL phases produce their signatures. On complete signed chain, the write releases and a receipt appends to `.savant/provenance/`.

**FID grouping (target agent executes these):**
- `FID-ztap-001` RED: catalog what EHEL already captures per write (agent id, FID id, phase, law-check results). Identify the exact interception point in `tool-executor.ts`.
- `FID-ztap-002` GREEN: design `common/src/crypto/` — deterministic Ed25519 keypair gen (WebCrypto/Bun), SHA-256 change hash, JCS canonicalization of receipt JSON, signature validate. Fail-closed default.
- `FID-ztap-003` GREEN: wire interception into `packages/agent-runtime/src/tools/tool-executor.ts` — hold write, collect Verifier + Adversary signatures, append receipt to `.savant/provenance/`.
- `FID-ztap-004` AUDIT: test signature gen/verify, key custody (ephemeral session keys or OS keychain; never in logs — Law 12), latency overhead on interactive writes.
- `FID-ztap-005` ADVERSARIAL: simulated replay/forgery attack — reject same-entity signatures (Forge≠Verifier), enforce JCS canonicalization, reject stale receipts.

**Architecture touchpoints:**
- NEW `common/src/crypto/` — signing primitives (offline, WebCrypto)
- MODIFY `packages/agent-runtime/src/tools/tool-executor.ts` — interception + hold/release
- NEW `.savant/provenance/` ledger (gitignored, regenerable)

**ECHO integration:** Amplifies Law 3 (verify-before-proceed) + Law 4 (call-graph reachability) — demands cryptographic proof they executed. NO law change required for P1.A.

### P1.B — `/attest` Export

**What it does:** `cli/` command exporting a self-contained, offline HTML/JSON "Trust Receipt" of the session — openable by an auditor with zero Savant-Code install. Reuses `/export` branded-HTML pipeline.

**FID grouping:**
- `FID-ztap-006` GREEN: `/attest` command in `cli/` — reads `.savant/provenance/`, serializes to signed offline HTML (Neon Slate theme, inlined assets, zero network).
- `FID-ztap-007` AUDIT: verify exported receipt validates independently (separate process, no Savant-Code, signature checks pass).

**Architecture touchpoints:** `cli/` (new command) + reuse `/export` serializer.

### P1.C — Live Adversarial Trust Matrix (teaching lens)

**What it does:** During AUDIT/ADVERSARIAL, OpenTUI renders the diff with live highlights — Verifier flag = amber, Adversary refutes = green + explanation. Turns the terminal into a mentoring surface; doubles as the moat (users learn to spot slop).

**FID grouping:**
- `FID-ztap-008` GREEN: `cli/src/components/savant-ui/` — stream AUDIT/ADVERSARIAL events as diff overlays (state subscriptions). Read-only rendering, no control surface.
- `FID-ztap-009` AUDIT: verify overlays reflect actual verdicts (no fake highlights), zero control authority.

**Architecture touchpoints:** `cli/src/components/savant-ui/` (MODIFY).

**ECHO integration:** Read-only display of existing evidence. NO law change.

---

## Phase 2 — Retention Layer

### P2.A — ECHO Compliance Scorecard
Per-project "Trust Index" in CLI sidebar: % of codebase ZTAP-verified. Legacy repo = low; refactor + resolve FIDs = rises red→green. Ethical completionist drive. **Flag Law 12:** scores must never include PII; computed from existing receipts only.

### P2.B — FSRS-6 Scribe Memory
`agents/scribe/` manages local SQLite FSRS-6 memory graph of user architectural preferences (not source secrets). Deepens context across sessions → switching cost. **Flag Law 12:** structural preferences only, never code secrets.

**FID grouping:** `FID-ret-001` through `FID-ret-004` (target agent scopes).

---

## Phase 3 — Deep Architecture

### P3.A — Multiverse Counterfactual Debugging
Expand `sdk/src/client.ts` checkpoint API (`captureSnapshot`/`restoreTurn`/`forkFrom`) to branchable timelines — fork at a Thinker decision node, run parallel Orchestrators in isolated VFS, discard failed branch. Interacts with FID GREEN (benchmark competing implementations empirically).

### P3.B — Semantic Vulnerability Topography
Augment `packages/knowledge-graph/` to ingest `dev/fids/archive/` metadata → "decay score" per node (frequently-adversarially-overridden components glow). Queryable: "blast radius of this change + Adversary-flagged deps in 90 days." Predictive risk tool.

**FID grouping:** `FID-deep-001` through `FID-deep-006`.

---

## Governance Flags

- **P1.A/B/C, P2, P3: NO ECHO law change.** All express existing laws.
- **REQUIRED ADDENDUM — Law 2 (Present Before Act):** To enable P-horizon unattended execution (Asynchronous Escrow, referenced in research but NOT in P1), Law 2 must be amended to define "Escrowed Execution": autonomous runs permitted in isolated worktrees/VFS, provided a cryptographic human signature is *unconditionally* required before merge to primary working dir / commit. This is a protocol change — requires its own FID + Spencer sign-off before any escrow feature triggers. **Not part of P1. Flagged for when P-horizon work begins.**

---

## Open Design Questions for Spencer (resolve BEFORE triggering P1)

**Q1 — Key custody model.** Per-session ephemeral Ed25519 keypairs (simplest, no persistence, receipts self-verify via embedded pubkey) vs OS keychain-stored agent identities (enables cross-session attribution but adds keychain dependency + attack surface). Recommendation: ephemeral-per-session for v1; receipt bundle embeds the pubkey so verification needs no external trust.

**Q2 — Receipt scope.** Sign per-file-write (fine-grained, larger ledger) vs per-FID-convergence (coarse, one receipt per completed loop). Recommendation: per-write for the cryptographic guarantee, aggregated view per-FID in the export.

**Q3 — Ledger storage.** `.savant/provenance/` sidecar (gitignored, regenerable) vs git-notes (durable, travels with repo). Recommendation: sidecar v1; git-notes is a v2 consideration (matches AgentDiff's approach but is more fragile per research).

**Q4 — Does P1 ship in Savant-Code (paid) only, or also Savant-Free?** Provenance is a governance feature; Free variant has ads. Recommendation: both — it's the differentiator, and Free users benefit from proof too. But confirm ad-injection doesn't touch the receipt.

**Q5 (strategic, the real fence) —** Is Savant-Code's future enterprise/compliance-facing, or a craft tool for builders? ZTAP is an enterprise feature. If the answer is "craft tool," P1 may be a distraction and the gamified-learning idea (separate concept) is the better wedge. This is Spencer's call, not mine.

---

## Verification Gates (Nova audit, per phase)

- P1.A: replay/forgery test passes; key never in logs; interactive latency within budget.
- P1.B: exported receipt validates in a clean process with zero Savant-Code install.
- P1.C: overlays reflect real verdicts; zero control authority.
- Each phase: independent Nova audit before close. Hard gate on push remains Spencer's.

---

## Rejected / Deferred

- **x402 economy (P4):** deferred — regulatory + custody scope explosion.
- **Unconstrained self-evolution (MOSS/Hermes GEPA):** rejected — violates Law 15.
- **SaaS dashboards:** rejected — violates local-first.
- **1:1 ACI adoption:** rejected — regresses tree-sitter semantics.
- **Silent auto-correction:** rejected — violates SELF-CORRECT visibility.

---

## Next Step

Spencer resolves Q1–Q5 (especially Q5 — the strategic fence). If Q5 = enterprise-facing, trigger P1.FID-ztap-001..009 via the target harness. If Q5 = craft tool, park ZTAP and revisit the gamified-learning concept as the wedge.
