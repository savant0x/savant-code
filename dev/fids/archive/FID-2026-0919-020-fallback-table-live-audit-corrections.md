# FID-2026-0919-020 — Fallback-table live audit: 17 stale rows corrected against today's catalogs

- **Filename:** `dev/fids/FID-2026-0919-020-fallback-table-live-audit-corrections.md`
- **ID:** FID-2026-0919-020
- **Severity:** low
- **Status:** closed
- **Created:** 2026-09-19
- **Commit SHA:** 0acad450 (operator-authorized 2026-09-19)
- **Closed Date:** 2026-09-19 (commit 0acad450)
- **Archived:** 2026-09-19 — moved to `dev/fids/archive/`
- **Parent:** FID-2026-0919-019 (continuation of the same operator mandate:
  "not artificially restricted on any model" — this time auditing the table
  itself, not the resolution ladder)

## Symptom / provenance

External audit report (`docs/Model Context Window Review.md`) verified
against the shipped code (probe
`dev/scratchpad/audit-window-review-report.ts`): the report's 132/140
legacy-heuristic failure claim reproduces exactly. That validated the
*report*, not the *table* — so the table itself was audited against live
sources the same day (probes `audit-table-vs-live.ts`,
`audit-notwin-normalized.ts`, `audit-gateway-rosters.ts`).

## Loop 1 — RED (live-proven 2026-09-19)

Full table audit, all 140 rows:

- Tier A (live OpenRouter API, 447 entries): 97 rows match capability;
  **18 diverged**; 25 have no OpenRouter twin.
- Tier A' (normalized spelling): 4 commandcode dash-spelled Claude rows
  VERIFIED via their dotted twins (all 1M, capability AND topProvider).
