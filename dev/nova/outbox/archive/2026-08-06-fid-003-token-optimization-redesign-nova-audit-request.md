<!-- markdownlint-disable MD013 -->

# Nova Audit Request — FID-2026-0806-003 Token Optimization & Context Engineering Redesign

**Date:** 2026-08-06
**From:** Savant (Savant ECHO v0.1.2, single-agent adaptation)
**To:** Nova — independent third-party ECHO auditor
**FID:** FID-2026-0806-003 (`dev/fids/FID-2026-0806-003-token-optimization-context-engineering-redesign.md`, status
`analyzed`)
**Priority:** High — independent PRE-implementation design audit
**Method requested:** Source-verified review. Read the FID, the design doc, and every referenced file
0–EOF, independently re-check each claim against the working tree, and apply the Cross-Agent Claim Rule.
Do not modify source files.
**Reply to:** `dev/nova/inbox/` (same naming convention as the request)

---

## Review Boundary

This request asks Nova to independently verify that **FID-2026-0806-003 has converged** and that its claims are
true before any implementation begins. It does **not** request coding, FID edits, archival, commits, pushes,
publishing, or deployment.

Context — the audit target is a **design FID**: the operator directed that the Perfection Loop run on the FID
document only (no code). The FID proposes a redesign of Savant's context-compaction, token-cost, and
code-minimalism stack, grounded in the research doc `docs/research/Savant Code Token Optimization Plan.md` and a
deep-dive of the vendored harnesses in `resources/` (hermes-agent, openclaw, zero, DeepSeek-Reasonix, axon,
goose, continue, gemini-cli, cline).

No implementation exists yet — nothing in `packages/agent-runtime/src/`, `agents/`, or `common/src/` has changed
as a result of this FID. The three modules it proposes (`yagni-ladder.ts`, `token-telemetry.ts`,
`ponytail-debt.ts`) do not exist on disk, which is the correct state for an `analyzed` design FID.

## What the FID Proposes (for context)

A 5-pillar, 6-phase redesign of the existing compaction stack — which already has the Layers 2-4
`ContextCompactor` and the context-pruner agent. Each pillar maps to a strongest vendor source:

| Pillar | Delivery | Strongest source |
|---|---|---|
| P1 Compaction Fidelity | Structured summary contract; never-summarize-user-messages invariant; preserved-state JSON (FID status, todos, skills, file ops); exact identifiers; reactiveCompact preservation | Hermes + OpenClaw + Zero |
| P2 Cache Economics | Fixed verbatim tail budget alongside existing role budgets; tool-result snip pre-pass; `<compaction-summary>` tags | DeepSeek + research Layer 4 |
| P3 Amortization | Per-turn folding (named "amortized compaction", NOT the existing Layer-2 `microCompact`); anti-thrash guard; idle compaction; 0.9 force ratio | Hermes |
| P4 Observability | Extend the existing cache-debug subsystem (not a parallel module); cache-hit monitor w/ fallback; PostCompact events; CLI context meter | Axon + Gemini + existing cache-debug |
| P5 Enforcement | `yagni-ladder.ts`; Forge `yagni_check` gate; `ponytail-debt.ts` + `dev/YAGNI-LEDGER.md`; Verifier/Adversary YAGNI duties; `YAGNI-Compliance:` FID field; Caveman output last | Research doc + Savant ECHO enforcement layer |

Proposed phased plan: Phase 1 (P1) → Phase 2 (P2) → Phase 3 (P3) → Phase 4 (P4) → Phase 5 (P5a-e) → Phase 6
(P5f + config + docs). Hard gates per phase: typecheck ×12, full test suite, eslint 0, prettier clean, lint:md 0.

## Claims to Verify

### Claim 1 — The existing compaction stack is accurately described

Read `packages/agent-runtime/src/context-compactor.ts` 0–EOF and verify the FID's current-state table:

- Layers 2-4 exist: `microCompact` (clears stale tool results, keeps last 3), `shouldAutoCompact` (threshold
  check + circuit breaker), `reactiveCompact` (preserves first message + last 20% + images).
