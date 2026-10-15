---
title: Model Compliance Telemetry — Law-Violation Analytics on the Dashboard
date: 2026-08-24
author: —
status: COMPLETE — all 7 phases implemented and verified 2026-10-09; FID-2026-1007-012
requested_by: Spencer
consumed_by: (unassigned — any harness session with Orchestrator role)
source_research: 2026-10-08 session pass (internal emission map + external prior-art web scan; Gemini DR not run — recorded honestly) — see Research Foundation
fids_emitted: [FID-2026-1007-012]
---

# BO-2026-08-24-model-compliance-telemetry

## Overview

Turn EHEL's enforcement layer into an observability product: every law flag, pre-write
gate rejection, and receipt-check failure becomes structured telemetry, aggregated into
**per-model compliance profiles** and surfaced as a dashboard panel. The insight driving
this: benchmarks measure what models *can* do; this measures what they *actually do*
under freedom. Nobody else can build it because nobody else has mechanical enforcement
generating ground truth.

### Non-negotiable constraints

- Zero new inference: telemetry is derived from events EHEL **already emits** — pure
  aggregation + storage + rendering. No second LLM, no extra model calls.
- Append-only JSONL storage consistent with existing patterns (raw-traces.jsonl,
  VERSIONS.jsonl precedent). No database requirement for v1.
- Windows-first: dashboard panel renders in the existing desktop app (Tauri webview);
  no Docker dependency.
- Privacy posture: telemetry is LOCAL by default. If cross-user aggregation ever
  exists, it is opt-in and anonymized (no code content in records — law IDs and
  classes only).
- Quality ceilings apply: each module ≤300 lines / 50-line functions per
  protocol.config.yaml.

## Research Foundation

- Internal: EHEL tool-executor enforcement layer (`packages/agent-runtime/` —
  pre-write gates, receipt checks, law flags). Detective must map the exact emission
  points first (Phase 0).
- Internal: eval-rebuild FID suite (FID-2026-0824-013..019) — governance tasks +
  Tier-1 smoke metrics are siblings; telemetry provides real-world violation priors.
- External (optional, pre-Phase-1 Gemini DR): no established "agent compliance
  telemetry" prior art found in the eval landscape scan — closest neighbors are
  Coder Eval's skill_activation metrics and LangChain trajectory matching. A short
  DR pass would confirm novelty + harvest any UI patterns from observability tools
  (Grafana-style heat maps).

### Research pass (2026-10-08 session; precondition satisfied)

Internal emission map (verified against the tree, all read-only):

- Write-time funnel: `runPreWriteGates`
  (`packages/agent-runtime/src/echo/pre-write-gates.ts:83`) →
  `EnforcementResult{blocked, reason?, classification?}` +
  `AdvisoryWarning[]{law, severity, classification?}` (`echo/types.ts:116-134`).
  Every enforced law surfaces here with a numeric law id.
- Escalation: `recordLawBlock` (threshold `LAW_BLOCK_ESCALATION_THRESHOLD = 3`),
  `noteCompliantIntervening`, `consumeTurnTermination`
  (`echo/enforcement/escalation.ts`).
- Turn-end (Law 15): `evaluateTurnEndImpl` / `evaluateUngroundedTurnEndImpl`
  (`echo/enforcement/turn-end.ts`).
- Receipt/credit family: `creditVerificationRun`, `creditCallGraphSearch`
  (`echo/enforcement/verification-credit.ts`).
- Capture pattern to mirror: `hooks/engine.ts` + `hooks/experience-capture.ts`
  (fail-open, atomic JSONL append, path-normalized keys, context-hashed inputs,
  config-declared) — the FID-2 sink follows this contract verbatim.
- Model identity: `provider` + `requestedModel` strings at runtime
  (`provider-boundary/identity-observation.ts:80`, route key
  `provider::requestedModel`); raw slug recorded, aggregation normalizes (Q3).
- No-bodies constraint (verified): `AdvisoryWarning.message` is free text and
  may carry snippets — the sink persists law/classification/severity/blocked
  only, never the message (hash it if grouping needs it).

External prior-art scan (web, 2026-10-08; Gemini DR not run — recorded honestly):

