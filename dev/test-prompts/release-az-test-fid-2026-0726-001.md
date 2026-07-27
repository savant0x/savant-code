# Release A-Z Test — FID-2026-0726-001 Goal/Loop End-to-End Wiring + FID-2026-0726-002 A-Z Regression Cleanup

**Version:** v0.0.7
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
- **Expected:** both report `0.0.7`

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
- Verify T179 and T180 expect `0.0.7`
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
| **Total** | | **24** | |