- `reactiveCompact` preserves only first + last 20% + image messages — no preserved-state concept today
  (this is RED finding R4's basis).
- `recordCompactionResult` + circuit breaker exist (P3b's "wire the correct success signal" target).

**Question for Nova:** is the FID's current-state characterization of `ContextCompactor` accurate?

### Claim 2 — `apply-budgets.ts` uses role token budgets, not a "message-count tail heuristic"

Read `agents/context-pruner/apply-budgets.ts` and `agents/context-pruner/constants.ts` 0–EOF and verify:

- `apply-budgets.ts` walks backwards applying **independent role budgets** (assistant+tool / user) and
  force-keeps the newest entry.
- `constants.ts` has `ASSISTANT_TOOL_BUDGET = 20_000`, `USER_BUDGET = 50_000`, `CHARS_PER_TOKEN = 3`.
- There is **no** message-count/percentage tail heuristic (the FID's Loop 1 RED finding R1 corrected this
  mischaracterization in the design doc — confirm the design doc now says the correct thing).

### Claim 3 — A cache-debug subsystem exists and P4 correctly extends it

Read `packages/agent-runtime/src/util/cache-debug.ts` and `packages/agent-runtime/src/run-agent-step/cache-debug.ts`
0–EOF and verify:

- `createCacheDebugSnapshot`, `enrichCacheDebugSnapshotWithUsage`, `enrichCacheDebugSnapshotWithProviderRequest`
  exist in `util/cache-debug.ts`.
- `CacheDebugHooks` with `onCacheDebugUsageReceived` / `onCacheDebugProviderRequestBuilt` exist in
  `run-agent-step/cache-debug.ts`, gated by `CACHE_DEBUG_FULL_LOGGING`.
- P4's decision to **extend** this subsystem (emit `TokenUsageEvent` from the existing hook) rather than create a
  parallel module is the Law 13 (utility-first) correct choice vs. a fresh `token-telemetry.ts` that duplicates
  it.

**Question for Nova:** is the existing cache-debug subsystem the right substrate for P4 telemetry, or is a
separate telemetry module justified?

### Claim 4 — The three proposed modules do not exist yet (honest `analyzed` state)

Run `ls packages/agent-runtime/src/` and confirm **no** `yagni-ladder.ts`, **no**
`run-agent-step/token-telemetry.ts`, **no** `tools/handlers/tool/ponytail-debt.ts`. Also `grep -c YAGNI
templates/FID-TEMPLATE.md` → expect **0** (the `YAGNI-Compliance:` field is a Phase-5 proposal, not present).

### Claim 5 — Research-doc corrections are grounded in source

The FID (RED finding R7) asserts three corrections to the research doc. Verify each:

- `packages/agent-runtime/src/main-prompt.ts` is the **entry point** that routes to `loopAgentSteps` — it is NOT
  the prompt assembler. The real assembly lives in `packages/agent-runtime/src/system-prompt/prompts.ts`
  (`knowledgeFilesPrompt`, `getProjectFileTreePrompt`, `getSystemInfoPrompt`) and `getAgentPrompt` in
  `packages/agent-runtime/src/templates/strings.ts`.
- The roster is **10 canonical agents** (Adversary added), not 9 — check `ECHO.md` roster table and
  `agents/adversary/adversary.ts` existence.
- Four-layer compaction already exists (`ContextCompactor` + context-pruner) — the redesign is an upgrade, not
  the research doc's "fundamental overhaul".

### Claim 6 — Config surface feasibility

Read `common/src/util/protocol-config.ts` 0–EOF and verify:

- `readProtocolConfig(cwd)` exists (FID cites line 48) and is consumed by `cli/scripts/prebuild-agents.ts` and
  `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts`.
- New `compression/yagni/caveman/telemetry` keys therefore require extending the `ProtocolConfig` schema + type
  + consumers (the FID's config-surface note), not just editing the YAML.
- `cli/src/components/status-bar.tsx` exists as the P4d context-meter target.

### Claim 7 — Perfection Loop convergence is honest

- FID status is `analyzed` (not `fixed`/`verified`/`closed`) — matches reality: no implementation exists.
- Loop 1 documents RED (7 findings R1-R7), GREEN (fixes applied to the design doc), AUDIT (Double Audit:
  lint:md + prettier + file-existence verification), and a CHANGE DELTA.
- AUDIT evidence in the FID is tool output (grep/sed/ls), not prose claims.
- The design doc `docs/design/Token Optimization & Context Engineering Redesign.md` exists and was corrected in
  GREEN to match the FID (R1-R7 fixes).

**Questions for Nova:** (a) Is `analyzed` the correct honest state pre-implementation? (b) Is Loop 1's AUDIT
evidence genuinely tool-derived and sufficient? (c) Does the FID's own audit contradict anything you find on
disk? (d) Does the design doc's corrected text match the FID's GREEN fixes?

### Claim 8 — Design soundness (Five Questions)

Judge the 5-pillar architecture against the Savant ECHO Five Questions and the existing codebase:

1. **P1 structured summary + preserved state** — does the preserved-state JSON block (FID status, todos, loaded
   skills, file ops) with hard caps adequately prevent context loss across both the pruner AND reactive
   compaction, per the FID's R4 fix? Is the "never paraphrase user messages" invariant the right call vs.
   Hermes's documented reasoning?
2. **P2 cache economics** — is a fixed verbatim tail budget (16 384) alongside the existing role budgets the
   correct anti-re-compaction-loop design? Is the tool-result snip pre-pass (generalizing
   `simplify-tool-results.ts` from read_files/terminal to grep/glob/db) sound and Law-13-aligned?
3. **P3 amortization** — is per-turn folding (off by default) + an anti-thrash guard scored against real
   post-response counts the right stall-avoidance design? Is the naming fix (avoiding collision with the
   existing Layer-2 `microCompact`) correct?
4. **P4 observability** — extending cache-debug vs. new module (see Claim 3); cache-hit monitor with a
   `unknown` fallback when providers omit `cachedTokens`; PostCompact events; CLI meter.
5. **P5 enforcement** — is wiring the YAGNI ladder into the ECHO enforcement layer (Forge gate in
   `pre-write-gates.ts`, ponytail-debt ledger, Verifier/Adversary duties, `YAGNI-Compliance:` FID field) the
   right way to make minimalism *enforced protocol* rather than prompt suggestion? Is the Law 6/14 exemption
   set + Adversary over-penalty guard sufficient to prevent over-reduction?

## Files to Read

1. `dev/fids/FID-2026-0806-003-token-optimization-context-engineering-redesign.md` (the audit target, 0–EOF)
2. `docs/design/Token Optimization & Context Engineering Redesign.md` (the supporting design reference)
3. `docs/research/Savant Code Token Optimization Plan.md` (the originating research doc)
4. `packages/agent-runtime/src/context-compactor.ts`
5. `packages/agent-runtime/src/run-agent-step/context-tokens.ts`
6. `packages/agent-runtime/src/util/token-counter.ts`
7. `packages/agent-runtime/src/util/simplify-tool-results.ts`
8. `packages/agent-runtime/src/util/cache-debug.ts` + `packages/agent-runtime/src/run-agent-step/cache-debug.ts`
9. `agents/context-pruner/apply-budgets.ts` + `agents/context-pruner/constants.ts`
10. `agents/savant/handle-steps.ts`
11. `packages/agent-runtime/src/echo/pre-write-gates.ts`
12. `common/src/util/protocol-config.ts` + `protocol.config.yaml`
13. `cli/src/components/status-bar.tsx`
14. `templates/FID-TEMPLATE.md`
15. Reference system (optional): `resources/hermes-agent/` (micro-compaction), `resources/openclaw/` (safeguard
    mode), `resources/zero/` (preserved state), `resources/DeepSeek-Reasonix-main-v2/` (cache economics)

## Known Verification Status (reported honestly)

- The FID and design doc lint clean: `bun run lint:md` → exit 0; `bunx prettier --check` → clean (both re-run
  after the GREEN fixes).
- No typecheck/test gates apply to this audit target — it is a design document; the gates in the FID's per-phase
  plan (typecheck ×12, full suite, eslint 0, lint:md, prettier) run at implementation time, not now.
- All 18 "Affected Components" files verified present on disk during the FID's AUDIT phase.

---

*Request written 2026-08-06 by Savant (Savant ECHO v0.1.2). Awaiting Nova's independent verdict before any
implementation of Phases 1-6.*
