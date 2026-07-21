# FID: Clean Break — Remove Remaining `codebuff` Legacy Identifiers

**Filename:** `FID-2026-0719-027-clean-break-codebuff-legacy.md`
**ID:** FID-2026-0719-027
**Severity:** medium
**Status:** closed
**Created:** 2026-07-19
**Author:** Savant Orchestrator

---

## Summary

FID-026 completed the user-facing rebrand (`codebuff` → `savant-code`, `freebuff` → `savant-free`). However, a number of internal identifiers still carry the old `codebuff` brand: XML stop-sequence tags, analytics event strings, environment variables, and comments. This FID tracks the complete removal of those legacy strings so the codebase no longer references the old brand in active source.

## Environment

- **OS:** Windows 11 / bash
- **Language/Runtime:** TypeScript / Bun
- **Tool Versions:** Bun 1.3.14, TypeScript 5.x
- **Commit/State:** Post-FID-026 rebrand; main branch ahead of origin by 3 commits

## Detailed Description

### Problem

After FID-026, active source still contains `codebuff`-branded identifiers in:

1. **XML stop sequences** (`common/src/util/xml.ts`) — stop sequences use `</codebuff_tool_${toolName}>`, inconsistent with the renamed wire tag `savant_code_tool_call`.
2. **Analytics event string** (`common/src/constants/analytics-events.ts`) — `UPDATE_SAVANT_CODE_FAILED = 'cli.update_codebuff_failed'` keeps the old string literal.
3. **Environment variables** (`cli/src/types/env.ts`, `cli/src/utils/env.ts`, and consumers) — `CODEBUFF_CLI_*`, `CODEBUFF_EDITOR`, `CODEBUFF_TRACE`, `CODEBUFF_SHIP_LOGS`, `CODEBUFF_PERF_TEST`, `CODEBUFF_RG_PATH`, `CODEBUFF_SCROLL_MULTIPLIER` are still read.
4. **Comments** (`packages/agent-runtime/src/tools/tool-executor.ts`) — references `codebuff_end_step` in a comment.

### Expected Behavior

All active source identifiers should use the `savant_code` / `SAVANT_CODE` brand. No `codebuff` string should remain in compiled TypeScript source except in:
- CHANGELOG/history/session summaries (historical documentation)
- `docs/` migration notes (intentionally preserved)
- Archived FIDs

### Root Cause

FID-026 intentionally preserved these strings because some were treated as external contracts (wire protocol, analytics keys, env vars). Upon review, those contracts are either internal-only or already renamed, so the old brand can be fully retired.

### Evidence

```text
=== Remaining 'codebuff' in active source dirs ===
common/src/constants/analytics-events.ts: UPDATE_SAVANT_CODE_FAILED = 'cli.update_codebuff_failed'
common/src/util/xml.ts: return toolNames.map((toolName) => `</codebuff_tool_${toolName}>`)
packages/agent-runtime/src/tools/tool-executor.ts: // Add the required codebuff_end_step parameter...

=== Remaining 'CODEBUFF' env vars in active source ===
78 references across cli/src, common/src, packages/agent-runtime/src, sdk/src

=== Remaining 'freebuff' in active source (excluding allowed terms) ===
23 references (mostly FREEBUFF_MODE env var and related constants)
```

## Impact Assessment

### Affected Components

- `common/src/util/xml.ts`
- `common/src/constants/analytics-events.ts`
- `cli/src/types/env.ts`
- `cli/src/utils/env.ts`
- All consumers of `CODEBUFF_*` env vars in `cli/src/`
- Tests that reference the old env vars or analytics strings

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Internal-only identifiers; no user-facing breakage if env vars are updated in build scripts and developer docs
- [ ] Low

## Proposed Solution

### Approach

1. Rename `codebuff_tool_${toolName}` stop sequences to `savant_code_tool_${toolName}` in `common/src/util/xml.ts`.
2. Rename analytics string `cli.update_codebuff_failed` → `cli.update_savant_code_failed`.
3. Rename all `CODEBUFF_*` env vars to `SAVANT_CODE_*` in type definitions, env helpers, and consumers.
4. Update the comment in `tool-executor.ts` to reference `cb_easp` / `endsAgentStepParam`.
5. Update tests and documentation that reference the old identifiers.

