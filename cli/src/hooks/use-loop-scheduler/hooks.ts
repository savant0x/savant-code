/**
 * use-loop-scheduler — React hooks over the singleton scheduler.
 *
 * FID-2026-0726-001: Exposes cadence-based loop scheduling to the React tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getCurrentSchedule,
  registerLoopDueHandler,
  startLoop,
  stopLoop,
  subscribeToSchedule,
} from './scheduler'
import { formatDuration, formatTimestamp } from './types'

import type { LoopSchedule, LoopStatus, UseLoopSchedulerReturn } from './types'

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
