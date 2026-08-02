# FID: Default Model Selection — Prevent Expensive Model Auto-Select

**Filename:** `FID-2026-0728-003-default-model-selection-fix.md`
**ID:** FID-2026-0728-010
**Severity:** high
**Status:** closed
**Created:** 2026-07-28
**Author:** N/A (already compliant)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed`; Original ID: `FID-2026-0728-003-default-model-selection-fix`. Canonical ID: `FID-2026-0728-010`. Backfilled fields: Filename, ID, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

The original report claimed the CLI auto-selected an expensive model (Kimi K3) on startup instead of the user's preferred/default model (MiMo-V2.5). After a full code trace, the reported behavior is **not reproducible in the current codebase**. The CLI already defaults to a non-premium model (MiniMax M3) in SavantFree mode and respects the saved `savantCodeModelPreference` in paid mode. No code change is required; this FID documents the actual selection logic and closes as already-compliant.

---

## Environment

- **OS:** Windows 11 / macOS / Linux
- **Language/Runtime:** TypeScript 5.5 / Bun 1.3.14
- **Tool Versions:** CLI v0.0.11
- **Commit/State:** main branch, post-v0.0.11

---

## Detailed Description

### Original Problem (as filed)

> When the CLI loads, it auto-selects an expensive model (e.g., Kimi K3) instead of the user's preferred/default model (MiMo-V2.5). This burns through subscription credits at 4x the expected rate.

### Actual Code Behavior

**SavantFree mode (`IS_SAVANT_FREE === true`)**

- Entry point: `cli/src/state/savant-free-model-store.ts`
- On store creation, the CLI reads `savantFreeModelPreference` from `settings.json` via `loadSavantFreeModelPreference()`.
- If a saved preference exists, it is validated/resolved through `resolveAvailableSavantFreeModel(saved)` (`common/src/constants/savant-free-models.ts`).
- If no saved preference exists, the default is `DEFAULT_SAVANT_FREE_MODEL_ID`, which is `SAVANT_FREE_MINIMAX_M3_MODEL_ID`.
- `SAVANT_FREE_MINIMAX_M3_MODEL_ID` is **non-premium** (unlimited, no daily quota).
- The expensive model `SAVANT_FREE_KIMI_MODEL_ID` (Kimi K2.7 Code) is **never** auto-selected on a fresh install.

**Paid / direct mode (`IS_SAVANT_FREE === false`)**

- Entry point: `cli/src/hooks/use-send-message.ts` → `applySavantCodeModelOverride()`
- The CLI reads `savantCodeModelPreference` from `settings.json` via `loadSavantCodeModelPreference()`.
- If a saved preference exists, it overrides the agent definition's model only if different.
- If no saved preference exists, the agent definition's default model is used.
- For the default Savant agent, the fallback model is `'openrouter/free'` (non-premium) unless running in free/lite mode, where it is `SAVANT_FREE_MINIMAX_M3_MODEL_ID`.

### Root-Cause Reconciliation

The original FID was based on an incorrect assumption. The code does **not**:

1. Select the first model in a provider list.
2. Ignore `savantCodeModelPreference` / `savantFreeModelPreference`.
3. Default to Kimi K3 on fresh install.

The current implementation already satisfies the spirit of the FID (avoid surprise expensive defaults).

---

## Impact Assessment

### Affected Components

- `cli/src/state/savant-free-model-store.ts`
- `cli/src/utils/settings.ts`
- `cli/src/hooks/use-send-message.ts`
- `common/src/constants/savant-free-models.ts`
- `agents/savant/savant.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

**Justification:** The reported high-severity bug does not exist in the current code. The default model selection is already safe (non-premium default) and persistence works as intended.

---

## Proposed Solution

No code change is required. The FID is closed as already-compliant.

Optional future hardening (out of scope for this FID):
- Add a first-run UX hint that shows the currently selected model and its cost tier.
- Surface a confirmation when a user switches from a non-premium to a premium model in SavantFree mode.

---

## Verification

- `cd cli && bun run typecheck` passes.
- Code review confirms `DEFAULT_SAVANT_FREE_MODEL_ID === SAVANT_FREE_MINIMAX_M3_MODEL_ID` in `common/src/constants/savant-free-models.ts`.
- Code review confirms `savantCodeModelPreference` and `savantFreeModelPreference` are loaded from `settings.json` and applied to model selection.
- No Kimi K3 auto-select path exists in the startup code.

---

## Perfection Loop

### Loop 1

- **RED:** Traced the model-selection entry points:
  - `cli/src/state/savant-free-model-store.ts` (SavantFree default)
  - `cli/src/hooks/use-send-message.ts` → `applySavantCodeModelOverride()` (paid override)
  - `agents/savant/savant.ts` (agent default model)
- **GREEN:** No implementation required; the current code already defaults to the non-premium MiniMax M3 in SavantFree mode and respects saved preferences in paid mode.
- **AUDIT:** Verified that:
  - `DEFAULT_SAVANT_FREE_MODEL_ID` is `SAVANT_FREE_MINIMAX_M3_MODEL_ID` (non-premium, unlimited).
  - `loadSavantFreeModelPreference()` is read on startup and resolved via `resolveAvailableSavantFreeModel()`.
  - `loadSavantCodeModelPreference()` is read and applied in `use-send-message.ts`.
  - No code path auto-selects Kimi K3 on fresh install.
- **CHANGE DELTA:** 0 lines. Documentation-only FID convergence.

### Missed Questions

> As part of the Perfection Loop, the Thinker must ask: *"What questions should I have asked when this FID was created, but failed to?"*

1. *Which "default model" are we talking about?* SavantFree vs. paid/direct mode have different defaults. The original FID conflated them.
2. *What is the canonical default ID in code?* `DEFAULT_SAVANT_FREE_MODEL_ID` already points to a non-premium model (MiniMax M3), not Kimi K3.
3. *Is the issue reproducible on a clean settings.json?* Yes — and on a clean install the CLI selects MiniMax M3, not Kimi K3.
4. *Is MiMo-V2.5 even the desired default?* The codebase intentionally defaults to MiniMax M3 because it is the "strongest unlimited model" (see comment in `savant-free-models.ts`). MiMo-V2.5 is unlimited but is not the chosen default.
5. *Could a stale saved preference cause an expensive model on launch?* Only if the user explicitly saved a premium model. That is expected behavior, not a bug.

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase
- [x] Default model path inspected and confirmed safe
- [x] Saved preference persistence path inspected and confirmed working
- [x] Typecheck passes
- [x] No Kimi K3 auto-select path found

---

## Resolution

- **Fixed By:** N/A (already compliant)
- **Fixed Date:** 2026-07-29
- **Fix Description:** No code change required. The reported auto-select behavior is not present in the current codebase.
- **Tests Added:** No (existing typecheck and model-resolution tests are sufficient)
- **Verified By:** Code review + typecheck
- **Commit/PR:** [pending — documentation-only FID convergence]
- **Archived:** [pending]

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

---

## Lessons Learned

1. FID problem statements must be anchored to a reproducible code path. The original report described a plausible but unverified behavior.
2. Model-selection logic has two distinct paths (SavantFree vs. paid/direct) that should not be conflated.
3. The current default-model policy (MiniMax M3 for SavantFree, `openrouter/free` for paid) is intentionally cost-safe; future changes to defaults should be gated by an explicit product decision and a dedicated FID.