### Exact Rename Mapping

| Old Identifier | New Identifier | Files Affected | Risk |
|---|---|---|---|
| `</codebuff_tool_${toolName}>` | `</savant_code_tool_${toolName}>` | `common/src/util/xml.ts` | Low — internal stop sequences |
| `cli.update_codebuff_failed` | `cli.update_savant_code_failed` | `common/src/constants/analytics-events.ts` + 1 consumer | Low — analytics string |
| `CODEBUFF_CLI_EDITOR` | `SAVANT_CODE_CLI_EDITOR` | `cli/src/types/env.ts`, `cli/src/utils/env.ts`, consumers | Medium — breaks `.env` files |
| `CODEBUFF_EDITOR` | `SAVANT_CODE_EDITOR` | same | Medium — breaks `.env` files |
| `CODEBUFF_CLI_VERSION` | `SAVANT_CODE_CLI_VERSION` | same + build scripts | Medium — breaks build scripts |
| `CODEBUFF_CLI_TARGET` | `SAVANT_CODE_CLI_TARGET` | same + build scripts | Medium — breaks build scripts |
| `CODEBUFF_RG_PATH` | `SAVANT_CODE_RG_PATH` | same + ripgrep consumers | Low |
| `CODEBUFF_SCROLL_MULTIPLIER` | `SAVANT_CODE_SCROLL_MULTIPLIER` | same + scroll consumers | Low |
| `CODEBUFF_PERF_TEST` | `SAVANT_CODE_PERF_TEST` | same + perf consumers | Low |
| `CODEBUFF_TRACE` | `SAVANT_CODE_TRACE` | same + trace consumers | Low |
| `CODEBUFF_SHIP_LOGS` | `SAVANT_CODE_SHIP_LOGS` | same + log-shipper | Low |
| `codebuff_end_step` (comment) | `cb_easp` / `endsAgentStepParam` | `packages/agent-runtime/src/tools/tool-executor.ts` | None |

### Backward-Compat Aliases

**No aliases.** The operator explicitly rejected the "external contract" argument. All identifiers are internal-only: env vars are read from `process.env` at CLI startup, analytics strings are emitted from the CLI to PostHog/Axiom, and XML stop sequences are generated and consumed by the same runtime.

### Steps

1. Apply the exact rename mapping across source files.
2. Update test fixtures and expectations.
3. Update build scripts and documentation that reference old env vars.
4. Run x4 typecheck gate.
5. Run relevant test suites.
6. Update docs/session summaries/CHANGELOG.

### Verification

- `grep -rn "codebuff" common/src packages/agent-runtime/src cli/src sdk/src --include="*.ts" --include="*.tsx"` returns only already-renamed `savant_code` matches and historical comments.
- x4 typecheck gate passes (sdk, common, agent-runtime, cli).
- Relevant tests pass.

## Perfection Loop

### Loop 1

- **RED:** See Evidence above.
- **GREEN:** Exact rename mapping and no-backward-compat decision documented above.
- **AUDIT:**
  - Independent verification that all listed `codebuff` identifiers are internal-only and safe to rename.
  - Confirmed `toolXmlName` is already `savant_code_tool_call`; stop sequences in `xml.ts` are the only remaining inconsistency.
  - Confirmed `codebuff-client.ts` was already removed (Nova blocker from FID-026).
  - Confirmed `FREEBUFF_MODE` and related `freebuff` strings are out of scope for this FID.
  - No external contracts (LLM wire protocol, ad network surface IDs, analytics dashboards) are affected by the remaining 3 `codebuff` strings and 78 env var references.
  - Risk accepted: build scripts and developer `.env` files must be updated in the same commit.
- **CHANGE DELTA:** ~80 source references across ~15 files; low character count.

## Resolution

- **Fixed By:** Savant Orchestrator
- **Fixed Date:** 2026-07-19
- **Fix Description:** Renamed remaining `codebuff`-branded identifiers to `savant_code`/`SAVANT_CODE` across source files, tests, and build scripts.
- **Tests Added:** No new tests; existing tests updated
- **Verified By:** x4 typecheck gate + code-reviewer-kimi
- **Commit/PR:** TBD
- **Archived:** 2026-07-19

## Lessons Learned

TBD
