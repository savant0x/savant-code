# FID: Operator seed intake — 16 operator-sourced hosts into the discovery pipeline

**Filename:** `FID-2026-0915-003-operator-seed-intake.md`
**ID:** FID-2026-0915-003
**Severity:** low
**Status:** analyzed
**Created:** 2026-09-15 (operator directive: "expand our free provider list"
with a pasted host list; ruled: seed as tracked candidates, probe from site
root, default category commercial-aggregator, skip chatanywhere.tech and the
three integrated providers)
**YAGNI-Compliance:** Verified — the seed intake reuses every existing
pipeline mechanism (FeedCard shape, stage-0 gates, typosquat screen, diff,
LIVE probe, report/state writers); no new gating concept is invented, only
an operator-owned card source merged at the stage-0 boundary. No consumer
code changes; no registry edits (the registry path is a separate, later
`providers:propose` decision with its own operator gate).
**Related:** FID-2026-0914-003 (discovery pipeline this rides on);
FID-2026-0915-001 (state v2/ring/index the seeds flow into);
FID-2026-0914-001 (the integrated-provider path the skipped hosts already
used); operator rulings recorded in SCOPE Task 49.

## Summary

16 operator-sourced hosts (from a pasted 24-URL expansion list; 5 of 21
unique hosts ruled out per operator rulings) enter the free-compute
discovery pipeline as operator-owned seed cards. The seeds merge into the
stage-0 candidate stream each harvest run and flow through the identical
gate chain as feed hosts — stage-0, typosquat screen, registry dedupe,
LIVE auth-boundary probe — so tracking, the uptime ring, the model index,
and the report gain the operator's hosts with zero new gating concepts and
zero registry changes. New `seed-hosts.ts` data module + one merge seam in
`harvest-freeairouter.ts` + pins.

## Problem Statement

The operator pasted 24 URLs (21 unique hosts) as the expansion list for the
free provider discovery pipeline. The pipeline's only intake today is the
freeairouter `data/sites.json` feed; there is no operator-owned intake, and
`diffCandidates` drops state hosts absent from a run's feed — so writing
`candidates.json` directly would not persist. The list needs a seeding
mechanism so the normal gates (stage-0, typosquat, LIVE auth-boundary probe,
report) evaluate the operator's hosts with the same evidence standard as
feed hosts.

## Per-Operator-Ruling Disposition (21 unique → 16 seeds)

- **Skip — integrated registry providers** (ruled "skip integrated"):
  `orcarouter.ai`, `infron.ai`, `unorouter.com`. Already live in
  PROVIDER_REGISTRY (`registry-partitioned.ts:61` for orca; FID-2026-0914-001
  for infron/unorouter). Note: the `orcarouter.ai` denylist "flagged" record
  is the pipeline's automatic typosquat-tier-2 heuristic (distance 3 from
  openrouter.ai) — advisory pipeline history, does not affect registry status.
- **Skip — the feed host itself:** `freeairouter.com` (it is the pipeline's
  input feed; tracking it as a candidate would be circular).
- **Skip — respected prior exclusion** (ruled "skip it"):
  `chatanywhere.tech` (denylisted `free-relay — LLMjacking class`).
- **Seed — 16 hosts** (all `commercial-aggregator`, `categoryConfirmed:
  true`, per ruling "default: aggregator"): api.hcnsec.cn,
  chatwave.crunchflix.site, apinex.bond, nicked.bond, b.ai, vyceai.com,
  gorouter.app, tabitoken.com, kiraai.vn, www.tokenrouter.com, 9router.com,
  use-llm.site, platform.experientiallabs.ai, monkeycode-ai.net,
  tokenbom.com, freetheai.xyz.
- **URL normalization (probe evidence, 2026-09-15):** dashboard/profile
  suffixes (`/dashboard-v2`, `/wallet`, `/profile`, `/overview`, `/models/`,
  `/#`) stripped to site roots — the probe targets `<root>/v1/models`;
  `freetheai.xyz` seeds as `https://freetheai.xyz` with the pipeline
  discovering its API surface (its `api.` subdomain also answers —
  `freetheai.xyz root/v1/models=404, api./v1/models=401` LIVE-measured).
- **LIVE probe evidence (read-only GETs, pipeline UA, 2026-09-15):**
  proper-boundary 401/403 on root `/v1/models`: api.hcnsec.cn(401),
  chatwave.crunchflix.site(403), apinex.bond(401), vyceai.com(401),
  tabitoken.com(401), freetheai.xyz-via-api(401), unorouter.com(401);
  open-200 model lists: b.ai(200), www.orcarouter.ai(200),
  www.tokenrouter.com(200), tokenbom.com(200);
  needs-redirect-handling: kiraai.vn(301), platform.experientiallabs.ai(307);
  deeper discovery needed: nicked.bond(404/530), gorouter.app(502),
  9router.com(404), use-llm.site(404), monkeycode-ai.net(405 — POST-only
  surface).

## Impact Assessment

### Affected Components

- NEW `scripts/providers/lib/seed-hosts.ts` — the operator seed list as
  typed `SeedCard` data (host, url, category, ruled-out notes);
  `toFeedCards()` maps them into the existing `FeedCard` shape (probe:
  reachable so stage-0 admits them; freeModelsEn: [] so the fingerprint
  starts empty and the LIVE probe fills reality).
- MODIFY `scripts/providers/harvest-freeairouter.ts` — one seam: merge
  `toFeedCards(SEED_HOSTS)` into the stage-0 stream after `parseFeedSites`
  (seed cards pass through stage-0/typosquat/diff/probe identical to feed
  cards; the audit trail records their operator-seeded provenance).
- MODIFY `SCOPE.md` — Task 49 record (already drafted during rulings).

### Risk Level

- [ ] Critical
- [x] Small: data + one merge line + tests; every downstream mechanism is
  existing, tested code (76/216 pipeline pin suite holds as the parity
  baseline).

## Perfection Loop

### Missed Questions

- MQ1: Do seeds bypass stage-0? No — they enter the stream BEFORE stage-0
  with admissible field values (verified status, confirmed aggregator
  category, reachable probe) so the SAME filter evaluates them; no bypass
  branch exists.
- MQ2: Do seeds survive runs when the feed lacks them? Yes — that is the
  reason for flow-injection over state-file injection: seeds merge every
  run, so diffCandidates always sees them present (no lapsed/drop).
- MQ3: Can a seed later be removed? Yes — delete its entry from
  `seed-hosts.ts`; the normal absent-from-run drop behavior removes it from
  tracking (the same mechanism the feed uses).
- MQ4: Do seeds skip the typosquat screen? No — `kiraai.vn` etc. run the
  same tier-1/tier-2 screen; a seed that trips tier-1 is rejected with the
  standard audit row (operator sees the reason in the report).

## Verification Gates

- gate: typecheck cli
- gate: typecheck common
- gate: test scripts/providers/__tests__/discovery-seams.test.ts
- gate: test scripts/providers/__tests__/harvest-core.test.ts
- gate: probe scripts/providers/harvest-freeairouter.ts

### Code Verification Evidence

(Status `analyzed`: LIVE probe evidence gathered pre-authorization and
recorded above; gate outputs recorded here at implementation closure —
typecheck cli/common, pipeline pin suite parity 76/216, seed-specific pins,
LIVE harvest rerun with the 16 seeds present in state/report.)

## Resolution

- **Closed Date:** —
- **Fix Description:** —
- **Tests Added:** —
- **Verification Evidence:** —
- **Commit:** —
- **Archived:** —
