# FID: Window-census follow-ups — exactly-200000 classification + zero-row provider diagnosis

**Filename:** `FID-2026-1004-003-window-census-followups.md`
**ID:** FID-2026-1004-003
**Severity:** medium
**Status:** closed (implemented + verified, 2026-10-04)
**Created:** 2026-10-04
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Operator ruling 2026-10-04 ("Run the censuses", T129): classify the 66
runtime-catalog rows advertising exactly 200000 (real vs vendor default leak)
and diagnose the 5 zero-row registry providers. Outcome: 50 REAL (OpenRouter
agrees 200000), 7 LEAK-PROBABLE (GLM-4.x/5 family, catalog-owned ~2%
under-window — registered, not rowed), 3 consistent-with-flagged-default,
6 UNDETERMINED (registered NEEDS-REVIEW); all five providers diagnosed —
none dead (two auth-gated, one static+account-scoped, one local by design,
one live-keyless-again with rows pending the next snapshot).

## Evidence

- Probe: `dev/scratchpad/active/window-census-classify.ts` (read-only,
  re-runnable; output `window-census-classify-output.txt`) against the saved
  OpenRouter public catalog (466 rows, keyless 2026-10-04).
- A-summary: real=50 leak-probable=7 flagged-default=3 undetermined=6.
- Provider probes: codecraft HTTP 401 (auth-gated); xkiro HTTP 200, 129 rows
  WITH context_length keyless (T119-era 403 lifted; fetcher already wired in
  gateway.ts; runtime snapshot predates the lift); ollama daemon HTTP 200;
  cloudflare static catalog + account-scoped baseUrl; cleanapis 401 keyless
  (registry comment reconfirmed).

## Dispositions (data-only, in `window-coverage-register.ts`)

- Per-provider notes updated for all five zero-row providers (dated census).
- The 7 LEAK-PROBABLE ids are REGISTERED, not rowed: a fallback row is inert
  while the catalog value wins tier 1 of the ladder, and the divergence
  (~2% under-window) is catalog-owned and self-correcting. Re-census if the
  vendor catalog changes.
- The 6 UNDETERMINED ids carry dated NEEDS-REVIEW notes (no cross source).

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5ae8faa373bb383e0248263079342eae4c21170aebbdef9041314080fd5849d0
- verified: 2026-10-04T22:00:40.076Z
- typecheck common: exit 0
- typecheck cli: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED/GREEN/AUDIT

- **RED:** The 66 rows were indistinguishable real-or-leak; the 5 providers
  were "zero rows, cause unknown".
- **GREEN:** Cross-vote classification (50/7/3/6) + per-provider diagnosis;
  register notes carry the dated findings.
- **AUDIT:** Register lint suite green (dispositions unchanged — notes only);
  quality PASS.
- **ADVERSARIAL:** "Why not row the 7 leak-probable ids?" — inert under
  catalog precedence (tier 1 wins), single-source, ~2% delta: a row would be
  provenance theater. Registered with the re-census trigger instead.
- **CHANGE DELTA:** ~new-document

## Resolution

- **Closed Date:** 2026-10-04 (G2: implementation commit)
- **Fix Description:** Census classification + per-provider diagnosis recorded
  in `window-coverage-register.ts`; no runtime data changed (classification
  only).
- **Tests Added:** No (register dispositions unchanged; lint suite covers).
- **Archived:** yes — closure commit moves this file to `dev/fids/archive/`.

## Lessons Learned

"Advertises exactly the default" is a three-way ambiguity (real / leak /
consistent-with-a-registered-default) — only a cross-vote resolves it, and
the resolution belongs in the register next to the dispositions it affects,
with the re-census trigger named.
