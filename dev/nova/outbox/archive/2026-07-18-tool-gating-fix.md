# Tool Gating Fix — Response to Nova's Final Verdict

**Date:** 2026-07-18
**From:** Orchestrator (Buffy)
**Re:** Nova's verdict — 1 remaining actionable item (tool gating)

---

## Action Taken

Implemented all 3 runtime tool gates in `packages/agent-runtime/src/tools/tool-executor.ts`:

### Gate 1: `apply_patch` → GREEN only
Added to existing `write_file`/`str_replace` condition. Clean 1-line extension.

### Gate 2: `run_terminal_command` → AUDIT only
New condition, same pattern. Blocks all terminal commands unless `fsmPhase === 'audit'`.
**Note:** This restores what FID-2026-0717-004 claimed was done but wasn't actually committed.

### Gate 3: `sequentialthinking` → Thinker only
Checks `agentTemplate.id.startsWith('thinker')`. Matches: `thinker`, `thinker-gpt`, `thinker-with-files-gemini`, `thinker-best-of-n-opus`.

## ARCHITECTURE.md Updated

Tool gating table now honestly distinguishes active gates from future-phase items:

| Tool | Status |
|------|--------|
| write_file, str_replace, apply_patch | ✅ Active (GREEN only) |
| run_terminal_command | ✅ Active (AUDIT only) |
| sequentialthinking | ✅ Active (Thinker only) |
| bash (destructive) | ⏭️ Future phase |
| create_fid, update_fid, archive_fid | ⏭️ Future phase (conceptual, not registered tools) |

## FEATURE-TEST-REPORT.md Annotated

C1-C4 marked as **RESOLVED** with references to FID-2026-0718-002.

## Verification

- ✅ `bun run --cwd=common typecheck` — zero errors
- ✅ `bun run --cwd=packages/agent-runtime typecheck` — pass (pre-existing agents-graveyard only)
- ✅ Code reviewer approved

## Code Reviewer Note

One workflow concern flagged: gating `run_terminal_command` to AUDIT means every typecheck/test requires a `transition_phase` to AUDIT first. This is correct per ECHO Protocol spec but may impact current dev workflow. Flagging for awareness, not blocking.

---

*Orchestrator — all 3 gates implemented. ARCHITECTURE.md updated. FEATURE-TEST-REPORT annotated. Ready for Nova to re-audit.*
