# Session Summary — Window-census follow-ups + provenance upgrade (2026-10-04)

Continuation of the 2026-10-04 window-coverage sweep. Operator rulings
(structured): "Run the censuses" (T129) + "Upgrade provenance" (T130, one
keyless OpenRouter probe supersedes the cross-rows-only rule for that probe
only); each item landed as its own path-scoped **local** commit (nothing
pushed).

## T129 — FID-2026-1004-003 (closed, commit `08f35cb6`)

- The 66 exactly-200000 rows classified via OpenRouter cross-vote
  (`dev/scratchpad/active/window-census-classify.ts`, re-runnable):
  **50 REAL** (OpenRouter agrees 200000 — claude-haiku-4.5, opus-4.1/4.5,
  sonnet-4, the o-series), **7 LEAK-PROBABLE** (GLM-4.x/5 family: gateway
  catalogs under-state 204800/202752 as 200000 — ~2% under-window,
  catalog-owned, registered with a re-census trigger rather than inert
  fallback rows), **3 consistent-with-flagged-default**, **6 UNDETERMINED**
  (dated NEEDS-REVIEW notes).
- The 5 zero-row registry providers diagnosed — **none dead**: cloudflare
  (static curated + account-scoped API), ollama (local by design, daemon
  HTTP 200), codecraft + cleanapis (auth-gated 401), **xkiro LIVE KEYLESS
  again** (HTTP 200, 129 rows with context_length — the T119-era 403 lifted;
  fetcher already wired in gateway.ts; rows self-populate on the next
  catalog rebuild).
- Register notes updated in `window-coverage-register.ts`; no runtime data
  changed. Receipt 4/4 (typecheck ×2, register suite, quality).

## T130 — FID-2026-1004-004 (closed, commit `a14f2721`)

- One OpenRouter cross-vote (466 rows): **27 of 28 NEEDS-REVIEW flags
  upgraded** to two-source consensus (24 agree, 3 conservative-minimum
  holds); **1 value corrected DOWN** —
  `apinex/free/deepseek-v4-flash-0731` 1,310,720 → 1,048,576 (2-of-2:
  OpenRouter direct listing + infron serving note; over-claim removed);
  **1 flag retained** (`bai/gemini-3-flash` — no OpenRouter listing).
- The mechanical flag-floor pin re-derived 15 → 4 with the upgrade evidence
  cited in the FID and survivors enumerated in the test (justified
  supersession, not silent weakening).
- Receipt 10/10 (typecheck ×2, 7 suites 60 pass / 0 fail / 1,502 expect(),
  quality).

## Post-closure governance

- `validate:repository` PASS · eslint 0 · lint:md 0.
- Register state: SCOPE.md back to **Three items are open** (T119, T62-followups,
  T122 — all operator-blocked).

## Boundaries

- Local commits only; nothing pushed (standing invariant + operator ruling).
- Probe/catalog evidence lives in gitignored `dev/scratchpad/active/`
  (re-runnable).
