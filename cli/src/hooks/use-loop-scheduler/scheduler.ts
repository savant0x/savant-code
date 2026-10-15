/**
 * use-loop-scheduler — Singleton scheduler state machine.
 *
 * FID-2026-0726-001: Manages /loop cadence scheduling end-to-end.
 * Runs a setInterval that checks for pending loops and resumes them
 * when their cadence has elapsed.
 *
 * Design constraints:
 * - Single model: no separate scheduler process
 * - Terminal/MCP only: no webhooks or external dependencies
 * - DB persistence: uses existing session history (no new state layer)
 * - Circuit breakers apply: max iterations, convergence detection
 */

import { generateLoopId } from './types'

import type { LoopSchedule } from './types'

interface SchedulerState {
  schedule: LoopSchedule | null
  listeners: Set<(schedule: LoopSchedule | null) => void>
  interval: ReturnType<typeof setInterval> | null
  onLoopDue: ((schedule: LoopSchedule) => void | Promise<void>) | null
  pendingGoalCondition: string | null
  runInFlight: boolean
  executionToken: number
  inFlightToken: number | null
}

const schedulerState: SchedulerState = {
  schedule: null,
  listeners: new Set(),
  interval: null,
  onLoopDue: null,
  pendingGoalCondition: null,
  runInFlight: false,
  executionToken: 0,
  inFlightToken: null,
}

/**
 * Notify all listeners of schedule changes.
 */
function notifyListeners(): void {
  for (const listener of schedulerState.listeners) {
    listener(schedulerState.schedule)
  }
}

/**
 * Run one scheduler tick. The interval and tests share this implementation so
 * cadence behavior is deterministic and does not require a second scheduler.
 */
export function runLoopSchedulerTick(): void {
  const schedule = schedulerState.schedule
  if (!schedule || !schedule.isActive || schedulerState.runInFlight) return
  if (Date.now() < schedule.nextRunAt) return

  const onLoopDue = schedulerState.onLoopDue
  if (!onLoopDue) return

  // Advance schedule before invoking the callback so the next run time is
  // always forward-looking.
  const dueSchedule: LoopSchedule = {
    ...schedule,
    nextRunAt: Date.now() + schedule.cadenceMs,
    runCount: schedule.runCount,
    lastRunAt: Date.now(),
    lastRunSuccess: undefined,
    lastRunFailed: undefined,
  }
  schedulerState.schedule = dueSchedule
  notifyListeners()

  const executionToken = ++schedulerState.executionToken
  schedulerState.runInFlight = true
  schedulerState.inFlightToken = executionToken
  Promise.resolve()
    .then(() => onLoopDue(dueSchedule))
    .then(() => {
      if (
        schedulerState.inFlightToken !== executionToken ||
        schedulerState.schedule?.id !== dueSchedule.id
      ) {
        return
      }
      schedulerState.schedule = {
        ...schedulerState.schedule,
        runCount: schedulerState.schedule.runCount + 1,
        lastRunSuccess: true,
        lastRunFailed: false,
      }
      notifyListeners()
    })
    .catch(() => {
      if (
        schedulerState.inFlightToken !== executionToken ||
        schedulerState.schedule?.id !== dueSchedule.id
      ) {
        return
      }
      schedulerState.schedule = {
        ...schedulerState.schedule,
        runCount: schedulerState.schedule.runCount + 1,
        lastRunSuccess: false,
        lastRunFailed: true,
      }
      notifyListeners()
    })
    .finally(() => {
      if (schedulerState.inFlightToken !== executionToken) return

      schedulerState.runInFlight = false
      schedulerState.inFlightToken = null

      // A replacement loop may have become due while the previous send was
      // still in flight. Drain that pending run only after the old send has
      // settled, so restarting a loop never creates overlapping sends.
      if (
        schedulerState.schedule?.id !== dueSchedule.id &&
        schedulerState.schedule?.isActive
      ) {
        runLoopSchedulerTick()
      }
    })
}

/**
 * Register the process-scoped callback used when a loop becomes due.
 * Cleanup is owner-guarded so an old React mount cannot clear a newer one.
 */
