# Session Summary — 2026-09-19 ~08:15 UTC — Fallback-table live audit + FID-2026-0919-020

> Operator challenged the offline fallback table directly: "can't you just
> call the OpenRouter API and confirm all of this?" — and asked how many
> rows are wrong. Answer process and outcome below.

## Audit chain (all probes in dev/scratchpad/, 2026-09-19)

1. `audit-window-review-report.ts` — verified the operator-pasted report
   (`docs/Model Context Window Review.md`) against the REAL shipped code:
   132/140 legacy-heuristic failures reproduce exactly; one report typo
   (hcnsec "6/7" → truth 7/7; its own table + split-sum agree).
2. `audit-table-vs-live.ts` — the report validates the report, not the
   table. Audited all 140 table rows against the LIVE OpenRouter catalog:
   97 capability matches, **18 diverged**, 25 no-twin.
3. `audit-notwin-normalized.ts` — Tier A': normalized-spelling matching
   verified 4 commandcode dash-spelled Claude rows (→ dotted twins, 1M).
4. `audit-gateway-rosters.ts` — Tier B: each gateway's OWN keyed
   `/v1/models` roster verified 6 more rows; no new wrong values anywhere.
5. DeepSeek policy call surfaced by the operator ("why would we pin a 1.3M
   model down to 1M?"): `hcnsec/DeepSeek-V4-Flash` stays 1,310,720 — the
   row is route-keyed and that route serves 1.31M (upstream capability
   1,048,576). Table = CAPABILITY policy, explicit from the operator.

## Implementation (FID-2026-0919-020, operator-approved)

- `common/src/constants/context-window-table.ts`: **17 corrections**
  (12 substantive — 10 up, 2 DOWN for OOM-direction over-allocations —
  plus 5 rounding normalizations), each comment-dated; hcnsec route note;
  intern-s2 inert note (dropped from unorouter roster).
- `cli/src/utils/openrouter-models/static-catalogs-gateways.ts`: **shadow
  pin tables deleted** (`INFRON_CONTEXT_WINDOWS`, `UNOROUTER_CONTEXT_WINDOWS`)
  — caught when 4 test pins failed post-edit; they overrode the fallback
  table and had drifted from it (the exact failure class this FID kills).
  Law 13: one source of truth.
- Test pins: 17-row correction pin (fallbacks suite), static-catalog pins
  updated to audit values, one pre-existing pin updated (1M → 1,310,720).
- `.markdownlintignore`: pasted report exempted under the
  pasted-research-artifact precedent (its claims are now independently
  verified and recorded here + in the FID).

## Gates (real runs)

typecheck common + cli 0 · fallbacks suite green (46/0 across the 4
affected suites) · window-truth green · static-catalogs green · quality
PASS · eslint 0 · lint:md 0 · receipt **6/6** via `--write` (fingerprint
`sha256:161ffbf9…`). FID-020 status `verified`.

## Honest notes

- First FID draft's correction list said 17 but enumerated 16 (missed
  `infron/z-ai/glm-5.3-flash` — edit had landed, list hadn't); caught on
  re-read, fixed in both.
- 8 residual rows unverifiable or inert, dispositions recorded in the FID
  (roster-silent ×5, off-roster ×2, no-stored-key commandcode ×3 with
  corroborating upstream sources).
- Commit withheld (G2) — 018/019/020 join the next closure batch.
