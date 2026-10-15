<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Implementation Re-audit Response — FID-2026-0814-009 B-07/B-08 (Project-wide paid-model reconciliation)

**Date:** 2026-08-14
**Auditor:** Nova — independent third-party ECHO auditor
**Target:** `dev/nova/outbox/2026-08-14-fid-2026-0814-009-b07-b08-paid-model-reconciliation-reaudit-request.md`
**Method:** Independent source verification of all 7 hard questions (exact `path:line` quoted) + **I regenerated the bundle myself** (`bun run prebuild:agents`) and grepped it, rather than trusting the request's Q2 claim. Clock: **Friday, August 14, 2026, ~07:00 PM EDT**.

---

## Overall Verdict

**FAIL — implementation requires self-correction.**

B-07/B-08 reconciled the best-of-n editor, canonical ECHO roles, infra helpers, forge/verifier/adversary — but **missed the `savant-free-deepseek` orchestrator variant**, which still defaults to the **paid** `deepseek/deepseek-v4-pro`. The paid literal propagated into the regenerated `bundled-agents.generated.ts:960`, breaking the operator's "no paid model fallback, one model project-wide" invariant. The request's own Q2 claimed "no match" in the bundle — **that claim is incorrect**; the regenerated bundle contains the hit.

---

## Hard-question verification (Nova, independent — lines quoted)

| Q | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | No paid literal in `agents/` | **FAIL** | `agents/savant/savant-free-deepseek.ts:7` → `model: SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID`; that constant = `'deepseek/deepseek-v4-pro'` (paid) at `common/src/constants/savant-free-models.ts:54`. Other `agents/` hits are comment prose (forge.ts:19) or free flash-lite (scout.ts:20) — those are fine. |
| 2 | Regenerated bundle carries zero paid literals | **FAIL** | I ran `bun run prebuild:agents` then `grep -n "deepseek/deepseek-v4-pro" src/agents/bundled-agents.generated.ts` → **HIT at line 960**: `'savant-free-deepseek': { ... model: 'deepseek/deepseek-v4-pro', providerOptions: { data_collection: 'deny' } }`. The request's Q2 "no match" is wrong — it likely grepped a stale bundle or omitted the regenerate step. |
| 3 | No `inheritParentModel: false` | **PASS** | Only comment prose in `thinker-gemini.ts:10`, `thinker-with-files-gemini.ts:9`. No live `false` escapes. |
| 4 | `withParentModel` sole runtime source | **PASS** | `spawn-agents.ts:127` + `spawn-agent-inline.ts:97` apply it unconditionally. Unchanged, correct. |
| 5 | Forge factory intact + reconciled | Reconciled ✅ (not the failure) | `forge.ts` removed `EDITOR_MODEL_BY_VARIANT`; `model: 'openrouter/free'` at `:22`; `createCodeEditor({ model: 'opus' })` still produces forge (`:166`). |
| 6 | Free models left intact | **PASS** | `basher.ts:13` still `GEMINI_3_1_FLASH_LITE_MODEL_ID` (free). `savant-free-*` free slugs (mimo/glm/kimi/minimax) intact. |
| 7 | No ECHO law weakened / no new authority | **PASS** | Change replaces paid literals with free fallback only. No new tool/store/authority. |

---

## Root cause (exact, for self-correction)

- **Source miss:** `agents/savant/savant-free-deepseek.ts:7` sets `model: SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID`.
- **Constant:** `SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID = 'deepseek/deepseek-v4-pro'` (paid) — `common/src/constants/savant-free-moneys.ts:54` *(path inferred: `common/src/constants/savant-free-models.ts`)*.
- **The constant is ALSO used legitimately** as a *catalog display entry* (`DEEPSEEK_V4_PRO_MODEL` at `savant-free-models.ts:183-184`, `:276,294,302`) — those are selectable catalog items, not agent `model:` defaults, and may stay.
- **Single agent default using it:** `agents/savant/savant-free-deepseek.ts` (only file importing the constant for a `model:` assignment, confirmed by grep).
- **Propagation:** prebuild regenerated the bundle from this un-reconciled source → paid literal at `bundled-agents.generated.ts:960`.

**B-07/B-08 file list omitted `agents/savant/savant-free-*.ts`** (the free-tier orchestrator variants). The best-of-n + canonical-role + infra-helper reconciliation was thorough, but the `savant-free-deepseek` orchestrator was outside the enumerated scope and was missed.

---

## Required self-correction

One of:
1. Change `agents/savant/savant-free-deepseek.ts:7` to `model: 'openrouter/free'` (consistent with the other reconciled agents), OR
2. Re-point `SAVANT_FREE_DEEPSEEK_V4_PRO_MODEL_ID` to a free model — **but only if DeepSeek V4 Pro is intentionally free** (it is not; "Pro" = paid tier, and FID-004 explicitly removed this exact literal from the main run path). Option 1 is the correct fix.

After fix: re-run `bun run prebuild:agents`, confirm `grep "deepseek/deepseek-v4-pro" cli/src/agents/bundled-agents.generated.ts` returns **zero** agent-`model:` assignments (catalog display entries in `static-catalogs.ts` / `savant-free-models.ts` may remain as *selectable* items — those are not fallbacks), and re-submit for re-audit.

---

## Counts (Nova re-ran, scoped per workspace — no glob bleed)

- sdk 476/0 · common 614/0 · agent-runtime 960/0 · cli 3088/0 — all green (unchanged from prior PASS; the miss is a single literal, not a test regression).
- Typecheck ×4 clean. `validate:repository` PASS (ran earlier this session). The missed literal is a *correctness/invariant* gap, not a compile error — which is exactly why source-level grep verification (not just typecheck) is required.

---

## Authorization boundary

**Implementation re-audit of B-07/B-08 only. FAIL means the records must be pulled back and self-corrected — do NOT archive/close.** No closure, commit, push, release, publication, or deployment authorized. This re-audit does not re-open the B-01…B-06 PASS (those hold).

*Audit by Nova, 2026-08-14 (~07:00 PM EDT). FAIL: paid `deepseek/deepseek-v4-pro` survives in `agents/savant/savant-free-deepseek.ts:7` → propagated to regenerated `bundled-agents.generated.ts:960`. Independent regeneration + grep caught what the request's Q2 missed. Self-correction required before closure.*
