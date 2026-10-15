# FID: Operator seed intake — 16 operator-sourced hosts into the discovery pipeline

**Filename:** `FID-2026-0915-003-operator-seed-intake.md`
**ID:** FID-2026-0915-003
**Severity:** low
**Status:** closed
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


### Code Verification Evidence

(Recorded at implementation closure, 2026-09-15.)

- **Pins:** `seed-hosts.test.ts` 6 pass / 126 expect() — 16-host set, 5
  ruled-out skips, stage-0 admissibility without a bypass branch (MQ1),
  operator precedence, deterministic merge, stable-fingerprint shape.
- **Pipeline suite:** 82 tests / 342 expect() / 0 fail across 10 files
  (76/216 baseline + 6 seed pins; pre-existing pins untouched).
- **Typecheck:** cli exit 0 (covers `scripts/**/*`), common exit 0.
- **LIVE harvest rerun ×2 (exit 0):** run 1 exposed the feed-precedence
  defect (2 seeds silently dropped — see Loop record); run 2 after the
  operator-precedence correction: `214 records → 71 stage-0 → 2 new`, all
  **16/16 seeds tracked in state** with measured verdicts — 8
  `boundary-ok`, 6 `boundary-unverifiable` (deeper-discovery hosts), **2
  `open-relay-reject` (b.ai, platform.experientiallabs.ai — unauthenticated
  generation succeeded; the safety gate applies to operator seeds
  unchanged)**. 14 provenance rows written to the audit trail/report.
- **Lint battery:** eslint `--max-warnings 0` exit 0 (2 import/order
  warnings auto-fixed), prettier exit 0, quality:report PASS (1498 files).
- **Known limitation (recorded, not hidden):** seed cards start with an
  empty model roster (fingerprint-stability design); this run's /v1/models
  shapes did not parse a roster from the seeds (modelsCount 0), so the
  model-availability index gains no seed entries until a run parses one.

## Verification Gates

- gate: typecheck cli
- gate: typecheck common
- gate: test scripts/providers/__tests__/discovery-seams.test.ts
- gate: test scripts/providers/__tests__/harvest-core.test.ts
- gate: probe scripts/providers/harvest-freeairouter.ts

### Verification Receipt

- fingerprint: sha256:894edcc00a622ff0939386c31e17f8ae765c2760dbbc4dd6003f2868b53dad8c
- verified: 2026-09-15T18:46:16.674Z
- typecheck cli: exit 0
- typecheck common: exit 0
- test scripts/providers/__tests__/discovery-seams.test.ts: exit 0
- test scripts/providers/__tests__/harvest-core.test.ts: exit 0
- probe scripts/providers/harvest-freeairouter.ts: exit 0

## Resolution

- **Closed Date:** 2026-09-15
- **Fix Description:** `scripts/providers/lib/seed-hosts.ts` (16 typed
  SeedCards + `toSeedFeedCard` + `mergeSeedCards` with **operator
  precedence** — an operator-authorized seed overrides the feed's card for
  the same host, correcting the original feed-precedence design that let
  the feed's classification silently defeat two operator rulings);
  `harvest-freeairouter.ts` merge seam (+count log line, +first-sight
  provenance audit rows); seed pins in `seed-hosts.test.ts`. No registry
  changes; the two open-relay rejections stand with evidence.
- **Tests Added:** `scripts/providers/__tests__/seed-hosts.test.ts` (6
  tests / 126 expect()s) pinning the rulings in data.
- **Verification Evidence:** the Code Verification Evidence section above;
  commit hash recorded in the session summary and SCOPE T49.
- **Commit:** recorded in SCOPE T49-D.
- **Archived:** yes — 2026-09-15, same session (operator directive:
  complete all FIDs).

## Lessons Learned

- Feed-precedence for operator seeds was a design defect caught LIVE: the
  feed's own classification (categoryConfirmed:false, free-product)
  silently defeated two explicit operator authorizations at stage-0. When
  an operator authorizes a host, operator precedence must win — the
  safety gates (typosquat, open-relay probe) remain the non-negotiable
  layer and still rejected 2 of the 16.
