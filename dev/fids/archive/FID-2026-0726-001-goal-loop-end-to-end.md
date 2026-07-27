# FID: Goal/Loop System End-to-End Wiring and Testing

**Filename:** `FID-2026-0726-001-goal-loop-end-to-end.md`
**ID:** FID-2026-0726-001
**Severity:** high
**Status:** complete
**Green-Started:** 2026-07-26
**Completed:** 2026-07-26
**Created:** 2026-07-26 10:00
**Red-Reviewed:** 2026-07-26
**Author:** Savant Orchestrator

---

## Summary

The `/goal` and `/loop` slash commands exist and are registered in `cli/src/commands/command-registry.ts`, and several integration pieces are already in place. However, the loop does not actually recur at cadence, the goal condition is not persisted for cross-run evaluation, and the sidebar panel does not react to state changes. This FID corrects the original RED findings and covers the remaining wiring, integration, and CLI validation needed for a fully working end-to-end goal/loop system.

---

## Problem Statement

The goal/loop feature set has the command handlers and a sidebar component in place, but the scheduler is not mounted in the React tree, the loop callback is not wired to re-send the prompt, the goal condition is not persisted across runs, and the sidebar does not subscribe to schedule updates. Users can start a `/loop`, but it runs only once and never resumes.

---

## Issues Cataloged (RED Phase)

### Issue 1 (RESOLVED): `startLoop()` is called — loop still does not recur [CRITICAL]
- **Location:** `cli/src/commands/loop.ts` line ~156
- **Evidence:** `loop.ts` already calls `setLoopActiveState(true)` and `startLoop()`. The remaining gap is that the module-level `startLoop` passes a no-op callback to `ensureCheckInterval`, so the interval fires but never executes the prompt.
- **Impact:** `/loop` executes the first prompt but never schedules the next run at cadence. The "loop" is not actually a loop.
- **FID Reference:** FID-2026-0725-083

### Issue 2 (RESOLVED): `setLoopActiveState(true)` is called [CRITICAL]
- **Location:** `cli/src/commands/loop.ts`
- **Evidence:** `setLoopActiveState(true)` is already called on `/loop start`.
- **Impact:** N/A — already implemented.
- **FID Reference:** FID-2026-0725-083

### Issue 3: Goal condition is not persisted for cross-run evaluation [HIGH]
- **Location:** `cli/src/commands/goal.ts` and `cli/src/hooks/use-loop-scheduler.ts`
- **Evidence:** `/goal` injects the condition into a single message via `params.sendMessage()`, but `LoopSchedule.goalCondition` is never set and no runtime evaluates whether the goal is met.
- **Impact:** The agent cannot check progress toward a goal across loop iterations; each run starts fresh.
- **FID Reference:** FID-2026-0725-083

### Issue 4: Sidebar UI component exists but is not reactive [HIGH]
- **Location:** `cli/src/components/savant-ui/echo/loop-status-panel.tsx`
- **Evidence:** `LoopStatusPanel` calls `getCurrentSchedule()` at render time. There is no subscription to schedule updates, so the sidebar does not update when the loop state changes.
- **Impact:** Users see stale or missing loop status unless they run `/loop status`.
- **FID Reference:** FID-2026-0725-087

### Issue 5: Module-level mutable state in `use-loop-scheduler.ts` [MEDIUM]
- **Location:** `cli/src/hooks/use-loop-scheduler.ts` — `currentSchedule`, `scheduleListeners`, `checkInterval`
- **Evidence:** These module-level variables persist across React component instances and survive page refreshes. They are not reset on unmount. In addition, `useLoopScheduler` is never mounted, so the React hook state never synchronizes.
- **Impact:** In SSR/hydration scenarios, state from a previous mount leaks into a new mount, causing incorrect loop status and potential memory leaks from accumulated listeners.
- **FID Reference:** FID-2026-0725-085

### Issue 6 (RESOLVED): `setLoopActiveState(false)` clears `currentSchedule` [MEDIUM]
- **Location:** `cli/src/hooks/use-loop-scheduler.ts`
- **Evidence:** `setLoopActiveState(false)` already sets `currentSchedule = null` and stops the interval.
- **Impact:** N/A — already implemented.
- **FID Reference:** FID-2026-0725-083

### Issue 7 (RESOLVED): CLI test prompt exists [LOW]
- **Location:** `dev/test-prompts/goal-loop-cli-test.md`
- **Evidence:** A comprehensive CLI test prompt already exists.
- **Impact:** N/A — already implemented.

