# Session Summary — 2026-07-19: FID-026 Debugging + IS_SAVANT_FREE Rename

**Duration:** 2026-07-19 (afternoon session)
**Context:** Post-FID-026 Phase B rebrand. CLI launched showing "Out of credits" despite OpenRouter routing being configured.

---

## Issues Diagnosed

### 1. "Out of Credits" Banner in Direct-Provider Mode (Root Cause)

**Symptom:** CLI showed "Out of credits. Please add credits at https://savant-code.com/usage" despite
`DIRECT_PROVIDER=openrouter` and `OPENROUTER_API_KEY` being set.

**Root cause:** `useUsageMonitor` and `OutOfCreditsBanner` never checked `isDirectProviderMode()`. They only checked
`IS_SAVANT_FREE` (free mode flag). When running in premium mode with direct-provider routing, the usage query fired against
the backend URL (which defaulted to `https://savant-code.com`) instead of being skipped. The rebrand's env var rename
(`NEXT_PUBLIC_CODEBUFF_APP_URL` → `NEXT_PUBLIC_FREEBUFF_APP_URL`) exposed this gap — the user may have had the old env
var set before the rebrand.

**Fix:** Added `isDirectProviderMode()` bypass to 4 files:

- `use-usage-monitor.ts` — `enabled: !IS_SAVANT_FREE && !isDirectProviderMode()`
- `out-of-credits-banner.tsx` — early return
- `subscription-limit-banner.tsx` — early return
- `usage-banner.tsx` — early return

### 2. `IS_FREEBUFF` → `IS_SAVANT_FREE` Rename

**Scope:** 132 instances across 46 files, all in `cli/src/`.

**Method:** Single `sed` replacement across all `.ts`/`.tsx` files. Updated declaration in `constants.ts` with
clarifying comment documenting the `SAVANT_FREE_MODE` env var mapping.

**Quality gate:** CLI typecheck passes at 0 errors. x4 typecheck gate all green.

### 3. Free Mode Disabled (Temporary)

Hardcoded `IS_SAVANT_FREE = false` with TODO comment. The full SavantFree system (session gate, model store, UI
components, free model selector) is preserved intact — only the flag is bypassed. Restore with one line change when
ready.

---

## Key Learnings

1. **Direct-provider mode was incomplete.** The connection status check skipped backend pings, but
   usage/subscription/credits banners all independently queried the backend. Each banner was gated only on
   `IS_SAVANT_FREE`, not `isDirectProviderMode()`. When adding new backend-dependent UI, always add the direct-provider
   bypass.

2. **Env var renames have cascading effects.** `NEXT_PUBLIC_CODEBUFF_APP_URL` → `NEXT_PUBLIC_FREEBUFF_APP_URL` broke any
   pre-existing user env configs. The fallback (`https://savant-code.com`) meant API calls went to the wrong host
   silently.

3. **`IS_SAVANT_FREE` was the last unbranded constant.** The rebrand renamed file paths, component names, types, and env
   vars — but the feature flag constant was left for last. 132 instances is a lot, but a single `sed` replacement
   handled it cleanly because the name was unique and used consistently.

4. **Doc counts must be source-verified.** Nova caught undercounts in the preserved-item tables. Source-verified
   repo-wide counts: `codebuff_tool_call` = 97, `codebuff_cli` = 2,
   `codebuff_terminal_command` = 1, `SAVANT_FREE_MODE` = 108,
   `CODEBUFF_CLI_*` = 51, savant settings keys = 23. Active-source-only counts
   are lower (e.g., 72 / 103 / 24 / 25). Repo-wide counts include the audit
   documents themselves; active-source counts exclude docs/tests/CHANGELOG and
   are the operational baseline. `codebuff-client.ts` was verified removed from disk via `test -f`; no code action
   required.

---

## Files Changed (This Session)

| Change | Files | Instances |
|--------|-------|-----------|
| Direct-provider bypass | 4 | 4 early-return/enabled changes |
| `IS_FREEBUFF` → `IS_SAVANT_FREE` | 46 | 132 replacements |
| Comment update | 1 | Declaration doc in constants.ts |

**Cumulative FID-026:** 232 files, 2,132 insertions, 927 deletions.
