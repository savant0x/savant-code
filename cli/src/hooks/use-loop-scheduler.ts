/**
 * use-loop-scheduler — Cadence-based loop scheduling hook.
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

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Cadence specification parsed from user input.
 * Supports: Nd (daily), Nh (hourly), Nm (every N minutes), Ns (every N seconds)
 */
export interface LoopSchedule {
  /** Unique ID for this loop instance */
  id: string
  /** Cadence in milliseconds */
  cadenceMs: number
  /** Human-readable cadence label (e.g., "1h", "5m") */
  cadenceLabel: string
  /** The prompt to re-send on each cadence */
  prompt: string
  /** Whether this loop is currently active */
  isActive: boolean
  /** Timestamp of the next scheduled run */
  nextRunAt: number
  /** Total number of runs completed */
  runCount: number
  /** Timestamp of the last run */
  lastRunAt?: number
  /** Whether the last run succeeded */
  lastRunSuccess?: boolean
  /** Goal condition string, if a goal was set */
  goalCondition?: string | null
  /** Whether the last run failed with an error */
  lastRunFailed?: boolean
}

/**
 * Result from the loop scheduler hook.
 */
export interface UseLoopSchedulerReturn {
  /** The active loop schedule, or null if no loop is active */
  activeLoop: LoopSchedule | null
  /** Start a new loop with the given cadence and prompt */
  startLoop: (cadenceMs: number, cadenceLabel: string, prompt: string) => void
  /** Stop the active loop */
  stopLoop: () => void
  /** Get the current loop status for display */
  getStatus: () => LoopStatus
}

/**
 * Status information for display in /loop status command.
 */
export interface LoopStatus {
  isActive: boolean
  cadenceLabel: string
  timeUntilNextRun: string
  runCount: number
  lastRunAt?: string
  lastRunSuccess?: boolean
}

/**
 * Parse a cadence string like "30s", "1d", "1h", or "5m" into milliseconds.
 */
export function parseCadence(
  input: string,
): { intervalMs: number; label: string } | null {
  const match = input.trim().match(/^(\d+)([sdhm])$/)
  if (!match) return null

  const amount = parseInt(match[1], 10)
  const unit = match[2]
  if (amount <= 0) return null

  switch (unit) {
    case 's':
      return { intervalMs: amount * 1000, label: `${amount}s` }
    case 'd':
      return { intervalMs: amount * 24 * 60 * 60 * 1000, label: `${amount}d` }
    case 'h':
      return { intervalMs: amount * 60 * 60 * 1000, label: `${amount}h` }
    case 'm':
      return { intervalMs: amount * 60 * 1000, label: `${amount}m` }
    default:
      return null
  }
}

/**
 * Format milliseconds to a human-readable duration string.
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return 'now'

  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${Math.ceil(ms / 1000)}s`
}

/**
 * Format a timestamp to a human-readable date string.
 */
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString()
}

/**
 * Generate a unique loop ID.
 */
function generateLoopId(): string {
  return `loop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// Singleton scheduler state
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

/**
 * Custom hook for loop cadence scheduling.
 *
 * Registers a callback that is invoked whenever a loop's cadence has elapsed.
 * This hook is intended to be mounted once at the top of the React tree
 * (e.g., in chat.tsx). It also returns the active loop schedule.
 *
 * @param onLoopDue - Callback invoked when a loop's cadence has elapsed.
 */
export function useLoopScheduler(
  onLoopDue: (schedule: LoopSchedule) => void | Promise<void>,
): UseLoopSchedulerReturn {
  const onLoopDueRef = useRef(onLoopDue)
  onLoopDueRef.current = onLoopDue

  const [activeLoop, setActiveLoop] = useState<LoopSchedule | null>(() =>
    getCurrentSchedule(),
  )

  // Register the loop-due callback with the singleton. The latest callback is
  // always used via a ref, so the interval does not need to be restarted when
  // the callback changes.
  useEffect(() => {
    const handler = (schedule: LoopSchedule) => onLoopDueRef.current(schedule)
    return registerLoopDueHandler(handler)
  }, [])

  // Subscribe to schedule changes for reactive UI updates.
  useEffect(() => {
    return subscribeToSchedule((schedule) =>
      setActiveLoop(schedule ? { ...schedule } : null),
    )
  }, [])

  const startLoopCallback = useCallback(
    (cadenceMs: number, cadenceLabel: string, prompt: string) => {
      startLoop(cadenceMs, cadenceLabel, prompt)
    },
    [],
  )

  const stopLoopCallback = useCallback(() => {
    stopLoop()
  }, [])

  const getStatus = useCallback((): LoopStatus => {
    const schedule = getCurrentSchedule()
    if (!schedule || !schedule.isActive) {
      return {
        isActive: false,
        cadenceLabel: '',
        timeUntilNextRun: '',
        runCount: 0,
      }
    }

    const timeUntilNext = schedule.nextRunAt - Date.now()
    return {
      isActive: true,
      cadenceLabel: schedule.cadenceLabel,
      timeUntilNextRun: formatDuration(timeUntilNext),
      runCount: schedule.runCount,
      lastRunAt: schedule.lastRunAt
        ? formatTimestamp(schedule.lastRunAt)
        : undefined,
      lastRunSuccess: schedule.lastRunSuccess,
    }
  }, [activeLoop])

  return {
    activeLoop,
    startLoop: startLoopCallback,
    stopLoop: stopLoopCallback,
    getStatus,
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