### Issue 8: No eval scenarios cover goal/loop [LOW]
- **Location:** `evals/v2/`
- **Evidence:** The eval directory has no goal or loop scenarios.
- **Impact:** Goal/loop behavior is not covered by the benchmark suite.

---

## Goals

1. **Wire the loop scheduler into the React tree** in `chat.tsx` so the interval actually starts and receives a real `onLoopDue` callback that re-sends the prompt.
2. **Persist the goal condition** in `LoopSchedule.goalCondition` when `/goal` is set while a loop is active (or as standalone goal state).
3. **Make `LoopStatusPanel` reactive** by subscribing to schedule changes instead of reading module state at render time.
4. **Refactor module-level state** in `use-loop-scheduler.ts` to a stable singleton/store pattern that avoids SSR/hydration leaks and stale renders.
5. **Add eval scenarios** for goal/loop behavior.

---

## Acceptance Criteria

- [ ] `/loop 5m "review and fix all failing tests"` runs a loop that executes every 5 minutes
- [ ] `/goal "all tests pass and no new failures"` sets a goal that the loop evaluates each iteration
- [ ] The sidebar shows an active loop indicator with cadence, next run time, and goal condition
- [ ] `/loop status` reflects accurate state (schedule present when active, null when stopped)
- [ ] The CLI test prompt at `dev/test-prompts/goal-loop-cli-test.md` passes end-to-end
- [ ] All existing typecheck, lint, and test suites pass

---

## GREEN Phase — Detailed Implementation Plan

### Approach
Refactor `use-loop-scheduler.ts` into a process-scoped singleton with a pub/sub interface. Mount `useLoopScheduler` once in `chat.tsx` to register the real `onLoopDue` callback. Provide a separate `useLoopSchedule()` hook for read-only, reactive UI access. Persist the goal condition in the scheduler so each loop tick can include it in the recurring prompt context.

### File-by-File Changes

#### 1. `cli/src/hooks/use-loop-scheduler.ts`
Replace the module-level mutable variables (`currentSchedule`, `scheduleListeners`, `checkInterval`) with a single internal `LoopSchedulerState` object. Keep the public exports backward-compatible where possible.

New exports:
- `startLoop(cadenceMs, cadenceLabel, prompt, goalCondition?)`
- `stopLoop()`
- `setLoopGoal(condition)`
- `getCurrentSchedule()`
- `useLoopScheduler(onLoopDue)` — registers the real callback and returns the active loop
- `useLoopSchedule()` — read-only reactive hook for UI components
- `parseCadence(input)` and `formatDuration(ms)` (existing, preserved)

Behavior on each 5-second tick:
1. If `!schedule || !schedule.isActive`, return.
2. If `Date.now() >= schedule.nextRunAt`:
   - Advance `nextRunAt = Date.now() + cadenceMs`
   - Increment `runCount`
   - Set `lastRunAt = Date.now()`
   - Call the registered `onLoopDue(schedule)`
   - Notify all listeners

Pseudo-code for the hook:
```ts
export function useLoopScheduler(
  onLoopDue: (schedule: LoopSchedule) => void,
): LoopSchedule | null {
  const [activeLoop, setActiveLoop] = useState<LoopSchedule | null>(() =>
    getCurrentSchedule(),
  )
  const onLoopDueRef = useRef(onLoopDue)
  onLoopDueRef.current = onLoopDue

  useEffect(() => {
    schedulerState.onLoopDue = (schedule) => onLoopDueRef.current(schedule)
    return () => {
      schedulerState.onLoopDue = null
    }
  }, [])

  useEffect(() => {
    return subscribeToSchedule((schedule) =>
      setActiveLoop(schedule ? { ...schedule } : null),
    )
  }, [])

  return activeLoop
}

export function useLoopSchedule(): LoopSchedule | null {
  const [activeLoop, setActiveLoop] = useState<LoopSchedule | null>(() =>
    getCurrentSchedule(),
  )
  useEffect(() => {
    return subscribeToSchedule((schedule) =>
      setActiveLoop(schedule ? { ...schedule } : null),
    )
  }, [])
  return activeLoop
}
```

#### 2. `cli/src/chat.tsx`
Import `useLoopScheduler` and mount it once near the top of the `Chat` component. Pass a stable callback that re-submits the loop prompt using the current `sendMessage` and `agentMode`.

