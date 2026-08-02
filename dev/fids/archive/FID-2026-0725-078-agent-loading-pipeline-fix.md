# FID: Agent Loading Pipeline Fix — Detective/Scout Spawn Failure

**Filename:** `FID-2026-0725-078-agent-loading-pipeline-fix.md`
**ID:** FID-2026-0725-078
**Severity:** critical
**Status:** closed
**Created:** 2026-07-25 15:00
**Author:** Savant (Orchestrator)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed`; Original ID: `FID-2026-07-25-078`. Canonical ID: `FID-2026-0725-078`. Backfilled fields: Filename, ID, Severity, Status, Created, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.

filename: FID-2026-0725-078-agent-loading-pipeline-fix.md
ID: FID-2026-07-25-078
Severity: critical
Status: closed
Created: 2026-07-25 15:00
Author: Savant (Orchestrator)
---

# FID: Agent Loading Pipeline Fix — Detective/Scout Spawn Failure

## Summary

The `cli/src/agents/bundled-agents.generated.ts` file is gitignored and only generated at build time by `prebuild:agents`. When this file is missing or incomplete (e.g., in dev mode, or when an agent's import fails silently during prebuild), `getBundledAgents()` returns an empty or partial object, meaning built-in agents like detective and scout are not loaded into `localAgentTemplates`. In direct-provider mode (no database), this causes `spawn_agents` to fail with "Agent does not exist." The fix adds a runtime fallback that loads agents directly from the `agents/` directory when the generated file is missing or missing critical agents.

## Environment

- **OS:** win32
- **Language/Runtime:** TypeScript (strict mode), Bun 1.3.11
- **Tool Versions:** GLM 5.2 Free via TokenRouter
- **Commit/State:** v0.0.6, main branch, dev mode (bun run dev)

## Detailed Description

### Problem

When the CLI runs in dev mode, the `prebuild:agents` script generates `cli/src/agents/bundled-agents.generated.ts` by scanning the `agents/` directory and embedding all agent definitions as static JSON. However, this file is gitignored and may not exist when the repo is freshly cloned, when new agents are added, or when `git clean` removes it.

The loading chain breaks as follows:
```
CLI loadAgentDefinitions() → getBundledAgents() → bundledAgentsModule.bundledAgents → {} (empty)
→ No agentDefinitions passed to SDK initialSessionState()
→ SDK falls back to loadLocalAgents() which scans .agents/ (user agents only)
→ Built-in agents (detective, scout, etc.) NOT in .agents/ — they're in agents/
→ fileContext.agentTemplates is empty
→ localAgentTemplates is empty in agent-registry.ts
→ getAgentTemplate() returns null for detective/scout
→ spawn_agents rejects: "Agent does not exist"
```

Agents that DO work (thinker, researcher-web, forge, etc.) succeed because they're fetched from the SavantCode database via `fetchAgentFromDatabase()`. In direct-provider mode, the database is unreachable for certain agents, causing them to fail.

### Expected Behavior

All 13 agents listed in `spawnableAgents` should be loadable via `spawn_agents`, regardless of whether the generated bundled file exists.

### Root Cause

The `prebuild-agents.ts` script's `loadAgentDefinition()` function catches import errors silently. If an agent module fails to import, it's skipped without clear logging. The generated file would then contain all agents EXCEPT those that failed, with no visible warning.

Additionally, there is no runtime fallback to load agents from the `agents/` directory when the generated file is missing or incomplete.

### Evidence

```
// prebuild-agents.ts — silently skips failed imports (before fix)
async function loadAgentDefinition(filePath: string): Promise<AgentDefinition | null> {
  try {
    const module = await import(filePath)
    const definition = module.default
    if (!definition || !definition.id || !definition.model) {
      return null  // Silently skipped — no specific error message
    }
    return processed
  } catch (error) {
    console.error(`Error loading agent from ${filePath}:`, error)
    return null  // Silently skipped
  }
}

// local-agent-registry.ts — no fallback (before fix)
const getBundledAgents = (): Record<string, AgentDefinition> => {
  return bundledAgentsModule.bundledAgents ?? {}  // No fallback if empty
}