export function registerLoopDueHandler(
  handler: (schedule: LoopSchedule) => void | Promise<void>,
): () => void {
  schedulerState.onLoopDue = handler

  // A loop can be started before the React effect that registers the handler
  // runs. Keep that first run pending and drain it as soon as a handler exists.
  runLoopSchedulerTick()

  return () => {
    if (schedulerState.onLoopDue === handler) {
      schedulerState.onLoopDue = null
    }
  }
}

/**
 * Start the check interval if not already running.
 */
function ensureCheckInterval(): void {
  if (schedulerState.interval) return
  schedulerState.interval = setInterval(runLoopSchedulerTick, 5000)
}

/**
 * Stop the check interval.
 */
function stopCheckInterval(): void {
  if (schedulerState.interval) {
    clearInterval(schedulerState.interval)
    schedulerState.interval = null
  }
}

/**
 * Subscribe to schedule changes. The listener is called immediately with the
 * current schedule and again whenever the schedule changes. Returns an
 * unsubscribe function.
 */
export function subscribeToSchedule(
  listener: (schedule: LoopSchedule | null) => void,
): () => void {
  schedulerState.listeners.add(listener)
  listener(schedulerState.schedule)
  return () => {
    schedulerState.listeners.delete(listener)
  }
}

/**
 * Get the current loop schedule.
 */
export function getCurrentSchedule(): LoopSchedule | null {
  return schedulerState.schedule
}

/**
 * Start a new loop with the given cadence and prompt. If a goal condition was
 * previously set via /goal, it is attached to the new schedule.
 */
export function startLoop(
  cadenceMs: number,
  cadenceLabel: string,
  prompt: string,
): void {
  // Invalidate completion updates from any previous loop, but preserve its
  // in-flight lock. If a previous send is still running, the new loop remains
  // due until that send settles; this prevents overlapping requests while
  // allowing the replacement loop to start immediately afterward.
  schedulerState.executionToken += 1
  schedulerState.schedule = {
    id: generateLoopId(),
    cadenceMs,
    cadenceLabel,
    prompt,
    isActive: true,
    // Run the first iteration through the same scheduler path as recurring
    // iterations. This keeps run accounting, overlap protection, goal prompt
    // construction, and outcome handling consistent from the first run.
    nextRunAt: Date.now(),
    runCount: 0,
    goalCondition: schedulerState.pendingGoalCondition,
  }
  schedulerState.pendingGoalCondition = null
  notifyListeners()
  ensureCheckInterval()
  runLoopSchedulerTick()
}

/**
 * Stop the active loop and clear the schedule.
 */
export function stopLoop(): void {
  stopCheckInterval()
  schedulerState.executionToken += 1
  schedulerState.inFlightToken = null
  schedulerState.runInFlight = false
  schedulerState.schedule = null
  notifyListeners()
}

/**
 * Set the active state of the current loop (for /loop stop command).
 * `true` reactivates an inactive schedule; `false` stops and clears it.
 */
export function setLoopActiveState(isActive: boolean): void {
  if (isActive) {
    if (schedulerState.schedule && !schedulerState.schedule.isActive) {
      schedulerState.schedule = { ...schedulerState.schedule, isActive: true }
      notifyListeners()
      ensureCheckInterval()
    }
  } else {
    stopLoop()
  }
}

/**
 * Set the goal condition. If a loop is active, the condition is attached to the
 * current schedule. If not, it is stored as a pending condition for the next
 * loop that starts.
 */
export function setLoopGoal(condition: string): void {
  schedulerState.pendingGoalCondition = condition.trim() || null
  if (schedulerState.schedule && schedulerState.pendingGoalCondition) {
    schedulerState.schedule = {
      ...schedulerState.schedule,
      goalCondition: schedulerState.pendingGoalCondition,
    }
    notifyListeners()
  }
}

/**
 * Build the recurring prompt while preserving the user's original prompt and
 * carrying the active goal into every scheduled run.
 */
export function buildLoopPrompt(schedule: LoopSchedule): string {
  if (!schedule.goalCondition) return schedule.prompt
  return `${schedule.prompt}\n\nGoal condition to evaluate after this run: ${schedule.goalCondition}`
}