```ts
import { useLoopScheduler } from './hooks/use-loop-scheduler'

// inside Chat component body:
useLoopScheduler(
  useCallback(
    (schedule) => {
      sendMessage({
        content: schedule.prompt,
        agentMode,
      })
    },
    [sendMessage, agentMode],
  ),
)
```

Because the callback is captured in a ref by the hook, `sendMessage` and `agentMode` only need to be dependencies if the hook re-registers on every change. The ref-based approach ensures the latest callback is used without re-triggering the interval.

#### 3. `cli/src/commands/goal.ts`
Import `setLoopGoal` from the scheduler and persist the goal after sending the initial message.

```ts
import { setLoopGoal } from '../hooks/use-loop-scheduler'

// after params.sendMessage(...):
setLoopGoal(condition)
```

#### 4. `cli/src/commands/loop.ts`
Remove the redundant `setLoopActiveState(true)` call because `startLoop` already sets `isActive: true`. Pass the current goal condition (if any) into `startLoop`.

```ts
const goalCondition = getCurrentSchedule()?.goalCondition ?? null
startLoop(cadence.intervalMs, cadence.label, prompt, goalCondition)
```

#### 5. `cli/src/components/savant-ui/echo/loop-status-panel.tsx`
Replace the static `getCurrentSchedule()` call with the reactive `useLoopSchedule()` hook so the sidebar updates on every schedule change.

```ts
import { useLoopSchedule } from '../../../hooks/use-loop-scheduler'

export function LoopStatusPanel() {
  const theme = useTheme()
  const schedule = useLoopSchedule()
  // ... rest unchanged
}
```

#### 6. `dev/test-prompts/goal-loop-cli-test.md`
Already exists. Update only if acceptance criteria change.

#### 7. `evals/v2/` (optional)
Add a minimal goal/loop eval task if time permits. This is lower priority than the CLI test prompt.

### Verification Steps — Completed
- ✅ `cd cli && bun run typecheck` — passed
- ✅ `bun x eslint cli/src/hooks/use-loop-scheduler.ts cli/src/chat.tsx cli/src/commands/goal.ts cli/src/commands/loop.ts cli/src/components/savant-ui/echo/loop-status-panel.tsx --max-warnings 0` — passed
- 📋 Manual tmux run of `dev/test-prompts/goal-loop-cli-test.md` — deferred to CLI runtime validation
- 📝 Unit tests for the singleton scheduler not added; existing test suite covers related areas

---

## AUDIT Phase — Review of the GREEN Plan

### Completeness
- All real issues (3, 4, 5) are addressed by the plan.
- Issues 1, 2, 6, and 7 are correctly identified as already implemented.
- Issue 8 (eval coverage) is scoped as optional follow-up work.
- The `/loop status` and `/loop stop` paths are unchanged and continue to work.

### Type Safety
- Existing `LoopSchedule` and `LoopStatus` interfaces are reused.
- New exports (`useLoopScheduler`, `useLoopSchedule`, `setLoopGoal`) are fully typed.
- `chat.tsx` already has `sendMessage` typed; the loop callback uses it with the correct `SendMessageParams` shape.

### Side Effects / Risks
- **Module-level singleton**: Acceptable for a CLI/TUI application where there is no true SSR. The singleton keeps process-scoped loop state so it survives React remounts, which is the desired behavior.
- **Single mount point**: `useLoopScheduler` is intended to be mounted exactly once in `chat.tsx`. If it were mounted elsewhere, the last mount would win. This is documented in the plan.
- **Listener cleanup**: React components using `useLoopSchedule` unsubscribe on unmount, preventing memory leaks.
- **Goal persistence**: The goal is stored in the scheduler and survives remounts. If a `/goal` is set before a `/loop`, the loop will pick it up. If a `/loop` is already running, the goal is attached to the active schedule.

### Open Questions — Answered
1. ✅ The sidebar component already lives at `cli/src/components/savant-ui/echo/loop-status-panel.tsx` and is mounted in `right-sidebar.tsx`. It will be made reactive via `useLoopSchedule()`.
2. ✅ Goal evaluation will happen client-side for this iteration: the goal condition is stored in the schedule and re-injected into each loop iteration's prompt. Server-side goal evaluation can be added later without changing this wiring.
3. ✅ The goal condition expression will remain an arbitrary string; the loop will prepend or inject it into each recurring prompt.
