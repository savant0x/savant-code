# FID: Create Detective Agent (RED Phase)

**Filename:** `FID-2026-0717-006-detective-agent.md`
**ID:** FID-2026-0717-006
**Severity:** critical
**Status:** closed
**Created:** 2026-07-17 18:00

---

## Summary

The Detective agent (RED phase) is defined in ARCHITECTURE.md and ECHO.md but doesn't exist in the codebase. The Perfection Loop RED phase requires an agent that discovers issues with evidence — file paths, line numbers, grep output, call-graph reachability. Currently, `code-searcher` does some of this but isn't wired as a Perfection Loop agent.

## Evidence

- ARCHITECTURE.md:22 — Detective listed with tools `code_search, set_output`
- ECHO.md:56 — Detective listed with tools `write_file, str_replace, bash` (conflicts with ARCHITECTURE)
- `agents/file-explorer/code-searcher.ts:50` — has `['code_search', 'set_output']` — matches ARCHITECTURE spec
- No `detective.ts` or `detective/` directory exists

## Proposed Solution

**Quick win:** The `code-searcher` agent already has the right tools (`code_search, set_output`). Two options:

**Option 1 (Recommended):** Create `agents/detective/detective.ts` that reuses `code-searcher` logic but with ECHO RED-phase identity and instructions. Update Orchestrator's spawnableAgents to include `detective`.

**Option 2:** Alias `code-searcher` as `detective` in the agent registry. Simpler but less clean.

### Steps

1. Create `agents/detective/detective.ts` — agent definition with ECHO identity, RED-phase instructions
2. Tools: `['code_search', 'set_output']` (matches ARCHITECTURE)
3. Model: `anthropic/claude-sonnet-4.6` (same as Recorder/Scribe — analysis doesn't need Opus)
4. Instructions: Focus on issue discovery, evidence cataloging, call-graph reachability
5. Add `detective` to Orchestrator's `spawnableAgents` in `base2.ts`
6. Update `ARCHITECTURE.md` to remove the tool conflict (Detective should NOT have write_file/str_replace per SoD)

### Verification

- Grep `detective` in agents/ — file exists
- Grep `detective` in base2.ts spawnableAgents — present
- Typecheck passes

### Missed Questions

1. **Should Detective have ECHO_PROTOCOL_INSTRUCTIONS?** — Yes. All 9 roster agents should have ECHO identity injected.
2. **What model?** — Sonnet 4.6. Analysis (grep, read, code_search) doesn't need Opus. Cost-efficient.
3. **Can Detective spawn agents?** — No. RED phase is read-only discovery. Tool set: `['code_search', 'set_output']`.
4. **Does this conflict with existing code-searcher?** — No. code-searcher stays for general file exploration. Detective is Perfection Loop RED phase only.
5. **Should Detective have `read_files` or `list_directory`?** — No. `code_search` handles file discovery. Adding read tools would bloat the tool set and violate SoD (RED should be minimal).
6. **What about the ECHO.md vs ARCHITECTURE.md tool conflict?** — ECHO.md says Detective has `write_file, str_replace, bash`. ARCHITECTURE.md says `code_search, set_output`. ARCHITECTURE is the design doc. Follow ARCHITECTURE. ECHO.md's Detective tool list is stale from v0.1 thinking.
7. **Should Detective be its own directory or a file?** — File. Single agent definition, no variants needed.
8. **What instructions should Detective have?** — "You are the Detective, RED phase agent. Discover issues with evidence: file paths, line numbers, grep output, call-graph reachability. Catalog all failures. Do not implement fixes — that's Forge's role."

### AUDIT Phase

| # | Check | Method |
|---|-------|--------|
| 1 | code-searcher already has correct tools | `agents/file-explorer/code-searcher.ts:50` — `['code_search', 'set_output']` ✓ |
| 2 | ECHO identity pattern exists | All roster agents import `ECHO_PROTOCOL_INSTRUCTIONS` from `@codebuff/common/constants/agents` |
| 3 | Orchestrator spawnableAgents in base2.ts | Line 120-140 — needs `detective` added |
| 4 | Sonnet model available | `anthropic/claude-sonnet-4.6` used by Recorder, Scribe — confirmed available |
| 5 | No circular spawn risk | Detective has no `spawnableAgents` — can't spawn children |

### SELF-CORRECT Phase

**Finding:** Option 2 (alias) is simpler but doesn't give Detective its own ECHO instructions or display name. Option 1 (new file) is cleaner.

**Correction:** Go with Option 1. Create `agents/detective/detective.ts` as a standalone agent definition.

**Finding:** ECHO.md's Detective tool list (`write_file, str_replace, bash`) conflicts with ARCHITECTURE.md (`code_search, set_output`). Which is correct?

**Correction:** ARCHITECTURE.md is the design doc. Detective should be read-only per SoD. ECHO.md needs updating — but that's a separate concern (FID-006 doesn't modify ECHO.md).

### COMPLETE Phase

FID converged. Fix is straightforward: create one file, update one spawnableAgents list.

## Resolution

- **Fixed By:** Pending
- **Archived:** Pending
