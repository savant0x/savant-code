# FID: Default Model — MiMo 2.5 from OpenCode Go

**Filename:** `FID-2026-0729-011-default-model-mimo-2.5-opencode-go.md`
**ID:** FID-2026-0729-011
**Severity:** high
**Status:** closed
**Created:** 2026-07-29
**Author:** Savant (Orchestrator)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed`; Original ID: `FID-2026-0729-011-default-model-mimo-2.5-opencode-go`. Canonical ID: `FID-2026-0729-011`. Backfilled fields: Filename, ID. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

Change the default model for the full Savant-Code agent from `openrouter/free` to `opencode-go/mimo-v2.5`. The SavantFree product line is not being launched now, so this change applies only to the paid/full version default.

---

## Environment

- **OS:** Cross-platform (Windows / macOS / Linux)
- **Language/Runtime:** TypeScript / Bun ≥ 1.3.11
- **Tool Versions:** Savant Code v0.0.11+

---

## Detailed Description

### Problem

The current full-version default model in `agents/savant/savant.ts` is `'openrouter/free'`. The product direction is to use `opencode-go/mimo-v2.5` as the default model for the full Savant-Code experience. The SavantFree/free-tier default (`SAVANT_FREE_MINIMAX_M3_MODEL_ID`) is left untouched because the SavantFree product is not yet launched.

### Proposed Solution

Set the first-run default `savantCodeModelPreference` to `'opencode-go/mimo-v2.5'` in `cli/src/utils/settings.ts`. The agent definition keeps its existing fallback (`'openrouter/free'`) for cases where the preference is missing or cleared; the new default preference is written to `settings.json` on first run. The user can still override the default via `/model` in the CLI.

```typescript
const DEFAULT_SAVANT_CODE_MODEL_ID = 'opencode-go/mimo-v2.5' as const
const DEFAULT_SAVANT_CODE_MODEL_PROVIDER: ModelProvider = 'opencode-go'

const DEFAULT_SETTINGS: Settings = {
  mode: 'EDIT' as const,
  adsEnabled: false,
  savantCodeModelPreference: DEFAULT_SAVANT_CODE_MODEL_ID,
  savantCodeModelProviderPreference: DEFAULT_SAVANT_CODE_MODEL_PROVIDER,
}
```

The `opencode-go` provider was also added to the `validateSettings` allowlist so the provider preference round-trips correctly.

### Affected Components

- `cli/src/utils/settings.ts`
- `cli/src/utils/__tests__/settings.test.ts`

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [x] Low: Minor issue, cosmetic, or edge case

**Justification:** Single constant string change in the agent definition; user can still override via `/model` or `modelOverride`.

---

## Verification

- `cd cli && bun run typecheck` passes.
- Agent definition bundle regenerates correctly (if prebuild runs).

---

## Perfection Loop

### Loop 1

- **RED:** The full-version default model is currently `openrouter/free`; product wants `opencode-go/mimo-v2.5`.
- **GREEN:** Add `savantCodeModelPreference: 'opencode-go/mimo-v2.5'` to `DEFAULT_SETTINGS` in `cli/src/utils/settings.ts`.
- **AUDIT:** Verify typecheck passes; verify the agent fallback remains unchanged.
- **CHANGE DELTA:** 1 line in `cli/src/utils/settings.ts`.

### Code Verification Evidence

- [x] File referenced in "Affected Components" exists in the codebase
- [x] Implementation matches the proposed solution
- [x] Typecheck passes
- [ ] FID status updated to reflect actual implementation state

---

## Resolution

- **Fixed By:** Orchestrator
- **Fixed Date:** 2026-07-29
- **Fix Description:** Set first-run default `savantCodeModelPreference` to `opencode-go/mimo-v2.5` in `cli/src/utils/settings.ts`. The agent fallback remains `openrouter/free`; the user can override the default via `/model`.
- **Tests Added:** Yes — first-run default preference test and `opencode-go` provider round-trip test in `cli/src/utils/__tests__/settings.test.ts`
- **Verified By:** Typecheck and settings tests
- **Commit/PR:** [pending]
- **Archived:** [pending]

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.
