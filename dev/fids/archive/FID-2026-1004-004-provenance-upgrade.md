# FID: NEEDS-REVIEW provenance upgrade — live OpenRouter cross-vote

**Filename:** `FID-2026-1004-004-provenance-upgrade.md`
**ID:** FID-2026-1004-004
**Severity:** medium
**Status:** closed (implemented + verified, 2026-10-04)
**Created:** 2026-10-04
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

Operator ruling 2026-10-04 (T130, "Upgrade provenance" — supersedes the
cross-gateway-rows-only sourcing rule for ONE keyless read-only probe): a
re-runnable probe fetches the OpenRouter public catalog (466 rows, 2026-10-04)
and cross-votes the ~20 rows FID-2026-1004-002 flagged NEEDS-REVIEW. Outcome:
24 AGREE → upgraded to two-source consensus; 4 CONFLICT → conservative
minimum holds (one real value correction: apinex/free/deepseek-v4-flash-0731
1,310,720 → 1,048,576, over-claim removed by 2-of-2); 1 NO-LISTING
(bai/gemini-3-flash stays flagged).

## Evidence

- Probe: `dev/scratchpad/active/window-census-classify.ts` section B; saved
  catalog `dev/scratchpad/active/provenance-upgrade-or-catalog.json`.
- 24 AGREES / 4 CONFLICT / 1 NO-LISTING (full listing in the probe output).

## Changes (data-only)

- `context-window-table-apinex.ts`: 12 rows upgraded to consensus provenance
  (`// OR-live 2026-10-04` second source); deepseek-v4-flash-0731 corrected
  DOWN to 1,048,576 (2-of-2: OpenRouter direct listing + infron serving note);
  mimo-v2.6-flash conflict-min annotated (KIO 1,048,576 vs OR 1,050,000).
- `context-window-table-bai.ts`: 11 rows upgraded; gemini-3-flash stays
  flagged (no OpenRouter listing; inherits the kiosapi family inference).
- `context-window-table.ts`: 5 rows upgraded (orcarouter gpt-5.5-pro,
  glm-5.3-flash-free conflict-min; nvidia kimi-k2.6, nemotron-ultra,
  laguna-xs); dated-inherit comments softened where the parent is now
  consensus.
- `window-truth-router-gaps.test.ts`: the mechanical NEEDS-REVIEW floor is
  RE-DERIVED from 15 to 4 — 27 flags legitimately became consensus
  provenance; the remaining flags are enumerated in the test comment (parent
  flagged-defaults + bai/gemini-3-flash). This is a justified supersession
  with the upgrade evidence cited, not a silent weakening: the pin still
  fails if any remaining flag is deleted.
- `window-truth-apinex.test.ts`: the deepseek-0731 spot window follows the
  corrected value (1,048,576).

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-apinex.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-bai.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-router-gaps.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test cli/src/utils/__tests__/context-window-fallbacks.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:fc9037f35b8a07348446afafc1ccc01f093062184b7650d0cd2dcf7c067db7c6
- verified: 2026-10-04T22:18:39.303Z
- typecheck common: exit 0
- typecheck cli: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-apinex.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-bai.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-router-gaps.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- test cli/src/utils/__tests__/context-window-fallbacks.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED/GREEN/AUDIT

- **RED:** ~20 rows rested on single sources with mechanical NEEDS-REVIEW
  flags (the known cost of the cross-rows-only ruling).
- **GREEN:** One probe, 30 cross-votes: 24 consensus upgrades, 4 conservative
  minima, 1 honest NO-LISTING; one value corrected DOWN (0731 1,310,720 →
  1,048,576 — over-claim removed, the safe direction).
- **AUDIT:** All declared suites green; flag-floor pin re-derived and
  justified (27 upgrades cited).
- **ADVERSARIAL:** "Is the floor change assertion-weakening?" — no: the pin's
  purpose is that flags cannot silently disappear; they did not disappear,
  they were UPGRADED with named evidence, and the pin now enumerates the
  survivors so deleting even one still fails.
- **CHANGE DELTA:** ~new-document

## Resolution

- **Closed Date:** 2026-10-04 (G2: implementation commit)
- **Fix Description:** 24 consensus upgrades, 1 downward correction, 1 flag
  retained; pin floor re-derived 15 → 4 with the upgrade evidence.
- **Tests Added:** Pin threshold re-derivation + spot-window correction in the
  existing suites.
- **Archived:** yes — closure commit moves this file to `dev/fids/archive/`.

## Lessons Learned

A provenance floor pin must enumerate its survivors when the flag population
legitimately changes — otherwise the next upgrade either breaks the pin or
tempts a silent threshold edit. The re-derivation belongs in the FID that
performs the upgrades.
