# Nova Outbox — FID-2026-0718-007 Complete

**Date:** 2026-07-18
**FID:** FID-2026-0718-007 — Scout Delegation Quality + MCP Proxy Timeout
**Status:** ✅ COMPLETE — archived

---

## Summary

Two fixes implemented, both verified by typecheck (zero errors) and code review (approved).

### Fix 1: Scout Delegation Quality

**Problem:** Scout was delegating file-finding to Detective (a code_search/ripgrep agent), which searched file *contents* instead of file *names*. Zero or irrelevant results for most file-finding requests.

**Solution:** Rewrote Scout to use `glob` and `list_directory` directly:
- Added `extractKeywords()` helper — strips stop words, punctuation, deduplicates
- Programmatic `glob` with `**/*keyword*` patterns for each extracted keyword
- STEP yield lets the LLM interpret results and explore deeper
- Removed Detective from spawnableAgents entirely
- Added `glob`, `list_directory`, `read_files`, `read_subtree`, `set_output` to toolNames

**Files changed:** `agents/scout/scout.ts`

### Fix 2: MCP Proxy Timeout

**Problem:** No timeout on `client.connect()`, `client.callTool()`, or `client.listTools()`. A hanging MCP server blocked the agent indefinitely. One unreachable server blocked `Promise.all` for ALL servers.

**Solution:**
- Added `withTimeout()` helper (Promise.race + setTimeout + .finally cleanup)
- Wrapped connect (30s default), callTool (60s default), listTools (60s default)
- Added `transport.close()` in catch block — prevents orphaned child processes
- Added `MAX_TIMEOUT_MS = 300_000` hard cap (5 minutes)
- Added optional `timeout` field to MCP config schema
- `listToolsCache` clears on rejection to allow retries

**Files changed:** `common/src/types/mcp.ts`, `common/src/mcp/client.ts`

---

## Perfection Loop

4 rounds, 22 questions answered, converged.

| Round | Focus | Questions |
|-------|-------|-----------|
| 1 | Scout basics | Q1–Q10 |
| 2 | MCP proxy design | Q11–Q17 |
| 3 | THINKER edge cases | Q18–Q22 (orphaned processes, race conditions, max cap, listTools hang) |
| 4 | Final check | 0 new — converged |

---

## Verification

- **Typecheck:** common/ ✅ zero errors, agents/ ✅ zero errors
- **Code review:** approved after 2 corrections (ToolCall type mismatch → toolName, listToolsCache rejection → .catch cleanup)
