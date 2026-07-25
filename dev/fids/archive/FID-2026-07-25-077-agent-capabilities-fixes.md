---
filename: FID-2026-07-25-077-agent-capabilities-fixes.md
ID: FID-2026-07-25-077
Severity: high
Status: closed
Created: 2026-07-25 14:00
Author: Savant (Orchestrator)
---

# FID: Agent Capabilities Test Fixes

## Summary

Five issues discovered during the comprehensive agent capabilities test (79 tests across 12 tiers). Three are fixable in code; two are infrastructure issues requiring documentation only. The three code fixes address: (1) FID gate blocking Hybrid Mode GREEN transitions, (2) basher phase-gating prompt contradiction, and (3) restrictive read-only command allowlist.

## Environment

- **OS:** win32
- **Language/Runtime:** TypeScript (strict mode), Bun 1.3.11
- **Tool Versions:** GLM 5.2 Free via TokenRouter
- **Commit/State:** v0.0.6, main branch

## Detailed Description

### Problem

Three code-level issues and two infrastructure issues were discovered during the capabilities test:

**Issue 1 (CRITICAL — Infrastructure): Detective and Scout agents fail to spawn**
- `getAgentTemplate()` in `agent-registry.ts` cannot find 'detective' or 'scout' in `localAgentTemplates` or the database cache.
- `assembleLocalAgentTemplates()` only loads from `fileContext.agentTemplates` (dynamic agents), not the built-in agents defined in `agents/detective/` and `agents/scout/`.
- Root cause: In direct-provider mode, built-in agents are not loaded into the runtime's agent template registry.
- This is a runtime configuration issue, not a code logic bug. The agent definitions exist and are valid.
- **Resolution: Document only.** The fix requires changes to the agent loading pipeline which is complex and risky to change without deeper investigation.

**Issue 2 (HIGH — Code fix): FID gate blocks Hybrid Mode GREEN transitions**
- In `transition-phase.ts`, the `scanOpenFids()` check runs unconditionally when entering 'green' phase.
- This blocks Hybrid Mode (which should allow direct writes without FID-Bound Execution for simple tasks).
- The system prompt says "write code directly for most tasks" but the runtime rejects GREEN entry without a FID.
- **Resolution: Add `devMode` bypass** in `transition-phase.ts`, mirroring the existing `isDevOverride` pattern in `tool-executor.ts`.

**Issue 3 (HIGH — Infrastructure): Gravity Index completely unavailable**
- All 4 gravity_index actions fail with "SavantCode backend services are unavailable in direct-provider mode."
- This is a backend connectivity issue, not a code defect.
- **Resolution: Document only.** Requires backend infrastructure changes.

**Issue 4 (MEDIUM — Code fix): Basher phase-gating contradicts system prompt**
- The system prompt says "basher is available in all phases" but `tool-executor.ts` gates `run_terminal_command` to `['audit', 'green']` only.
- Basher spawns successfully but the underlying terminal command is rejected.
- **Resolution: Update the system prompt** in `common/src/constants/agents.ts` (ECHO_PROTOCOL_INSTRUCTIONS) to accurately state that basher spawns in all phases but terminal commands require GREEN or AUDIT phase.

**Issue 5 (MEDIUM — Code fix): run_readonly_command allowlist too restrictive**
- The regex in `run-readonly-command.ts` allows `bun -v` but NOT `bun --version`.
- Missing several common version-checking commands.
- **Resolution: Expand the allowlist regex** to include `bun --version`, `tsc --version`, `npm --version`, `npx --version`, `pnpm --version`, `yarn --version`, `deno --version`, `cargo --version`, `go --version`, `node -v`, and other safe diagnostic commands.

### Expected Behavior

- Hybrid Mode should allow GREEN transitions without an open FID when `devMode` is active.
- The system prompt should accurately describe basher's phase requirements.
- `run_readonly_command` should accept `bun --version` and other version-checking commands.

### Root Cause

1. `transition-phase.ts` line ~90: FID check has no `devMode` bypass.
2. `common/src/constants/agents.ts` ECHO_PROTOCOL_INSTRUCTIONS: incorrect basher phase description.
3. `run-readonly-command.ts` line ~19: regex missing `--version` variants.

### Evidence

```
// transition-phase.ts — FID check blocks all GREEN transitions
if (phase === 'green') {
    const openFids = scanOpenFids(fileContext.cwd)
    if (openFids.length === 0) {
      // REJECTED — no devMode bypass
    }
}

// tool-executor.ts — basher's run_terminal_command is phase-gated
if (!isDevOverride && toolCall.toolName === 'run_terminal_command' &&
    !['audit', 'green'].includes(agentState.fsmPhase ?? 'idle')) {
  // REJECTED
}

// run-readonly-command.ts — regex allows 'bun -v' but not 'bun --version'
const READONLY_COMMAND_ALLOW_REGEX = /^\s*(?:bun\s+(?:run\s+typecheck|...)|...|bun\s+-v|...)/i;
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` — FID gate bypass
- `common/src/constants/agents.ts` — basher prompt clarification
- `packages/agent-runtime/src/tools/handlers/tool/run-readonly-command.ts` — allowlist expansion
- `packages/agent-runtime/src/tools/handlers/__tests__/run-readonly-command.test.ts` — new tests

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Three surgical fixes, each touching a single file (plus tests):

