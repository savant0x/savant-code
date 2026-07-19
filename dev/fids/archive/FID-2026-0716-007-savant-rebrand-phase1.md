# FID: Phase 1 — Savant Rebrand + ECHO Protocol Injection

**Filename:** `FID-2026-0716-007-savant-rebrand-phase1.md`
**ID:** FID-2026-0716-007
**Severity:** high
**Status:** closed
**Created:** 2026-07-16
**Author:** recursive (human + AI pair)

---

## Summary

Replace the "Buffy" agent persona with "Savant" across the entire SavantCode/SavantFree codebase and inject the ECHO Protocol v0.1.2 as the default agent instructions in the `instructionsPrompt` of `createBase2()`. Two files (`base2.ts`, `base-deep.ts`) are currently in a corrupted/minified state from an earlier PowerShell mishap and need restoration from the upstream repo before the planned edits can be cleanly applied.

## Environment

- **OS:** Windows
- **Language/Runtime:** TypeScript, Bun
- **Tool Versions:** Bun runtime, PowerShell 7
- **Commit/State:** Not a git repo (no backup available)

## Detailed Description

### Problem

1. `agents/base2/base2.ts` — 49 lines (expected ~578), all template literals and object bodies are minified onto a few lines. Code is syntactically invalid (missing newlines between import statements).
2. `agents/base2/base-deep.ts` — 1 line (expected ~343), completely concatenated. Also syntactically invalid.
3. Both files had the intended Savant+ECHO edits already applied (displayName, systemPrompt, ECHO_PROTOCOL_INSTRUCTIONS constant appended to `buildImplementationInstructionsPrompt`), but the formatting is corrupted.
4. `cli/src/agents/bundled-agents.generated.ts` has 44 remaining "Buffy" references (auto-generated file, expected — needs regeneration from source).

### Expected Behavior

All agent files should be properly formatted TypeScript with:
- `displayName` using "Savant" instead of "Buffy"
- `systemPrompt` declaring "You are Savant, an engineering agent bound by the ECHO Protocol..."
- `instructionsPrompt` appending ECHO_PROTOCOL_INSTRUCTIONS (15 Laws, Perfection Loop, FID Lifecycle, Five Questions, Circuit Breaker Rules, Anti-Patterns)

### Root Cause

PowerShell `Set-Content -NoNewline` was used instead of `Set-Content` when doing a bulk find-and-replace across agent files. `-NoNewline` concatenated all array elements (lines) without separators, collapsing the multi-line TypeScript files into single-line strings.

### Evidence

```
agents/base2/base2.ts: 49 lines (expected ~578)
agents/base2/base-deep.ts: 1 lines (expected ~343)
```

## Impact Assessment

### Affected Components

- `agents/base2/base2.ts` — primary agent factory, used by all 20+ agent variants
- `agents/base2/base-deep.ts` — GPT-5 orchestrator variant
- `cli/src/agents/bundled-agents.generated.ts` — auto-generated, needs regen

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

1. Fetch pristine copies of `base2.ts` and `base-deep.ts` from upstream GitHub repo (`https://github.com/savant0x/savant-code`).
2. Apply the 3 planned edits to `base2.ts`:
   - `displayName: 'Savant the Orchestrator'`
   - `systemPrompt: \`You are Savant, an engineering agent bound by the ECHO Protocol...`
   - Add `ECHO_PROTOCOL_INSTRUCTIONS` constant + append to `buildImplementationInstructionsPrompt`
3. Apply the 2 planned edits to `base-deep.ts`:
   - `displayName: 'Savant the GPT Orchestrator'`
   - `systemPrompt: \`You are Savant, an engineering agent bound by the ECHO Protocol...`
4. Regenerate `bundled-agents.generated.ts` from source.
5. Run typecheck + tests to verify.

### Steps

1. Fetch raw `base2.ts` and `base-deep.ts` from `https://raw.githubusercontent.com/savant0x/savant-code/main/agents/base2/`
2. Write each file to disk (preserving proper line endings)
3. Apply edits using the `edit` tool (which reads first, then does precision string replacement)
4. Run `bun run typecheck` — fix any issues
5. Regenerate bundled agents (find the build command)
6. Run tests — fix any issues
7. Update `protocol.config.yaml` if needed (language: typescript already set)

### Verification

- `bun run typecheck` passes with zero errors
- All test suites pass
- `bundled-agents.generated.ts` has zero "Buffy" references, contains "Savant"

## Perfection Loop

### Loop 1

- **RED:** Two core files corrupted, 44 stale Buffy refs in generated file, edits partially applied in damaged files
- **GREEN:** All work completed in FID-2026-0716-007 (echo-foundation). Files restored from upstream, ECHO identity injected, display names updated, bundled-agents regenerated.
- **AUDIT:** Typecheck passes (agents ✅, common ✅, agent-runtime ✅). Zero stale agent IDs.
- **COMPLETE:** 2026-07-16

## Resolution

- **Fixed By:** FID-2026-0716-007 (echo-foundation-phase1) — all work absorbed into the larger ECHO foundation FID
- **Fixed Date:** 2026-07-16
- **Fix Description:** Corrupted base2.ts and base-deep.ts restored from upstream GitHub. ECHO identity injected into all agents. Display names updated to Savant. File renames completed (editor→forge, code-reviewer→verifier, file-picker→scout). Spawn references updated. bundled-agents.generated.ts regenerated.
- **Tests Added:** Typecheck passes. No new test files required (rename + identity changes).
- **Verified By:** `bun x tsc --noEmit` across agents, common, agent-runtime packages
- **Commit/PR:** N/A (not a git repo)
- **Archived:** 2026-07-16

## Lessons Learned

- Never use `Set-Content -NoNewline` in PowerShell when writing multi-line files from an array.
- Always read a file with the `read` tool before editing — never use bulk shell find-and-replace on TypeScript source files.
- Before bulk operations, test the command on a single file first.
