# Session Summary — 2026-09-15 2030 — Deep-scan, seed corrections, vocabulary modernization, proposal ranking

**Operator directives (this session):** (1) deeper API-surface discovery on
the 6 boundary-unverifiable seed hosts; (2) review the seeded report and
decide which hosts to registry-propose first; (3) implement the
converged-status vocabulary modernization.

## 1. Deep-scan (FID-2026-0915-005 — closed, archived)

- Read-only variant matrix (apex/www/`api.` × `/v1/models` + `/api/v1/models`)
  over the 6 hosts + the pipeline's own `probeEndpoint` on the discoveries.
- **Found:** `api.tokenrouter.com` (boundary-ok 401 @ 787ms) and
  `api.freetheai.xyz` (boundary-ok 401 @ 1173ms). The `www.tokenrouter.com`
  200 is the SPA's HTML fallback — not a models endpoint.
- **Dead ends (recorded, seeds kept):** nicked.bond (api. = Cloudflare 530),
  gorouter.app (502 all variants), 9router.com + use-llm.site (404
  everywhere, api. unreachable).
- **Implemented:** 2 seed URL corrections + 6 evidence-bearing probeNote
  fields; LIVE harvest re-probed the corrected hosts →
  `www.tokenrouter.com boundary-ok (1039ms)`, `freetheai.xyz boundary-ok
  (559ms)`; zero diff churn (MQ1: fingerprint excludes URL). 3-gate receipt;
  seed-unverifiable count 6 → 4.

## 2. Vocabulary modernization (FID-2026-0915-004 — closed, archived)

- `ALLOWED_ACTIVE_STATUSES` now admits `converged` (operator ruling:
  Perfection-Loop-complete, awaiting implementation approval); `fixed`
  deprecated-but-accepted; nothing removed (set size 5).
- `VERIFIED_STATUSES` untouched and exported with the MQ3 comment —
  receipts verify implementation; `converged` never satisfies the gate
  check. Step-status anti-deferral gate untouched (MQ1).
- `scripts/__tests__/fid-ledger-vocab.test.ts`: 4 pins. LEARNINGS
  `active-ledger-status-admission` rewritten to the superseded rule — the
  learnings validator caught 2 defects in my first amendment (prose inside
  the field name; non-schema date suffix), both fixed.
- **Notable defect (recorded as a Lesson in the FID):** my first gate list
  declared `probe scripts/validate-repository.ts` — infinite recursion
  (validate:repository C3 LIVE-re-runs declared gates of fixed FIDs →
  spawns itself → hang). Caught at receipt time; replaced with
  `probe scripts/learnings.ts`; 4-gate receipt stamped.

## 3. Registry-proposal review (report-based ranking)

Ranking basis (LIVE state, all `1/1` uptime — single-sample ring):
**boundary-ok first, then roster size.** Top tier:
`newapi.prorisehub.com` (agg, ok, 40 models), `console.flatkey.ai` (agg,
ok, 11), `api.ollama.com` (first-party, ok, 20), `api.studio.nebius.com` /
`console.x.ai` / `inference.api.nscale.com` / `token.sensenova.cn`
(first-party, ok, 4 each). `providers:propose -- newapi.prorisehub.com`
executed → scaffold at
`dev/scratchpad/archive/2026-09-15-provider-proposals/newapi-prorisehub-com-2026-09-15.md`
(archived immediately — the unarchived scratchpad dir tripped the hygiene
rule). **No registry code touched** — curation remains operator-gated per
the propose contract.

## State

- Active FID queue EMPTY (004 + 005 closed/archived same session).
- validate:repository PASS; learnings:check exit 0; lint battery green.
- Commit hashes: recorded in the ledger rows post-commit.

## Operator follow-ups

- Curate the generated scaffold into a real registry FID (or discard).
- Seeds still carry empty rosters until a run parses one.
