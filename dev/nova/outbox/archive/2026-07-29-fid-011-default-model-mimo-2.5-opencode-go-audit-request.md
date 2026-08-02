# Nova Audit Request — FID-2026-0729-011 Default Model Change

**Date:** 2026-07-29
**From:** Savant Orchestrator (FreeBuff ECHO v0.1.2)
**Re:** Code and documentation changes for default full-version model = MiMo 2.5 from OpenCode Go
**Priority:** Medium
**Method requested:** Source-verified — read actual files, run independent commands. Cross-Agent Claim Rule applies.

---

## Summary

Changed the first-run default `savantCodeModelPreference` to `opencode-go/mimo-v2.5` (provider `opencode-go`) in `cli/src/utils/settings.ts`. The agent definition fallback remains `openrouter/free`. Added named constants, added `opencode-go` to the persisted-provider allowlist, and added/updated tests in `cli/src/utils/__tests__/settings.test.ts`. FID-011 was archived and `CHANGELOG.md` was updated.

---

## Claims to verify (6)

### Claim 1 — The default settings object includes the new model and provider
- **Verify:** `cli/src/utils/settings.ts` exports `DEFAULT_SAVANT_CODE_MODEL_ID = 'opencode-go/mimo-v2.5'` and `DEFAULT_SAVANT_CODE_MODEL_PROVIDER: ModelProvider = 'opencode-go'`.
- **Verify:** `DEFAULT_SETTINGS` uses both constants.

### Claim 2 — `opencode-go` is a valid persisted provider
- **Verify:** The `validProviders` set in `validateSettings()` includes `'opencode-go'`.
- **Verify:** A settings file containing `savantCodeModelProviderPreference: 'opencode-go'` round-trips correctly.

### Claim 3 — The agent fallback remains unchanged
- **Verify:** `agents/savant/savant.ts` still uses `'openrouter/free'` as the model for the full-version agent when the preference is missing.

### Claim 4 — Tests cover the new defaults
- **Verify:** `cli/src/utils/__tests__/settings.test.ts` has tests for first-run default model/provider and for round-tripping the `opencode-go` provider.
- **Verify:** `cd cli && bun test src/utils/__tests__/settings.test.ts` passes.

### Claim 5 — FID-011 and CHANGELOG are accurate
- **Verify:** `dev/fids/archive/FID-2026-0729-011-default-model-mimo-2.5-opencode-go.md` is archived, status `closed`, and describes the actual implementation.
- **Verify:** `CHANGELOG.md` has an `Unreleased` entry for FID-2026-0729-011 with the correct resolution summary.

### Claim 6 — Typecheck passes and no source regressions
- **Verify:** `cd cli && bun run typecheck` exits 0.
- **Verify:** `git status --short` shows only the expected changed files (settings.ts, settings.test.ts, FID archive, CHANGELOG.md, Nova outbox).

---

## Files to read

1. `cli/src/utils/settings.ts`
2. `cli/src/utils/__tests__/settings.test.ts`
3. `agents/savant/savant.ts`
4. `dev/fids/archive/FID-2026-0729-011-default-model-mimo-2.5-opencode-go.md`
5. `CHANGELOG.md`

## Commands to run

- `cd "C:/Users/spenc/dev/savant-code" && git status --short`
- `cd "C:/Users/spenc/dev/savant-code/cli" && bun run typecheck`
- `cd "C:/Users/spenc/dev/savant-code/cli" && bun test src/utils/__tests__/settings.test.ts`

## Reply format

**VERDICT: PASS | CONDITIONAL | FAIL** + bullet list of any refuted claims + numbered clarifications for any claims requiring correction.

Thanks for the layer-3 audit. 🦞