- Tier B (each gateway's own keyed `/v1/models`): 6 more VERIFIED
  (infron nemotron 1,048,576; unorouter codestral 256K, north-mini-code
  256K, seed-oss 524,288, dots-3 512K; bazaarlink qwen3.8-max 1M).
- Prior vendor research (FID-2026-0919-019) stands for kiosapi ×6.

Findings requiring change: **12 substantive + 5 rounding (Δ ≤ 6,144)**.
Direction of the substantive errors: 10 under-allocations (capability grew
since the rows were written — glm-5.3-flash family ×4 now 1,310,720,
deepseek-v4-flash-0731 now 1,310,720, qwen3.8-27b ×3 now 1M capability,
deepseek-v4-flash:free/pro + gemini-3.6-flash:free now 1,048,576) and 2
OVER-allocations (unorouter/gpt-5.5 + gpt-6-astra 1,100,000 → live
capability 1,050,000 — the dangerous OOM direction).

Kept deliberately: `hcnsec/DeepSeek-V4-Flash` at 1,310,720 — the live
`deepseek/deepseek-v4-flash` capability is 1,048,576, but 1,310,720 is what
the hcnsec route serves (operator policy: the row is keyed to the route;
lowering it would be artificial restriction). Comment updated.

Tier-B residuals documented in comments, no value change:
`unorouter/intern-s2-preview:free` (dropped from unorouter roster — row
inert), `tokenbom/doubao-seed-2.1-pro` (off roster, NEEDS-REVIEW stands),
roster-silent ×5 (hcnsec/Qwen3.8-Flash-Next NEEDS-REVIEW stands — native
262,144 vs YaRN 1M unverifiable which the gateway enables,
tokenharbor/qwen3.8-max, th-orchestra, atria), commandcode ×3 (no stored
key; upstream sources corroborate all three: haiku 200K — OpenRouter
`claude-haiku-4.5` family, Qwen3.8-Max 1M — live-verified via bazaarlink,
ling 262,144 — OpenRouter compare page).

Policy note recorded: the table encodes CAPABILITY per the operator's
explicit direction ("why would we pin a model that has a 1.3M window down
to 1M?"). Where serving limits differ (qwen3.8-27b: served 262,144
everywhere despite 1M capability), rows carry inline caveat comments — the
runtime ladder already prefers the conservative topProvider value when
online (documented `contextLengthOf` policy), so the offline table staying
at capability never over-restricts and the online path never over-reaches.

## Loop 2 — GREEN (operator-approved)

In `common/src/constants/context-window-table.ts`:

- 17 value corrections (list in Verification intent below), each with an
  audit-dated comment.
- Comment updates: intern-s2 inert note, hcnsec DeepSeek route-keyed note,
  Tier-B verification date stamp.
- Test pins for all 17 in `cli/src/utils/__tests__/context-window-fallbacks.test.ts`.

### Verification intent

Corrections: infron deepseek-v4-flash:free 1,048,580→1,048,576;
infron …-0731:free 1,000,000→1,310,720; infron qwen3.8-27b:free
256,000→1,000,000; infron kat-coder-pro-v2 262,140→262,144; infron
glm-5.3-flash 1,000,000→1,310,720; unorouter glm-5.3-flash:free
1,000,000→1,310,720; unorouter deepseek-v4-flash:free 1,000,000→1,048,576;
unorouter gemini-3.6-flash:free 1,000,000→1,048,576; unorouter
qwen3.6-35b-a3b:free 262,100→262,144; unorouter qwen3.8-27b:free
65,536→1,000,000; unorouter step-3.7-flash:free 256,000→262,144;
unorouter gpt-5.5 1,100,000→1,050,000; unorouter gpt-6-astra
1,100,000→1,050,000; unorouter deepseek-v4-pro 1,000,000→1,048,576;
commandcode zai-org/glm-5.3 1,048,576→1,310,720; commandcode
Qwen/Qwen3.8-27B 262,144→1,000,000; commandcode meituan/LongCat-2.0:free
1,048,576→1,048,756.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: test cli/src/utils/__tests__/context-window-fallbacks.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-fid-0919-018.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:161ffbf9b2fdb1d0358ef4ac2c9757b446b9d8e96183e7e6d0acd0199f622c83
- verified: 2026-09-19T08:11:59.533Z
- typecheck common: exit 0
- typecheck cli: exit 0
- test cli/src/utils/__tests__/context-window-fallbacks.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-fid-0919-018.test.ts: exit 0
- quality: exit 0

## Loop record

- Loop 1 RED: three-probe live audit (OpenRouter exact/normalized +
  gateway rosters with stored keys), 2026-09-19.
- Loop 2 GREEN: implemented 2026-09-19 on operator approval ("Approve
  FID-020" with the 25-row Tier-B audit included). Two loop findings:
  1. The first test run failed 4 pins — root cause NOT the table edits but
     **shadow pinned-window tables** (`INFRON_CONTEXT_WINDOWS` /
     `UNOROUTER_CONTEXT_WINDOWS`) in `static-catalogs-gateways.ts` that
     overrode the fallback table and had drifted from it (this audit's
     exact failure class). Deleted per Law 13 — the fallback table is the
     single source of truth; the deleted 65,536 qwen3.8-27b metadata pin
     is superseded by the live-audit 1M capability row.
  2. The first FID draft missed the `infron/z-ai/glm-5.3-flash` row in its
     own correction list (edit landed, list said 17 rows but enumerated
     16) — caught on re-read; both the edit and the list now carry it.
- Loop 3 AUDIT: Method-2 re-read of the final table (17 corrected rows +
  route-keyed hcnsec comment + inert intern-s2 note), the deleted shadow
  tables (fetchers now read `getContextWindowFallback` directly), all four
  touched test files, and a fresh live re-audit confirming zero remaining
  capability divergences among OpenRouter-twinable rows beyond rounding
  noise documented in comments. Gates: typecheck common + cli 0 ·
  fallbacks suite green (incl. 17-row correction pin) · window-truth green
  · fid-0919-018 green · static-catalogs green (pins updated to the audit
  values) · quality PASS · eslint 0 · lint:md 0 (report added to
  .markdownlintignore under the pasted-research-artifact precedent) ·
  receipt 6/6 via `--write` (fingerprint `sha256:161ffbf9…`).
- Loop 4 COMPLETE: termination criteria met — every declared gate green
  from real runs; zero actionable findings on mechanical re-run.
