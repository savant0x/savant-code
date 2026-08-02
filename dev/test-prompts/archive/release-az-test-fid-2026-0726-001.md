# Release A-Z Test — FID-2026-0726-001 Goal/Loop End-to-End Wiring + FID-2026-0726-002 A-Z Regression Cleanup

**Version:** v0.0.8
**Purpose:** Regression and feature verification for the goal/loop slash-command system and the A-Z test regression cleanup before release.

**Ground Rules:**
- Run from agent context (idle phase unless noted)
- Do not require user interaction
- Report pass/fail and any friction for every test
- Write the final report to `dev/scratchpad/release-az-test-fid-2026-0726-001-report.md`

**Available Tools:** read_files, glob, list_directory, spawn_agents, write_todos, basher, code_searcher

---

## Tier 1: Build & Type Safety

### T1.1 — Common workspace typecheck
- Run `cd common && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.2 — Agent-runtime workspace typecheck
- Run `cd packages/agent-runtime && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.3 — SDK workspace typecheck
- Run `cd sdk && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.4 — CLI workspace typecheck
- Run `cd cli && bun run typecheck`
- **Expected:** exit code 0, no errors

### T1.5 — ESLint zero warnings
- Run `bun x eslint common/src cli/src sdk/src packages/agent-runtime/src --max-warnings 0`
- **Expected:** zero warnings, zero errors

### T1.6 — No `Record<string, unknown>` shortcuts in core production source
- Search `common/src`, `cli/src`, `sdk/src`, and `packages/agent-runtime/src` for `Record<string, unknown>`
- **Expected:** zero matches in production source (test files excluded)

### T1.7 — Version metadata
- Read `VERSION`
- Read root `package.json`
- **Expected:** both report `0.0.8`

---

## Tier 2: Goal/Loop Components

### T2.1 — Command handlers exist
- Read `cli/src/commands/goal.ts`
- Read `cli/src/commands/loop.ts`
- Verify both export `handleGoalCommand` and `handleLoopCommand`
- **Expected:** handler files exist and are registered in `cli/src/commands/command-registry.ts`

### T2.2 — Scheduler hook exists and exports subscriptions
- Read `cli/src/hooks/use-loop-scheduler.ts`
- Verify it exports `useLoopScheduler`, `useLoopSchedule`, `startLoop`, `stopLoop`, `setLoopGoal`, `setLoopActiveState`, `getCurrentSchedule`, and `subscribeToSchedule`
- **Expected:** all reactive scheduler primitives are present

### T2.3 — Scheduler is mounted in chat
- Read `cli/src/chat.tsx`
- Verify `useLoopScheduler` is called and wired to `sendMessage`
- **Expected:** loop callback triggers `sendMessage({ content: schedule.prompt, agentMode })`

### T2.4 — Sidebar loop status is reactive
- Read `cli/src/components/savant-ui/echo/loop-status-panel.tsx`
- Verify it uses `useLoopSchedule()` to subscribe to schedule changes
- Verify it is mounted in `cli/src/components/right-sidebar.tsx`
- **Expected:** UI updates when loop state changes

### T2.5 — Goal persists across loop runs
- Read `cli/src/commands/goal.ts`
- Verify it calls `setLoopGoal(condition)`
- **Expected:** goal condition is stored in the active schedule

### T2.6 — Loop actually recurs
- Read `cli/src/commands/loop.ts`
- Verify it calls `startLoop(...)` with cadence and prompt
- Verify it does NOT redundantly call `setLoopActiveState(true)`
- **Expected:** scheduler starts a real interval that invokes the registered callback

---

## Tier 3: Functional Checks

### T3.1 — Cadence parsing
- Read `cli/src/commands/loop.ts`
- Verify `parseCadence` supports `Nd`, `Nh`, and `Nm`
- **Expected:** daily, hourly, and minute cadences are parsed correctly

### T3.2 — Loop status subcommands
- Read `cli/src/commands/loop.ts`
- Verify `/loop stop` calls `stopLoop()`
- Verify `/loop status` calls `getCurrentSchedule()`
- **Expected:** stop clears schedule; status reflects current state

### T3.3 — Goal condition injection
- Read `cli/src/commands/goal.ts`
- Verify the goal condition is injected into the system message
- **Expected:** agent receives the goal condition in context

### T3.4 — Goal evaluation in agent runtime
- Read `packages/agent-runtime/src/run-agent-step.ts`
- Verify goal satisfaction markers (`GOAL_SATISFIED`, `GOAL_NOT_SATISFIED`, `GOAL_ERROR`) are evaluated when `agentState.goalCondition` is set
- **Expected:** loop continues or stops based on goal evaluation

---

## Tier 4: Regression Checks

### T4.1 — Context compactor type safety
- Read `packages/agent-runtime/src/context-compactor.ts`
- Verify no `Record<string, unknown>` shortcut remains in `isPromptTooLongError`
- **Expected:** type-safe property checks

### T4.2 — Run-agent-step imports
- Read `packages/agent-runtime/src/run-agent-step.ts`
- Verify `CompactionMessage` is imported as a type from `./context-compactor`
- Verify inline `import('./context-compactor').CompactionMessage[]` annotations are gone
- Verify no unused variables remain
- **Expected:** clean imports, no lint warnings

### T4.3 — A-Z script Phase 32
- Read `scripts/run-az-test.sh`
- Verify Phase 32 exists and checks T200–T207
- **Expected:** goal/loop wiring is covered by the automated A-Z script

### T4.4 — A-Z script version expectation
- Read `scripts/run-az-test.sh`
- Verify T179 and T180 expect `0.0.8`
- **Expected:** version checks align with current release

---

## Tier 5: Documentation

### T5.1 — FID status
- Read `dev/fids/archive/FID-2026-0726-001-goal-loop-end-to-end.md`
- Read `dev/fids/archive/FID-2026-0726-002-a-z-test-regression-cleanup.md`
- Verify both are archived and have complete resolution sections
- **Expected:** ground-truth verification sections are complete

### T5.2 — CHANGELOG entry
- Read `CHANGELOG.md`
- Verify entries for v0.0.7 mention the goal/loop wiring and A-Z regression cleanup
- **Expected:** CHANGELOG is current

### T5.3 — CLI test prompt exists
- Verify `dev/test-prompts/goal-loop-cli-test.md` exists
- **Expected:** manual/live CLI test prompt is present

---

## Tier 6: CLI Smoke (if tmux available)

### T6.1 — CLI launches
- If possible, launch the CLI with `bun run src/index.tsx --cwd ..` from `cli/`
- Verify it starts without crashing
- **Expected:** prompt appears

### T6.2 — /loop status returns accurate state
- In the CLI, run `/loop status` with no active loop
- **Expected:** status shows no active loop

### T6.3 — /goal sets a condition
- In the CLI, run `/goal all tests pass with no new failures`
- **Expected:** goal condition is acknowledged

### T6.4 — /loop starts a loop
- In the CLI, run `/loop 30s check repository health`
- **Expected:** loop starts, first run executes, sidebar shows active loop

---

## Tier 7: Tool Safety & Sandbox Engine (v0.0.8 — FID-2026-07-27-001)

### T7.1 — Safety registry exists
- Read `common/src/tools/safety.ts` and `common/src/tools/safety-registry.ts`
- Verify `safety-registry.ts` exports a registry mapping tool names to safety metadata (level: safe | prompt | unsafe)
- **Expected:** all registered tools have safety metadata

### T7.2 — `/permissions` command registered
- Read `cli/src/commands/command-registry.ts`
- Verify the `permissions` command definition is registered with aliases `sandbox` and `safety`
- **Expected:** command is accessible via `/permissions`, `/sandbox`, and `/safety`

### T7.3 — `/permissions` accepts valid modes
- Read `cli/src/commands/command-registry.ts`
- Verify the `permissions` handler accepts `safe`, `prompt`, and `unsafe` as valid mode arguments
- **Expected:** mode is stored in `useChatStore` state and persisted to settings

### T7.4 — `/permissions` rejects invalid mode
- Read `cli/src/commands/command-registry.ts`
- Verify the `permissions` handler returns an error message for modes other than `safe`/`prompt`/`unsafe`
- **Expected:** clear error message listing valid modes

### T7.5 — Sandbox engine denylist
- Search `packages/agent-runtime/src` for sandbox or safety enforcement logic
- Verify destructive shell commands (rm -rf, git push --force, etc.) are denied in safe mode
- **Expected:** denylist blocks destructive operations when in safe mode

### T7.6 — `g` alias for `/goal`
- Read `cli/src/commands/command-registry.ts`
- Verify `g` is registered as an alias for the `/goal` command
- **Expected:** typing `g` triggers the same handler as `/goal`

### T7.7 — `--permission-mode` CLI flag
- Search `cli/src` for `permission-mode` or `permissionMode` flag parsing
- Verify the CLI parses `--permission-mode safe|prompt|unsafe` at startup
- **Expected:** flag sets initial permission mode before any commands run

### T7.8 — Network gating
- Read `packages/agent-runtime/src/tools/sandbox/engine.ts`
- Verify `createDefaultSandboxPolicy` sets `allowNetwork` based on permission mode (`safe` → false, `prompt`/`unsafe` → true)
- Verify `evaluateToolCall` denies network tools in `safe` mode, returns `prompt` in `prompt` mode, and allows them in `unsafe` mode
- Run `cd packages/agent-runtime && bun test src/tools/sandbox/__tests__/engine.test.ts`
- **Expected:** network access respects permission mode settings (blocked in safe, prompted in prompt, allowed in unsafe)

---

## Tier 8: Brand & Login Restorations (v0.0.8)

### T8.1 — `/login` command registered
- Read `cli/src/commands/command-registry.ts`
- Verify `handleLoginCommand` (or equivalent) is registered for `/login`
- **Expected:** `/login` is accessible as a slash command

### T8.2 — `/login` alias `/signin`
- Read `cli/src/commands/command-registry.ts`
- Verify `/signin` is registered as an alias for `/login`
- **Expected:** `/signin` triggers the same handler as `/login`

### T8.3 — `.savant-code/` config directory
- Search `common/src`, `cli/src`, and `packages/agent-runtime/src` for config directory references
- Verify `.savant-code` is used as the config directory name (not `.freebuff`)
- **Expected:** all runtime paths use `.savant-code/`

### T8.4 — No stale `.freebuff` references in production
- Search `common/src`, `cli/src`, `sdk/src`, and `packages/agent-runtime/src` for `freebuff` (excluding test files)
- **Expected:** zero matches in production source

---

## Report Format

After all tiers, write `dev/scratchpad/release-az-test-fid-2026-0726-001-report.md` with:

1. **Executive Summary** — 3-5 sentences on release readiness
2. **Tier-by-Tier Results** — For each test: Status, Notes, Friction Level (none/low/medium/high)
3. **Blockers** — Any test that must be fixed before release
4. **Pre-existing Issues** — Any failures not caused by this feature
5. **Release Recommendation** — Go / No-Go with justification

---

## Summary

| Tier | Name | Tests | Purpose |
|------|------|-------|---------|
| 1 | Build & Type Safety | 7 | Does the code compile and pass lint? |
| 2 | Goal/Loop Components | 6 | Are the goal/loop components wired correctly? |
| 3 | Functional Checks | 4 | Do the slash commands behave correctly? |
| 4 | Regression Checks | 4 | Are the recent cleanups applied correctly? |
| 5 | Documentation | 3 | Is the FID/CHANGELOG/test prompt complete? |
| 6 | CLI Smoke | 4 | Does the feature hold up in the real CLI? |
| 7 | Tool Safety & Sandbox Engine | 8 | Are v0.0.8 safety features wired correctly? |
| 8 | Brand & Login Restorations | 4 | Are v0.0.8 brand/login fixes applied? |
| **Total** | | **36** | |
