# Session Summary — FID-027 Clean Break

**Date:** 2026-07-19
**FID:** FID-2026-0719-027 — Clean Break: Remove Remaining `codebuff` Legacy Identifiers
**Status:** COMPLETE

## Initial State

Post-FID-026 rebrand. Active source still contained `codebuff`-branded identifiers that were intentionally preserved
under the assumption they were external contracts. Operator requested a complete clean break.

## Work Performed

1. **Perfection Loop (RED → GREEN → AUDIT → COMPLETE)**
   - Created FID-027 with RED phase evidence.
   - Documented exact rename mapping and no-backward-compat decision in GREEN phase.
   - Audited: confirmed all remaining identifiers are internal-only.
   - Archived FID to `dev/fids/archive/`.

2. **Implementation**
   - Renamed XML stop sequences: `codebuff_tool_` → `savant_code_tool_`.
   - Renamed analytics string: `cli.update_codebuff_failed` → `cli.update_savant_code_failed`.
   - Renamed all `CODEBUFF_*` env vars → `SAVANT_CODE_*`.
   - Renamed `NEXT_PUBLIC_CODEBUFF_APP_URL` → `NEXT_PUBLIC_SAVANT_CODE_APP_URL`.
   - Renamed `CODEBUFF_BINARY` → `SAVANT_CODE_BINARY` in `scripts/tmux/tmux-start.sh`.
   - Updated comment in `packages/agent-runtime/src/tools/tool-executor.ts`.

3. **Verification**
   - x4 typecheck gate: all pass.
   - `cli/src/__tests__/utils/env.test.ts`: 17 tests pass.
   - Final grep: 0 `codebuff` / `CODEBUFF` references in active source or scripts.

## Remaining Intentional References

- Historical docs (`CHANGELOG.md`, `dev/fids/archive/`, `dev/nova/`, `dev/session-summaries/`, `LEARNINGS.md`, `history.md`).
- `.env.local` (user secrets, not modified).
- Build artifacts and log files (`sdk/dist/`, `debug/cli.jsonl`).

## Blockers

None.

## Next Steps

- Update developer `.env` files and CI/CD secrets to use new `SAVANT_CODE_*` env var names.
- Regenerate `sdk/dist/` to purge old env var references from build artifacts.
- Consider a follow-up FID for the 23 remaining `freebuff` references if a full clean break is desired.
