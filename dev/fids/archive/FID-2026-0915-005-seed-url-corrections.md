# FID: Seed URL corrections from deep API-surface discovery

**Filename:** `FID-2026-0915-005-seed-url-corrections.md`
**ID:** FID-2026-0915-005
**Severity:** low
**Status:** closed
**Created:** 2026-09-15 (follow-up to FID-2026-0915-003: the operator
approved deeper API-surface discovery on the 6 boundary-unverifiable seed
hosts; the scan found 2 correctable API bases and 4 dead ends)
**YAGNI-Compliance:** Verified — two `url` field corrections in existing
seed data plus evidence notes; no new mechanism, no consumer changes.
**Related:** FID-2026-0915-003 (closed — the seed intake this corrects);
scripts/providers/lib/probe-endpoint.ts (the probe whose verdicts motivated
the scan).

## Summary

Deep-scan (read-only variant matrix over apex/www/`api.` hosts ×
`/v1/models` + `/api/v1/models`, plus the pipeline's own `probeEndpoint`)
found the real API surfaces for 2 of the 6 unverifiable seeds and confirmed
4 dead ends. `www.tokenrouter.com` and `freetheai.xyz` seed URLs correct to
their `api.` subdomains — both verified `boundary-ok` (401) by the
pipeline's probe with real latency samples. The other 4 seeds stay on their
site roots with findings recorded (their verdicts remain honest
`boundary-unverifiable` until the surfaces appear).

## Deep-Scan Evidence (2026-09-15, read-only, pipeline UA)

| Seed | Variants tried | Finding | Disposition |
|---|---|---|---|
| www.tokenrouter.com | apex(301), www(200=SPA HTML fallback, not JSON), api.(401 models/404 api) | API base is `api.tokenrouter.com` — pipeline probe: `boundary-ok`, 401, 787ms | **correct URL** |
| freetheai.xyz | apex(404), www(000), api.(401 models) | API base is `api.freetheai.xyz` — pipeline probe: `boundary-ok`, 401, 1173ms | **correct URL** |
| nicked.bond | apex(404), www(000), api.(530 both paths) | `api.` behind Cloudflare 530 (origin DNS error) | keep, recorded |
| gorouter.app | apex(502), www(000), api.(000) | service down across every variant at scan time | keep, recorded |
| 9router.com | apex(404), www(404), api.(404) | no `/v1` or `/api/v1` surface on any variant | keep, recorded |
| use-llm.site | apex(404), www(404), api.(000) | no surface on any variant; api. unreachable | keep, recorded |

## Perfection Loop

### Missed Questions

- MQ1: Does changing a seed URL churn the diff? No — `fingerprintOf` hashes
  only the model roster (empty for seeds), not the URL; the corrected hosts
  classify `unchanged` and the probe-merge re-probes them because their
  standing verdict is `boundary-unverifiable` (existing mechanism).
- MQ2: Why keep the 4 dead ends instead of dropping the seeds? The operator
  authorized the hosts; the scan reflects one point in time (gorouter.app
  is a 502, plausibly transient). Seeds keep tracking; the state ring
  records up/down history honestly.
- MQ3: Do the two corrected hosts now enter the model index? Not yet —
  boundary is now `boundary-ok`, but a roster parse still requires their
  `/v1/models` to return JSON with `data[]` under an authed or public
  shape; the next LIVE harvest measures it.

### Code Verification Evidence

(Recorded at implementation closure, 2026-09-15.)

- **seed-hosts.ts:** two `url` corrections (`www.tokenrouter.com` →
  `api.tokenrouter.com`, `freetheai.xyz` → `api.freetheai.xyz`) + all six
  deep-scan findings recorded in `probeNote` fields; 185 lines (under cap).
- **Typecheck:** cli exit 0 (covers scripts/). Pipeline suite 82 tests /
  342 expect() / 0 fail — MQ1 confirmed: zero churn, the corrected hosts
  classified `unchanged`.
- **LIVE `providers:harvest --probe` (exit 0):** probe-merge re-probed both
  corrected hosts per the standing-unverifiable mechanism — final state:
  `www.tokenrouter.com → boundary-ok (1039ms)`, `freetheai.xyz →
  boundary-ok (559ms)`. Seed-unverifiable count drops 6 → 4.
- **Lint battery:** eslint/prettier/lint:md/quality:report all green
  (recorded at the closure battery below).

## Verification Gates

- gate: typecheck cli
- gate: test scripts/providers/__tests__/seed-hosts.test.ts
- gate: probe scripts/providers/harvest-freeairouter.ts

### Verification Receipt

- fingerprint: sha256:3fa559d0974f96a97dbb0c004c9cd817a88abfd6846933bb4839ac011274bb0d
- verified: 2026-09-15T19:41:34.841Z
- typecheck cli: exit 0
- test scripts/providers/__tests__/seed-hosts.test.ts: exit 0
- probe scripts/providers/harvest-freeairouter.ts: exit 0

## Resolution

- **Closed Date:** —
- **Fix Description:** —
- **Tests Added:** —
- **Verification Evidence:** —
- **Commit:** —
- **Archived:** yes — 2026-09-15, same session (Auto-Archive rule).