// tool-executor.ts — reports "does not exist" when getAgentTemplate returns null
if (!template) {
  return { valid: false, error: `Agent "${agentTypeStr}" does not exist` }
}
```

## Impact Assessment

### Affected Components

- `cli/src/utils/local-agent-registry.ts` — added runtime fallback for bundled agents
- `cli/scripts/prebuild-agents.ts` — improved error logging for failed imports

### Risk Level

- [x] Critical: Two of nine canonical ECHO agents were completely unspawnable, breaking the RED phase (Detective) and file discovery (Scout) workflows.

## Proposed Solution

### Approach

Two-pronged fix:

**Fix 1: Runtime fallback in `local-agent-registry.ts`**
Added `bundledAgentsFallbackCache` that is populated during `initializeAgentRegistry()` when the generated bundled file is empty OR missing any of the 13 required agent IDs. The fallback loads agents directly from the `agents/` directory using the SDK's `loadLocalAgents()` function. Modified `getBundledAgents()` and `getBundledAgentsAsLocalInfo()` to merge generated agents with fallback cache (generated takes precedence).

**Fix 2: Improved error logging in `prebuild-agents.ts`**
Changed the silent failure in `loadAgentDefinition()` to log specific warnings for each failure mode: no default export, missing 'id' field, missing 'model' field, or import error. Each warning includes the file path and specific reason.

### Steps

1. ✅ Add `bundledAgentsFallbackCache` and populate it in `initializeAgentRegistry()` when generated file is missing or incomplete
2. ✅ Modify `getBundledAgents()` and `getBundledAgentsAsLocalInfo()` to merge generated + fallback
3. ✅ Add `REQUIRED_AGENT_IDS` list and check for missing critical agents
4. ✅ Improve `prebuild-agents.ts` error logging with specific failure reasons
5. ✅ Update `__resetLocalAgentRegistryForTests()` to clear new cache
6. ✅ Run x4 typecheck gate

### Verification

- x4 typecheck (sdk, common, agent-runtime, cli): ALL PASS (exit 0, no errors)
- Verifier review: APPROVED with 2 items addressed
- Call-graph reachability: `initializeAgentRegistry()` confirmed called at `cli/src/index.tsx:241`

## Perfection Loop

### Loop 1

- **RED:** Root cause traced through 8 source files. The loading chain is: CLI `loadAgentDefinitions()` → `getBundledAgents()` → `bundledAgentsModule.bundledAgents` (generated file) → SDK `initialSessionState()` → `fileContext.agentTemplates` → runtime `localAgentTemplates`. The generated file is gitignored and may be missing or incomplete due to silent import failures in the prebuild script.
- **GREEN:** 2 fixes implemented:
  1. `local-agent-registry.ts`: Added `bundledAgentsFallbackCache`, populated during `initializeAgentRegistry()` when the generated file is empty or missing any of 13 required agent IDs. `getBundledAgents()` merges generated + fallback (generated takes precedence). `getBundledAgentsAsLocalInfo()` also merges. `__resetLocalAgentRegistryForTests()` clears new cache.
  2. `prebuild-agents.ts`: Changed silent failure to log specific warnings: no default export, missing 'id', missing 'model', or import error — each with file path and reason.
- **AUDIT:** Verifier found 2 items: (1) call-graph reachability not confirmed — FIXED by grepping `initializeAgentRegistry` calls, confirmed at `cli/src/index.tsx:241`; (2) fallback only triggered when file is completely empty — FIXED by adding `REQUIRED_AGENT_IDS` list with 13 critical agent IDs and checking for any missing.
- **CHANGE DELTA:** ~60 lines across 2 files (~0.02% of codebase)

## Resolution

- **Fixed By:** Savant (Orchestrator, Hybrid Mode)
- **Fixed Date:** 2026-07-25 15:30
- **Fix Description:** 2 surgical fixes: (1) Runtime fallback in local-agent-registry.ts that loads agents from `agents/` directory when generated file is missing or incomplete, using `REQUIRED_AGENT_IDS` check for 13 critical agents. (2) Improved prebuild-agents.ts error logging with specific failure reasons per agent.
- **Tests Added:** No — existing local-agents test suite covers `initializeAgentRegistry` behavior.
- **Verified By:** x4 typecheck gate (all PASS), Verifier agent review (APPROVED), call-graph grep confirming `initializeAgentRegistry()` called at cli/src/index.tsx:241.
- **Commit/PR:** Pending commit.
- **Archived:** 2026-07-25

## Lessons Learned

1. Gitignored generated files are a fragile dependency for agent loading. The runtime should have a fallback path that doesn't depend on build-time generation.
2. Silent error catching in build scripts hides failures. The prebuild script caught import errors per-agent but only logged to console.error, which could be missed.
3. The agent loading pipeline has many layers of indirection: CLI bundled agents → SDK localAgentTemplates → runtime localAgentTemplates → database fallback. A single failure at any layer cascades.
4. Per-agent validation is better than empty-check validation. The initial fix only triggered when the generated file was completely empty, but the Verifier correctly identified that a partially-complete file (missing specific agents) would also need the fallback.
