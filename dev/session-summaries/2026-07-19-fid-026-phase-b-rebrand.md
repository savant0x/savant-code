# Session 2026-07-19: FID-026 Phase B — TypeScript Rebrand

## Summary

Executed FID-026 Phase B (steps 1–6): complete rebrand of all TypeScript workspaces
from `@codebuff/*` → `@savant-code/*`. Reduced 171 type errors to 0 through surgical
`str_replace` edits across ~50 files — no scripts or sed used.

**Final state:** 199 files changed, 1,984 insertions, 800 deletions. x4 typecheck gate
clean (sdk + common + agent-runtime + cli). FID archived to `dev/fids/archive/`,
CHANGELOG entry written.

## Key Changes

### Component renames (SavantFree$1 mangled identifiers → proper names)

- `SavantFreeModelSelector`, `SavantFreeLandingScreen`, `SavantFreeReferralBanner`,
  `SavantFreeActiveSessionSummary`, `SavantFreeSupersededScreen`

### Type renames

- CLI types: `SavantFreeSession`, `SavantFreeSessionStatus`, `SavantFreeSessionStore`,
  `SavantFreeModelStore`, `SavantFreeSessionProgress`, `SavantFreeInstanceOwner`,
  `SavantFreeStreakLine`, `SavantFreeGateErrorCode`, `SavantFreeReferralFocusTarget`
- Common types: `FreebuffSessionState`, `FreebuffModel`, `FreebuffAccessTier`,
  `FreebuffReferralInfo`, `FreebuffBlockReason`, `FreebuffIpPrivacySignal`,
  `FreebuffRateLimitsByModel`, `FreebuffStreakResponse`

### Env/client renames

- `resetCodebuffClient` → `resetSavantCodeClient` (5 files)
- `getCodebuffClient` → `getSavantCodeClient` (2 files)
- `CODEBUFF_API_KEY` → `SAVANT_CODE_API_KEY` (2 files)
- `NEXT_PUBLIC_CODEBUFF_APP_URL` → `NEXT_PUBLIC_FREEBUFF_APP_URL` (4 files + fallback)
- `CODEBUFF_IS_BINARY` → `SAVANT_CODE_IS_BINARY` (5 files + CliEnv type)

### Cleanup

- Removed stale `codebuff-client.ts` (0 importers)
- Renamed `LOGO_CODEBUFF` → `LOGO_SAVANT_CODE`

### Intentionally preserved

- Wire protocol: `codebuff_tool_call`, `codebuff_cli`, `codebuff_terminal_command`,
  `codebuff_end_step`, `cli.update_codebuff_failed`
- Config paths: `manicode` config dir, `.manicodeignore`

## Quality Gates

- ✅ cli typecheck: 0 errors (down from 171 → 0)
- ✅ common typecheck: 0 errors
- ✅ x4 gate (sdk + common + agent-runtime + cli): all 0 errors
- ✅ Repo-wide grep: 0 stray `@codebuff/`, `codebuff`, or `manicode` in source

## Key Learnings

- **Never use sed for rebrands at scale.** `SavantFree$1` was a prior sed artifact.
  All fixes done via `str_replace` with exact context strings — no regex, no cascading
  corruption.
- **Mangled identifiers cascade badly.** A single prior-broken `Freebuff$1` → `SavantFree$1`
  mangling contaminated 27 files with a name that mapped to 8 different types.
  Context-specific per-file replacements were the only safe approach.
- **Wire protocol references must stay.** The `codebuff_tool_call` XML tag, Gravity ads
  surface identifiers, and analytics event string values cannot be renamed without
  breaking server/LLM/ads compatibility.
- **Config dir paths are user-facing.** Changing `~/.config/manicode/` would orphan
  all existing user installations. Left as-is with explicit documentation.

## Environment

- **Date:** 2026-07-19
- **OS:** Windows 11 + Git Bash (MSYS)
- **Bun:** 1.3.14
- **TypeScript:** 5.5.4, `strict: true`
- **ECHO Protocol:** v0.2.0
- **Branch:** `main`
