import { afterEach, describe, expect, test } from 'bun:test'

import { createLoopRunHandler } from '../run-outcome'
import {
  buildLoopPrompt,
  getCurrentSchedule,
  parseCadence,
  registerLoopDueHandler,
  runLoopSchedulerTick,
  setLoopGoal,
  startLoop,
  stopLoop,
  subscribeToSchedule,
} from '../use-loop-scheduler'

import type { SendMessageFn } from '../../types/contracts/send-message'

let unregisterHandler: (() => void) | null = null

afterEach(() => {
  unregisterHandler?.()
  unregisterHandler = null
  stopLoop()
})

const flushSchedulerPromises = async (): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

describe('use-loop-scheduler', () => {
  test('parses second, minute, hour, and day cadences', () => {
    expect(parseCadence('30s')).toEqual({ intervalMs: 30_000, label: '30s' })
    expect(parseCadence('5m')).toEqual({ intervalMs: 300_000, label: '5m' })
    expect(parseCadence('1h')).toEqual({ intervalMs: 3_600_000, label: '1h' })
    expect(parseCadence('1d')).toEqual({
      intervalMs: 86_400_000,
      label: '1d',
    })
    expect(parseCadence('0s')).toBeNull()
    expect(parseCadence('30x')).toBeNull()
  })

  test('persists a goal for a future loop and includes it in recurring prompts', () => {
    setLoopGoal('all tests pass')
    startLoop(30_000, '30s', 'run the test suite')

    const schedule = getCurrentSchedule()
    expect(schedule).not.toBeNull()
    expect(schedule?.goalCondition).toBe('all tests pass')
    expect(buildLoopPrompt(schedule!)).toBe(
      'run the test suite\n\nGoal condition to evaluate after this run: all tests pass',
    )
  })

  test('attaches a goal to an active loop and notifies subscribers', () => {
    const snapshots: Array<string | null> = []
    const unsubscribe = subscribeToSchedule((schedule) => {
      snapshots.push(schedule?.goalCondition ?? null)
    })

    startLoop(30_000, '30s', 'run tests')
    setLoopGoal('no new failures')

    expect(getCurrentSchedule()?.goalCondition).toBe('no new failures')
    expect(snapshots).toEqual([null, null, 'no new failures'])

    unsubscribe()
  })

  test('keeps the first run pending until a handler is registered', async () => {
    startLoop(0, '0s', 'handler not mounted yet')

    runLoopSchedulerTick()

    expect(getCurrentSchedule()?.runCount).toBe(0)
    expect(getCurrentSchedule()?.lastRunAt).toBeUndefined()

    const prompts: string[] = []
    unregisterHandler = registerLoopDueHandler((schedule) => {
      prompts.push(schedule.prompt)
    })
    await flushSchedulerPromises()
    await flushSchedulerPromises()

    expect(prompts).toEqual(['handler not mounted yet'])
    expect(getCurrentSchedule()?.runCount).toBe(1)
    expect(getCurrentSchedule()?.lastRunSuccess).toBe(true)
  })

  test('completes two scheduled ticks through the send outcome adapter', async () => {
    let sends = 0
    const sendMessage: SendMessageFn = async (params) => {
      sends += 1
      params.onRunOutcome?.('success')
    }
    unregisterHandler = registerLoopDueHandler(
      createLoopRunHandler(sendMessage, 'EDIT'),
    )

    startLoop(0, '0s', 'run the scheduled task')
    await flushSchedulerPromises()
    await flushSchedulerPromises()

    expect(sends).toBe(1)
    expect(getCurrentSchedule()?.runCount).toBe(1)

    runLoopSchedulerTick()
    await flushSchedulerPromises()
    await flushSchedulerPromises()

    expect(sends).toBe(2)
    expect(getCurrentSchedule()?.runCount).toBe(2)
    expect(getCurrentSchedule()?.lastRunSuccess).toBe(true)
  })

  test('records success and failure for due callbacks', async () => {
    const outcomes: string[] = []
    unregisterHandler = registerLoopDueHandler(async (schedule) => {
      outcomes.push(schedule.prompt)
    })

    startLoop(0, '0s', 'successful run')
    runLoopSchedulerTick()
    await flushSchedulerPromises()
    await flushSchedulerPromises()

    expect(outcomes).toEqual(['successful run'])
    expect(getCurrentSchedule()?.runCount).toBe(1)
    expect(getCurrentSchedule()?.lastRunSuccess).toBe(true)
    expect(getCurrentSchedule()?.lastRunFailed).toBe(false)

    unregisterHandler?.()
    unregisterHandler = registerLoopDueHandler(() =>
      Promise.reject(new Error('run failed')),
    )
    startLoop(0, '0s', 'failed run')
    runLoopSchedulerTick()
    await flushSchedulerPromises()
    await flushSchedulerPromises()

    expect(getCurrentSchedule()?.lastRunSuccess).toBe(false)
    expect(getCurrentSchedule()?.lastRunFailed).toBe(true)
  })

  test('does not overlap a replacement loop with an older in-flight run', async () => {
    let resolveOldRun: (() => void) | undefined
    let calls = 0
    unregisterHandler = registerLoopDueHandler(
      () =>
        new Promise<void>((resolve) => {
          calls += 1
          if (calls === 1) resolveOldRun = resolve
          else resolve()
        }),
    )

    startLoop(0, '0s', 'old run')
    await flushSchedulerPromises()

    startLoop(0, '0s', 'new run')
    await flushSchedulerPromises()

    expect(calls).toBe(1)
    resolveOldRun?.()
    await flushSchedulerPromises()
    await flushSchedulerPromises()

    expect(calls).toBe(2)
    expect(getCurrentSchedule()?.prompt).toBe('new run')
    expect(getCurrentSchedule()?.runCount).toBe(1)
  })

  test('stale completion cannot mutate a restarted loop', async () => {
    let resolveOldRun: (() => void) | undefined
    unregisterHandler = registerLoopDueHandler(
      () =>
        new Promise<void>((resolve) => {
          resolveOldRun = resolve
        }),
    )

    startLoop(0, '0s', 'old run')
    runLoopSchedulerTick()
    await flushSchedulerPromises()

    startLoop(0, '0s', 'new run')
    resolveOldRun?.()
    await flushSchedulerPromises()
    await flushSchedulerPromises()

    expect(getCurrentSchedule()?.prompt).toBe('new run')
    expect(getCurrentSchedule()?.runCount).toBe(0)
    expect(getCurrentSchedule()?.lastRunSuccess).toBeUndefined()
  })

  test('starts the first run through the registered scheduler handler', async () => {
    const prompts: string[] = []
    unregisterHandler = registerLoopDueHandler((schedule) => {
      prompts.push(buildLoopPrompt(schedule))
    })
    setLoopGoal('no new failures')

    startLoop(30_000, '30s', 'run tests')
    await flushSchedulerPromises()

    expect(prompts).toEqual([
      'run tests\n\nGoal condition to evaluate after this run: no new failures',
    ])
    expect(getCurrentSchedule()?.runCount).toBe(1)
  })

  test('drains a replacement loop after an older run rejects', async () => {
    let rejectOldRun: ((error: Error) => void) | undefined
    let calls = 0
    unregisterHandler = registerLoopDueHandler(
      () =>
        new Promise<void>((resolve, reject) => {
          calls += 1
          if (calls === 1) rejectOldRun = reject
          else resolve()
        }),
    )

    startLoop(0, '0s', 'old run')
    await flushSchedulerPromises()
    startLoop(0, '0s', 'new run')
    rejectOldRun?.(new Error('old run failed'))
    await flushSchedulerPromises()
    await flushSchedulerPromises()
    await flushSchedulerPromises()

    expect(calls).toBe(2)
    expect(getCurrentSchedule()?.prompt).toBe('new run')
    expect(getCurrentSchedule()?.runCount).toBe(1)
    expect(getCurrentSchedule()?.lastRunSuccess).toBe(true)
  })

  test('stopping a loop clears its schedule and pending callback state', () => {
    setLoopGoal('finish the task')
    startLoop(30_000, '30s', 'work')
    expect(getCurrentSchedule()?.isActive).toBe(true)

    stopLoop()

    expect(getCurrentSchedule()).toBeNull()
  })
})