- Closest neighbor: GAAT (Governance-Aware Agent Telemetry, Apr 2026) —
  governance telemetry schema + enforcement bus for multi-agent orchestration.
  Top-down where this program is bottom-up (single-harness law enforcement);
  direction validated, no mechanism overlap.
- Directly reusable patterns (EgisAI audit-event schema v2): verdict enum with
  precedence, stable reason codes for switch consumption, count-only
  sanitization records, additive-nullable evolution (missing = "not recorded").
- Legitimacy: EU AI Act Art. 12 (automatic event logging) is the external duty
  this feature discharges locally.
- Novelty holds: no prior art does per-model law-violation profiles derived
  from a mechanical enforcement layer. UI harvest: law×model heat map (already
  planned), verdict triplets, worst-of rollups.

## Staged Data / Current State

Current completion (2026-10-09): metadata-only capture is persisted; resolved
runtime route identity reaches all four capture funnels; authenticated JSON-RPC
serves rolling aggregates to the mounted desktop workspace-right-rail panel.
CLI dispatch, SessionEnd drift reporting and dominant-law proposal drafts are
implemented. Root regression: 8,572 pass, 23 skip, zero failures. Typecheck,
ESLint, markdownlint, quality and repository validation pass. Browser e2e:
10 checks pass, zero page errors. The table below records the original baseline.

| Item | State |
| --- | --- |
| EHEL enforcement events | Exist at runtime (law flags, gate rejections) but NOT persisted — currently transient/logged only |
| Dashboard | Live (deck + chat workspace); has debug HUD pattern to extend |
| Per-model identity | Available at runtime (provider/model slug per session) |
| Storage convention | Append-only JSONL well-established (experiences store, version ledgers) |
| Existing metrics surface | perf-hud.ts (FrameStats ring buffer) — UI pattern precedent inside floor/stage |

## Progress (verified 2026-10-07)

**Nothing in this order has been implemented.** Zero of the seven FIDs exist as
records, and no phase of the artifact surface is present:

- `common/src/types/telemetry.ts` — **absent**
- `dev/telemetry/` — **absent**
- `dev/telemetry/compliance.jsonl` — **absent** repo-wide

Update 2026-10-08: FID 1 landed — `common/src/types/telemetry.ts` exists with
`complianceEventSchema` (+ 6-pin suite); sink, aggregate, CLI, panel, sentinel
and loop still absent; `source_research` filled (see Research Foundation).

Update 2026-10-08 (later): FID 2 landed — `hooks/compliance-capture.ts` sink
(+ 12 pins across capture and emission suites) with wiring at the four
enforcement funnels, `complianceTelemetry` kill-switch (default-on), and
release-preaudit churn listing. Aggregate, CLI, panel, sentinel and loop
still absent.

Update 2026-10-08 (later still): FID 3 landed — `scripts/telemetry-aggregate.ts`
(+ 6-pin suite) with rolling aggregates, zero-filled trends, 90d purge and
`--json`; live-verified on the empty tree. CLI, panel, sentinel and loop
still absent.

Update 2026-10-08 (later still): FID 4 landed — `/telemetry`
`summary|laws|models` slash group (+ 8-pin suite) with registry/menu parity;
pure aggregation moved to `common/src/util/telemetry-aggregate.ts` for the
CLI↛scripts boundary. Panel, sentinel and loop still absent.

Update 2026-10-08 (later still): FIDs 6+7 landed ahead of the panel (data
dependencies met by FID 3; panel placement open — see FID). Sentinel
(`telemetry-sentinel.ts` + 4-pin suite, drift ledger) and feedback loop
(`telemetry-feedback.ts` + 4-pin suite, idempotent draft proposals, no
auto-promotion). Tracking policy: `compliance.jsonl` tracked source;
drift/proposals gitignored. Only the panel (FID 5) remains.

Update 2026-10-09: all seven phases delivered, including the panel, identity
wiring and SessionEnd reporting. The research precondition was satisfied by
the dated internal/external pass above; Gemini DR was optional and not run.
Loop 2 corrected the agenda design: derived drift uses a dedicated ledger,
and SessionEnd routing notes preserve the existing 50-line/three-item cap.
Local commit evidence and FID closure are tracked in FID-2026-1007-012.

## Phased Build Order

### Phase 1 — Capture & Store (the sink)

