# Session Summary: 2026-09-14 11:52

**Session ID:** 2026-09-14-1152-infron-unorouter-gateway-providers
**Status:** completed

---

## Initial State

- **OS:** Windows (Git Bash)
- **Branch:** main (clean except the untracked
  `docs/design/alysis-code-novel-ideas-review.md` reference record)
- **Active FID queue:** empty (post-v0.0.31 closures)

### Operator Request

Add two gateway providers, following the runbook + system review first:
Infron (`https://infron.ai/docs`) with "all the free ones + top coding
models," then extended mid-session with UnoRouter
(`https://unorouter.com/en/models`) with "all the free models and the top
10-20 coding models." Later directives: add keys this session; approve
implement + close + update the changelogs in one ruling.

---

## Planned Work (intent log — ECHO Law 8)

1. [x] Ground: runbook (`docs/archive/design/Adding New Providers.md`) +
   FID-2026-0913-001 template, both 0-EOF
2. [x] Live-probe both vendors: keyless catalogs, auth contract, keyed
   probes (key names only — Law 12)
3. [x] Scope rulings via ask_user (Infron 4 free/chat-only; UnoRouter ~12
   curated free + top paid; keys created by operator)
4. [x] FID-2026-0914-001 authored RED-first, Perfection Loop, present
   (Law 2 — operator approved implement + close + CHANGELOG)
5. [x] RED: pin battery across 4 test suites, captured failing
6. [x] GREEN: full wiring (registry, catalogs, picker split module,
   gateway merge, docs)
7. [x] VERIFY: typecheck ×4, suites, eslint, prettier, lint:md, docs drift
8. [x] CLOSE: receipt, archive, ledger, SCOPE, summary, CHANGELOG

## Work Completed (all verified with tool output)

- **Research/probe (pre-FID):** Infron catalog 458 models keyless at
  `api.infron.ai/v1/models` (free filter is UI-only; 4 clean `:free` chat
  models — one free model has blank endpoint metadata, flagged);
  inference at `llm.onerouter.pro/v1`, keyless 401 fail-closed, keyed
  probes show the key AUTHENTICATES but the account is unfunded (paid →
  403 credits, free → 429 team-balance ≥ $5). UnoRouter is a QuantumNous
  "New API" gateway: catalog via keyless `/api/pricing` (231 rows / 128
  free / 89 chat-eligible), contract `api.unorouter.com/v1` + `:free`
  suffix; keyed gauntlet = 5 free channels HTTP 200, rest busy-class
  (zero `model_not_found`). Codex family is Responses-API-only — excluded
  per operator ruling.
- **FID-2026-0914-001:** RED-first; Loop 2 self-caught the
  `claude-haiku-4.5` `supports_function_calling: false` defect → swapped
  for `google/gemini-3.1-pro-preview`; presented; operator approved.
- **Implementation (22 files: 19 modified, 3 new):** registry +2 entries
  (`registry-partitioned.ts`), `gateway-catalogs.ts` +2 maps (Infron 9 +
  UnoRouter 17 models), `model-catalogs.ts` +2 fetcher refs, model-config
  shim +2 exports, NEW `static-catalogs-gateways.ts` picker module (zero
  churn to the 283-line parent), `gateway.ts` merge legs, 4 test files
  (2 new split files + 2 edited parents) with closed-world widening
  16→18 / 14→16, `.env.example`, and docs sync across all 8 hand-pinned
  surfaces.
- **Harness root-cause fix:** the SDK's one-shot `.env.local` bootstrap
  re-injects real keys AFTER `beforeEach` deletions (fires lazily on
  first transitive import). Harness now warms the module graph first;
  stash A/B proved it also cured a pre-existing sdk order flake
  (failures 6→5, errors 4→3).
- **Closure ceremony:** receipt stamped via `fid:verify --write` at the
  archived path (8/8 gates PASS, real fingerprint); Loop 4 heading
  repaired (was a duplicate Loop 2); ledger closure note + SCOPE T46-D/E/F
  + archive README section + session summary + CHANGELOG entry.

## Validation Results

- `bun run fid:verify dev/fids/archive/FID-2026-0914-001-... --write` —
  8/8 gates PASS, receipt stamped
- typecheck ×4 (common, sdk, packages/agent-runtime, cli): exit 0
- suites: common providers 61/0, cli catalog family 30/0, sdk free-mode
  pair 16/0 (baseline parity via stash A/B)
- `bun x eslint` (13 touched files): 0 problems; `bunx prettier --check`:
  clean; `bun run lint:md`: PASS
- `bun run generate:provider-docs` + `:check`: up to date
- Step-5 live: catalog 26/26 through the production chain; UnoRouter 5
  free channels HTTP-200 (rest busy-class, vendor-documented saturation);
  Infron integration verified end-to-end, LIVE 200 NEEDS-REVIEW until
  funding (OrcaRouter precedent)

## Lessons Learned

- The `.env.local` bootstrap is applied exactly once per process, lazily
  on the first import that reaches `common/src/env.ts` — any harness that
  deletes env vars in `beforeEach` MUST warm the module graph first, or
  the first key-bearing test observes keys re-injected mid-body.
- Capability metadata must gate "top model" curation — the Loop-2 catch
  (a no-tool-calling model in an agentic CLI's coding set) would have
  shipped a broken channel.
- Saturation-class vendor errors (429/503 with retry guidance) are a
  distinct acceptance class from structural failures (404/400): "200 OR
  documented busy-class" keeps closure honest without pretending capacity
  problems are integration proofs.

## Handoff

- Commit plan prepared for operator execution (G1/G2) — SHAs land at git
  execution time. Untracked reference record
  (`docs/design/alysis-code-novel-ideas-review.md`) predates this session
  and is NOT part of this work's commit plan.
- Infron closure boundary: fund the account → re-run the Step-5 single
  call → the NEEDS-REVIEW lifts exactly like the OrcaRouter pattern.