### Issue 2 Fix: Add devMode bypass for FID gate in transition-phase.ts

Added `fileContext.devMode !== true` condition to the FID check when entering 'green' phase. This allows Hybrid Mode to bypass the FID requirement when devMode is active, mirroring the existing `isDevOverride` pattern in `tool-executor.ts` for write tools.

**Note:** This only bypasses for devMode (dev/testing). Production users still need an open FID for GREEN transitions. A future FID should address whether Hybrid Mode should bypass the FID gate for all users, not just dev mode.

### Issue 4 Fix: Update basher prompt in common/src/constants/agents.ts

Changed the basher note from:
> "It is available in all phases."
To:
> "The agent itself can be spawned in any phase, but the terminal commands it executes require GREEN or AUDIT phase. Transition to GREEN before spawning basher for commands that need `run_terminal_command`."

### Issue 5 Fix: Expand allowlist in run-readonly-command.ts

Expanded `READONLY_COMMAND_ALLOW_REGEX` to include: `bun --version|-v`, `tsc --version`, `node --version|-v`, `npm --version|-v`, `npx --version`, `go --version`, `cargo --version`, `pnpm --version|-v`, `yarn --version|-v`, `deno --version`.

### Steps

1. ✅ Add `devMode` bypass to FID check in `transition-phase.ts`
2. ✅ Update basher prompt in `common/src/constants/agents.ts`
3. ✅ Expand allowlist regex in `run-readonly-command.ts`
4. ✅ Add test for version-checking commands in `run-readonly-command.test.ts`
5. ✅ Run x4 typecheck gate
6. ✅ Run relevant tests

### Verification

- x4 typecheck (sdk, common, agent-runtime, cli): ALL PASS (exit 0, no errors)
- run-readonly-command tests: 13/13 PASS (12 original + 1 new test for version commands, 89 expect calls)
- Verifier review: APPROVED with 2 items addressed (missing test added, FID updated)

## Perfection Loop

### Loop 1

- **RED:** 3 code-level issues identified with file paths, line references, and root cause analysis. 2 infrastructure issues documented (detective/scout spawning, gravity_index backend) as not fixable in code.
- **GREEN:** 3 fixes implemented:
  1. `transition-phase.ts`: Added `fileContext.devMode !== true` condition to skip FID check when devMode is active.
  2. `common/src/constants/agents.ts`: Updated ECHO_PROTOCOL_INSTRUCTIONS basher note to accurately describe phase requirements.
  3. `run-readonly-command.ts`: Expanded READONLY_COMMAND_ALLOW_REGEX with `bun --version`, `tsc --version`, `node -v`, `npm --version`, `npx --version`, `pnpm --version`, `yarn --version`, `deno --version`, `cargo --version`, `go --version`.
- **AUDIT:** Verifier found 2 items: (1) no test for newly allowed commands — FIXED by adding test case with 18 version-checking commands; (2) FID Perfection Loop sections left as placeholders — FIXED by updating FID with actual results. Verifier also noted that devMode bypass only helps dev users, not production — documented as future work.
- **CHANGE DELTA:** ~15 lines across 3 source files + ~30 lines of new test code (~0.01% of codebase)

## Resolution

- **Fixed By:** Savant (Orchestrator, Hybrid Mode)
- **Fixed Date:** 2026-07-25 14:30
- **Fix Description:** 3 surgical fixes: (1) devMode bypass for FID gate in transition-phase.ts, (2) accurate basher phase description in agents.ts, (3) expanded version-checking command allowlist in run-readonly-command.ts. Added test coverage for newly allowed commands.
- **Tests Added:** Yes — 1 new test case ('allows version-checking commands') with 18 command assertions in run-readonly-command.test.ts.
- **Verified By:** x4 typecheck gate (all PASS), run-readonly-command tests (13/13 PASS), Verifier agent review (APPROVED).
- **Commit/PR:** Pending commit.
- **Archived:** 2026-07-25

## Lessons Learned

1. The FID gate for GREEN phase was designed for FID-Bound Execution but inadvertently blocks Hybrid Mode. The devMode bypass mirrors tool-executor.ts but only helps dev users — production Hybrid Mode bypass needs a separate FID.
2. System prompts that promise behavior must match runtime enforcement. "basher is available in all phases" was technically true (agent spawns) but misleading because the underlying tool is phase-gated.
3. Command allowlists should be reviewed against real-world usage patterns. `bun --version` is a common diagnostic command that was missing.
4. New behavior requires new tests. The Verifier correctly flagged missing test coverage for the expanded allowlist.
