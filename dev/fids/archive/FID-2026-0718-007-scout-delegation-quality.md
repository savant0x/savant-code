# FID-2026-0718-007 — high — Scout Delegation Quality + MCP Proxy Timeout

**Filename:** `FID-2026-0718-007-scout-delegation-quality.md`
**ID:** FID-2026-0718-007
**Severity:** high
**Status:** closed
**Created:** 2026-07-18
**Author:** Historical record (metadata backfill)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0718-007-scout-delegation-quality`. Canonical ID: `FID-2026-0718-007`. Backfilled fields: Filename, ID, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## Summary

Two related issues in the agent runtime:

1. **Scout file-finding regression**: FID-2026-0718-006 deleted `file-lister` / `file-lister-max` and rewired Scout to delegate to Detective. But Detective uses `code_search` (ripgrep on file contents) while the old file-lister used `read_subtree` (explore directory structure by file names/paths). Scout's file-finding capability has regressed.

2. **MCP proxy has no timeouts**: `getMCPClient()` wraps `client.connect()` with no timeout. `callMCPTool()` wraps `client.callTool()` with no timeout. If a remote MCP server hangs during connection or a tool call takes forever, the agent blocks indefinitely. The MCP config schema has no `timeout` field.

---

## RED Phase — Issue Catalog

### Part A: Scout Delegation Quality

#### Issue R1: Scout passes raw prompt as ripgrep pattern

**Evidence:**
- `agents/scout/scout.ts` handleStepsDefault: `pattern: prompt ?? ''`
- If user says "Find auth files", the Detective receives `code_search` with pattern `"Find auth files"` — ripgrep searches file CONTENTS for that literal string
- The old file-lister used `read_subtree` which explored the file tree and returned paths matching the query semantically
- Result: Scout returns zero results or irrelevant results for most file-finding requests

**Impact:** Every Orchestrator that spawns Scout for context gathering gets poor or empty results.

#### Issue R2: Detective's STEP yield uses wrong instructions for file-finding

**Evidence:**
- Detective's LLM instructions say "Discover issues with evidence" — issue-cataloging oriented, not file-finding
- Even with STEP yield, the LLM may not produce the right file-finding output format

#### Issue R3: Scout's error message references deleted "file-lister"

**Evidence:**
- `agents/scout/scout.ts`: `'Error from file-lister(s): ${errorMessages}'` — stale reference

### Part B: MCP Proxy Timeout

#### Issue R4: No timeout on MCP client connection

**Evidence:**
- `common/src/mcp/client.ts` line 150: `await client.connect(transport)` — no timeout wrapper
- If a remote MCP server (http/sse) hangs during the connection handshake, the agent blocks indefinitely
- Stdio servers that hang during startup (e.g., missing dependency causes infinite retry) also block

**Impact:** A single unreachable MCP server can freeze the entire agent step. No user-configurable timeout exists.

#### Issue R5: No timeout on MCP tool calls

**Evidence:**
- `common/src/mcp/client.ts` line 186: `const callResult = await client.callTool(...args)` — no timeout wrapper
- If an MCP tool hangs (e.g., a database query that never returns, a browser automation that gets stuck), the agent blocks indefinitely

**Impact:** A single slow/hanging MCP tool call freezes the agent. No recovery mechanism exists.

#### Issue R6: No timeout field in MCP config schema

**Evidence:**
- `common/src/types/mcp.ts`: `mcpConfigStdioSchema` and `mcpConfigRemoteSchema` have no `timeout` field
- Users cannot configure per-server timeouts

**Impact:** All MCP servers share the same (nonexistent) timeout behavior — they all block indefinitely.

#### Issue R7: Disabled proxy blocks `Promise.all` indefinitely

**Evidence:**
- `packages/agent-runtime/src/mcp.ts` line 53: `await Promise.all(promises)` iterates all MCP servers
- If one server hangs (not crashes), the entire `Promise.all` blocks, preventing ALL MCP servers from completing
- The try/catch only handles thrown errors, not hung promises

**Impact:** One unreachable MCP server blocks tool discovery for ALL other MCP servers.

#### Issue R8: Orphaned child process on stdio transport timeout

**Evidence:**
- `StdioClientTransport` spawns a child process; if `client.connect()` times out, the child process is never cleaned up
- The transport object has a `close()` method that should be called to kill the child process
- Without cleanup, timed-out stdio servers leave zombie processes

**Impact:** Resource leak — orphaned child processes accumulate over time.

#### Issue R9: Race condition on late-resolving connect

**Evidence:**
- If `withTimeout()` rejects after the timeout, but `client.connect(transport)` resolves later (after the timeout), the client is connected but never cached in `runningClients`
- The client holds a connection/socket that's never cleaned up

**Impact:** Resource leak — connected but uncached clients hold system resources.

#### Issue R10: No maximum timeout cap

**Evidence:**
- No upper bound on the timeout value. User could set `timeout: 999999999`

**Impact:** Absurdly large timeout values hold system resources indefinitely, defeating the purpose of the timeout mechanism.

#### Issue R11: `listMCPTools()` could hang on connected clients

**Evidence:**
- A successful connection handshake does not guarantee the server won't hang when computing its tool list
- `listMCPTools()` calls `client.listTools()` with no timeout
- If it hangs, `getMCPToolData()`'s `Promise.all` blocks forever

**Impact:** A server that connects but hangs on tool enumeration blocks all MCP tool discovery.

---

## GREEN Phase — Proposed Fix

### Part A: Scout Delegation Quality

**Changes to `agents/scout/scout.ts`:**

1. **Strip Detective from spawnableAgents** — Scout should not delegate file-finding to a code-search agent
2. **Add `glob` + `list_directory` to toolNames** — right tools for file-finding
3. **Add `extractKeywords()` helper** — stop words, punctuation stripping, dedup, fallback
4. **Rewrite handleStepsDefault** — programmatic `glob` with `**/*keyword*` patterns → STEP yield → set_output
5. **Rewrite handleStepsMax** — same pattern, LLM explores more deeply during STEP
6. **Fix error message** — remove stale "file-lister" reference

### Part B: MCP Proxy Timeout

**Changes to `common/src/types/mcp.ts`:**
- Add optional `timeout: z.number().positive().optional()` to both `mcpConfigStdioSchema` and `mcpConfigRemoteSchema`

**Changes to `common/src/mcp/client.ts`:**
- Add `withTimeout<T>(promise, ms, errorMessage)` helper using `Promise.race` + `setTimeout` with `.finally(() => clearTimeout(timer))`
- Add `clientTimeouts: Record<string, number>` map to track per-client tool call timeouts
- Add `MAX_TIMEOUT_MS = 300_000` (5-minute hard cap) — clamp user-configured timeout to this ceiling
- Wrap `client.connect(transport)` with `withTimeout(promise, effectiveConnectTimeout, ...)`
- **Transport cleanup on timeout**: In the catch block, call `transport.close()` to kill orphaned stdio child processes and close network sockets (Issue R8 fix)
- **Race condition fix**: `transport.close()` severs the connection underneath the Client — even if `connect()` resolves late, the transport is dead and the client is safely GC'd (Issue R9 fix)
- Wrap `client.callTool(...args)` with `withTimeout(promise, clientTimeouts[clientId] ?? DEFAULT_TOOL_TIMEOUT_MS, ...)`
- Store timeout config in `clientTimeouts[key]` on successful connect
- Wrap `client.listTools()` in `listMCPTools()` with `withTimeout(promise, clientTimeouts[clientId] ?? DEFAULT_TOOL_TIMEOUT_MS, ...)` (Issue R11 fix)

**No changes needed to `packages/agent-runtime/src/mcp.ts`:**
- The existing try/catch in `getMCPToolData()` already handles thrown errors from MCP servers
- `withTimeout()` throws a standard `Error` on timeout, which the existing catch block handles gracefully — logs warning, continues with other servers

### Default Timeout Values

| Operation | Default | Hard Max | Rationale |
|-----------|---------|----------|-----------|
| Connection (`client.connect`) | 30s | 300s | Remote servers should respond within seconds; 30s is generous |
| Tool call (`client.callTool`) | 60s | 300s | Tool calls may involve heavy computation (DB queries, browser automation) |
| Tool listing (`client.listTools`) | 60s | 300s | A connected server may still hang on tool enumeration |

All configurable per-server via the `timeout` field in MCP config. User value is clamped to `MAX_TIMEOUT_MS`.

---

## Questions Answered — Perfection Loop

### Q1–Q5: Scout basics

**Q1: What glob patterns should `extractKeywords()` generate?**
→ `**/*keyword*` for each keyword. Matches any file whose name contains the keyword anywhere.

**Q2: How should Scout handle multi-word prompts like "find auth service files"?**
→ Split into keywords, strip stop words (`find`, `files`), deduplicate, glob for each (`auth`, `service`). Results unioned. STEP yield lets LLM filter/rank.

**Q3: What if glob returns zero results?**
→ Still yield STEP — LLM sees empty results and can try alternatives (list_directory, code_search). If LLM also gets nothing, set_output reports "no files found".

**Q4: What's the max depth for list_directory during STEP?**
→ Not constrained programmatically. LLM controls depth. `MAX_AGENT_DEPTH = 5` prevents runaway spawning.

**Q5: Should Scout's model change?**
→ No. Same model as before. Not scope of this FID.

### Q6–Q10: Scout robustness

**Q6: Both code paths (default + max) fixed?**
→ Yes. Both rewritten with same programmatic glob + STEP yield pattern.

**Q7: Is `extractKeywords()` robust enough?**
→ Yes. The regex `/[^a-z0-9\s\-_.\/]/g` strips ALL non-alphanumeric characters except hyphen, underscore, dot, and slash — this includes glob metacharacters (`[`, `]`, `*`, `?`) and regex special characters. Stop words, dedup, single-char filter, fallback all verified.

**Q8: What's the threshold for "unproductive" file-finding?**
→ LLM-driven judgment. If set_output message indicates no files found, that's the signal.

**Q9: Should the mock spy assertion verify the glob pattern?**
→ Yes. Assert `tool: 'glob'` AND `pattern: '**/*authentication*'`.

**Q10: Scout has TWO code paths — are both being fixed?**
→ Yes (same as Q6).

### Q11–Q17: MCP proxy design

**Q11: What timeout mechanism? `AbortSignal.timeout()` vs `Promise.race`?**
→ `Promise.race` with `setTimeout`/`clearTimeout`. The MCP SDK's `client.connect()` and `client.callTool()` may not fully support `AbortSignal` cancellation for all transports (stdio, http, sse). `Promise.race` guarantees the agent runtime unblocks immediately regardless of transport.

**Q12: Where to apply timeout — transport level or wrapper level?**
→ Wrapper level: wrap `client.connect()` and `client.callTool()` directly. No need to hack the low-level Transport classes.

**Q13: Should timed-out clients be removed from `runningClients`?**
→ **Connect timeout**: Yes — if connect times out, the client is never added to `runningClients` (it throws before the assignment). Natural cleanup.
→ **Tool call timeout**: No — a single slow tool call doesn't mean the connection is dead. Subsequent calls may succeed. Keep the client cached.

**Q14: Should `hashConfig` include the timeout value?**
→ No. The hash identifies the server (command/url/env). Two configs with different timeouts but same server should share the same client. The timeout is per-operation, not per-server identity. Store timeout in separate `clientTimeouts` map.

**Q15: What happens to `listToolsCache` on timeout?**
→ `listToolsCache` caches the tool list promise per client. It's populated on first `listMCPTools()` call. If the client connected successfully (no timeout), the tool list should also succeed. If `listTools()` itself hangs, the new `withTimeout` wrapper in `listMCPTools()` handles it (Issue R11). No change needed to `listToolsCache` behavior beyond the timeout wrapper.

**Q16: Should we add a timeout to `listMCPTools()` too?**
→ **Yes** (revised after THINKER round 2). A successful connection handshake does not guarantee the server won't hang when computing its tool list. Without a timeout, a hanging `listTools` call blocks `getMCPToolData()`'s `Promise.all` forever. Add `withTimeout(client.listTools(...), clientTimeouts[clientId] ?? DEFAULT_TOOL_TIMEOUT_MS, ...)` in `listMCPTools()`.

**Q17: Should `Promise.all` in `getMCPToolData()` have a per-server timeout?**
→ No additional change needed beyond the `withTimeout` on `connect()`, `listTools()`, and `callTool()`. The `requestMcpToolData()` call chain goes through `getMCPClient()` (connect timeout) and `listMCPTools()` (listTools timeout). Both are now guarded. The existing try/catch in `getMCPToolData()` handles the thrown timeout errors.

### Q18–Q22: THINKER round 2 edge cases

**Q18: Regex special characters in extractKeywords() — `[`, `]`, `*`, `?`?**
→ Already handled. The regex `/[^a-z0-9\s\-_.\/]/g` strips all non-whitelisted characters. `[` becomes empty, `*` becomes empty, etc. Safe for glob patterns. (Issue R8→R18 mapping: Issue A)

**Q19: Orphaned child process on stdio transport timeout?**
→ Call `transport.close()` in the catch block of `getMCPClient()`. This terminates the child process for stdio transports and closes network sockets for http/sse. Prevents resource leaks. (Issue R8)

**Q20: Race condition — connect resolves after timeout?**
→ Solved by Q19. `transport.close()` severs the connection underneath the Client. Even if `connect()` resolves late, the transport is dead and the client is safely GC'd. No resource leak. (Issue R9)

**Q21: Maximum timeout cap?**
→ Yes — enforce `MAX_TIMEOUT_MS = 300_000` (5 minutes). Clamp user-configured `timeout` to this ceiling. Prevents `timeout: 999999999` from holding system resources indefinitely. (Issue R10)

**Q22: `listMCPTools()` could hang on connected clients?**
→ Yes — add `withTimeout()` to `listMCPTools()` as well. A connected server may hang on tool enumeration. Default 60s, same as tool call timeout. This revises Q16. (Issue R11)

---

## Convergence Check

| Round | New Issues Found | Resolved |
|-------|-----------------|----------|
| 1 (Scout only) | Q1–Q10 | ✅ All answered |
| 2 (MCP proxy) | Q11–Q17 | ✅ All answered |
| 3 (THINKER critique) | Q18–Q22, Issues R8–R11 | ✅ All answered, Q16 revised |
| 4 (final check) | 0 | ✅ Converged |

All THINKER findings integrated. No new issues identified. Ready for approval.

---

## Missed Questions Log

| # | Question | Answer | Phase |
|---|----------|--------|-------|
| Q1 | What glob patterns? | `**/*keyword*` | GREEN |
| Q2 | Multi-word prompts? | Split → strip stop words → dedup → glob each | GREEN |
| Q3 | Zero glob results? | Still yield STEP — LLM tries alternatives | GREEN |
| Q4 | Max depth list_directory? | Not constrained — LLM controls | GREEN |
| Q5 | Scout model change? | No — not scope | GREEN |
| Q6 | Both code paths fixed? | Yes | GREEN |
| Q7 | extractKeywords robust? | Yes — regex strips glob metacharacters | GREEN |
| Q8 | Unproductive threshold? | LLM-driven judgment | GREEN |
| Q9 | Mock spy assertion? | Verify tool='glob' AND pattern | GREEN |
| Q10 | Both code paths? (dup of Q6) | Yes | GREEN |
| Q11 | Timeout mechanism? | Promise.race + setTimeout (not AbortSignal) | GREEN |
| Q12 | Where to apply timeout? | Wrapper level on connect/callTool | GREEN |
| Q13 | Remove timed-out clients? | Connect: yes (natural); Tool: no (keep cached) | GREEN |
| Q14 | hashConfig include timeout? | No — separate clientTimeouts map | GREEN |
| Q15 | listToolsCache on timeout? | withTimeout on listTools handles it | GREEN |
| Q16 | Timeout on listMCPTools? | **Yes** — add withTimeout (revised R3) | GREEN→R3 |
| Q17 | Promise.all per-server timeout? | No additional — three withTimeout wrappers suffice | GREEN |
| Q18 | Regex special chars in glob? | Already stripped by regex | R3 |
| Q19 | Orphaned child process? | transport.close() in catch block | R3 |
| Q20 | Race condition late resolve? | transport.close() severs connection | R3 |
| Q21 | Max timeout cap? | MAX_TIMEOUT_MS = 300_000 (5 min) | R3 |
| Q22 | listMCPTools hang? | withTimeout wrapper (revises Q16) | R3 |
