---
title: Model Compliance Telemetry — Law-Violation Analytics on the Dashboard
date: 2026-08-24
author: Nova
status: planning
requested_by: Spencer
consumed_by: (unassigned — any harness session with Orchestrator role)
source_research: none yet — recommend a Gemini DR pass on agent-behavior telemetry prior art before Phase 1
fids_emitted: []
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

## Staged Data / Current State

| Item | State |
| --- | --- |
| EHEL enforcement events | Exist at runtime (law flags, gate rejections) but NOT persisted — currently transient/logged only |
| Dashboard | Live (deck + chat workspace); has debug HUD pattern to extend |
| Per-model identity | Available at runtime (provider/model slug per session) |
| Storage convention | Append-only JSONL well-established (experiences store, version ledgers) |
| Existing metrics surface | perf-hud.ts (FrameStats ring buffer) — UI pattern precedent inside floor/stage |

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
| 6 | Regression sentinel | Nightly job comparing current-window model profiles vs prior window; surfaces drift ("model X's Law-7 violations doubled") into dev/agenda.md via existing Scribe SessionEnd review | 5 | Fixture-based test: injected drift produces agenda entry; stable data produces none |
| 7 | LEARNINGS feedback loop | Report hook: if one law dominates violations (>40% share over 30d), Scribe proposes a harness-smoothing candidate FID (is the law right but the gate UX fighting the model?) | 6 | Simulated dominance triggers proposal; sub-threshold does not |

## Dependency Graph

```
FID 1 (schema) ──> FID 2 (sink) ──> FID 3 (aggregate) ──> FID 4 (CLI)
                                            │
                                            └──> FID 5 (dashboard panel)
                                                     │
                                                     └──> FID 6 (sentinel) ──> FID 7 (feedback)
```

Strictly sequential after 1–2; each phase independently shippable (CLI alone is
useful; dashboard alone useful; sentinel last).

## Open Questions for Operator

1. **Retention:** raw JSONL grows unbounded — purge >90d like experiences-store
   (aggregates persist, raw purged)? Recommend yes.
2. **Opt-out:** should telemetry capture be default-on with config kill-switch, or
   opt-in? Recommend default-on (it's local-only, zero-cost) with `telemetry: false`
   escape hatch in protocol.config.yaml.
3. **Model identity granularity:** record full provider/model slug or normalize
   aliases (e.g., stealth/ox-alpha vs its eventual claimed name)? Recommend storing
   raw slug + letting aggregation normalize later.
4. **Dashboard placement:** separate panel vs tab within existing workspace regions?
   Depends where Agents-as-Contacts -002 lands; defer final placement to that suite's
   layout decisions.

## What This BO Deliberately Does NOT Do

- No cloud/telemetry upload of any kind in v1 (local-only).
- No changes to enforcement behavior — capture observes, never blocks (EHEL stays
  the sole authority on blocking).
- No cross-model public leaderboards (future possibility, needs operator decision
  + anonymization design).