| FID | Title | Scope | Depends On | Acceptance Gates |
| --- | --- | --- | --- | --- |
| 1 | Telemetry event schema | `common/src/types/telemetry.ts`: `ComplianceEvent` zod schema `{ts, sessionId, model, provider, lawId, violationClass (rejected \| corrected \| flagged), agentRole, gateLayer, contextHash}` — no code content, metadata only | — | Schema unit tests; drift-safe optional fields |
| 2 | EHEL emission → sink wiring | In-process capture sink in the hooks/enforcement layer (same pattern as experience-capture): append one line to `dev/telemetry/compliance.jsonl` per violation event; atomic append; path-normalized keys (`no-environment-dependent-guards` rule); config-declared + fail-open (zero behavior change when disabled) | 1 | Harness tests proving: every law-flag produces exactly one line; disabled = zero writes; crash mid-write leaves valid JSONL |

### Phase 2 — Aggregate & Query

| FID | Title | Scope | Depends On | Acceptance Gates |
| --- | --- | --- | --- | --- |
| 3 | Aggregation engine | `scripts/telemetry-aggregate.ts`: stream-reads compliance.jsonl → rolling windows (7d/30d/all-time); outputs `{violationsByLaw, violationsByModel, law×model matrix, trendSeries}`; deterministic, no LLM | 2 | Unit tests on fixture JSONL; handles empty/corrupt lines gracefully |
| 4 | `telemetry` CLI group | `savant telemetry summary [--window 7d]`, `savant telemetry laws`, `savant telemetry models` — terminal access to aggregates before any UI exists | 3 | Router registration (two-word-command lesson: register bare alias); focused cli suite |

### Phase 3 — Dashboard Surface

| FID | Title | Scope | Depends On | Acceptance Gates |
| --- | --- | --- | --- | --- |
| 5 | Compliance panel (desktop) | New panel in the desktop workspace: top-violated laws this week, per-model compliance fingerprint (heat map law×model), trend sparklines; reads aggregates via sidecar JSON-RPC endpoint (Origin+bearer enforced per existing gateway gate) | 3 (4 optional) | Desktop typecheck + suite green; panel renders with empty state; live data e2e against a seeded JSONL |

### Phase 4 — Insight Layer (post-data)

| FID | Title | Scope | Depends On | Acceptance Gates |
| --- | --- | --- | --- | --- |
| 6 | Regression sentinel | Current/prior 7d comparison; dedicated drift ledger; SessionEnd surfaces metadata-only routing notes while preserving the agenda cap. Nightly scheduling remains operator configuration, with the same deterministic script available | 5 | Injected drift is reported; stable/small samples silent; future events excluded; disabled/missing ledger causes no writes |
| 7 | LEARNINGS feedback loop | SessionEnd synchronizes reviewable dominant-law drafts (>40% over 30d, minimum 10 events); no automatic FID or skill promotion | 6 | Dominance proposes; sub-threshold clears stale drafts; hook failures contained |

## Dependency Graph

```text
FID 1 (schema) ──> FID 2 (sink) ──> FID 3 (aggregate) ──> FID 4 (CLI)
                                            │
                                            └──> FID 5 (dashboard panel)
                                                     │
                                                     └──> FID 6 (sentinel) ──> FID 7 (feedback)
```

Strictly sequential after 1–2; each phase independently shippable (CLI alone is
useful; dashboard alone useful; sentinel last).

## Resolved Implementation Choices

1. **Retention:** explicit `telemetry:aggregate --purge` retains 90 days; no
   automatic source-ledger deletion. Aggregates are derived from retained data.
2. **Opt-out:** local capture defaults on; `complianceTelemetry.enabled: false`
   disables capture and SessionEnd reporting without enforcement changes.
3. **Identity:** record resolved provider/model/session/role metadata; missing
   identity remains explicit. Requested route is not served-model attestation.
4. **Placement:** collapsible Compliance panel in the existing desktop
   workspace right rail; ranked laws, numeric law/model heatmap, dated trend
   and 7d/30d/all filters with loading/empty/error/disconnect recovery.

## What This BO Deliberately Does NOT Do

- No cloud/telemetry upload of any kind in v1 (local-only).
- No changes to enforcement behavior — capture observes, never blocks (EHEL stays
  the sole authority on blocking).
- No cross-model public leaderboards (future possibility, needs operator decision
  + anonymization design).
