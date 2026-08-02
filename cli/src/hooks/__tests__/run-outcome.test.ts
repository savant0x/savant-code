import { describe, expect, test } from 'bun:test'

import { createLoopRunHandler, createRunOutcomeReporter } from '../run-outcome'

import type { SendMessageFn } from '../../types/contracts/send-message'
import type { LoopSchedule } from '../use-loop-scheduler'

describe('createRunOutcomeReporter', () => {
  test('reports the first outcome exactly once', () => {
    const outcomes: string[] = []
    const reporter = createRunOutcomeReporter(
      (outcome) => outcomes.push(outcome),
      () => {},
    )

    reporter('success')
    reporter('failure')

    expect(outcomes).toEqual(['success'])
  })

  test('reports handled failures for recurring-run scheduling', () => {
    const outcomes: string[] = []
    const reporter = createRunOutcomeReporter(
      (outcome) => outcomes.push(outcome),
      () => {},
    )

    reporter('failure')

    expect(outcomes).toEqual(['failure'])
  })

  test('does not let an observer exception escape the send path', () => {
    const observerErrors: unknown[] = []
    const reporter = createRunOutcomeReporter(
      () => {
        throw new Error('observer failed')
      },
      (error) => observerErrors.push(error),
    )

    expect(() => reporter('failure')).not.toThrow()
    expect(observerErrors).toHaveLength(1)
    expect(observerErrors[0]).toBeInstanceOf(Error)
    expect((observerErrors[0] as Error).message).toBe('observer failed')
  })

  test('marks an outcome as reported even when the observer throws', () => {
    let calls = 0
    const reporter = createRunOutcomeReporter(
      () => {
        calls += 1
        throw new Error('observer failed')
      },
      () => {},
    )

    reporter('success')
    reporter('failure')

    expect(calls).toBe(1)
  })

  test('supports sends without an outcome observer', () => {
    expect(() =>
      createRunOutcomeReporter(undefined, () => {})('success'),
    ).not.toThrow()
  })

  test('adapts a successful scheduled send and includes the goal prompt', async () => {
    let sent: Parameters<SendMessageFn>[0] | undefined
    const sendMessage: SendMessageFn = async (params) => {
      sent = params
      params.onRunOutcome?.('success')
    }
    const schedule: LoopSchedule = {
      id: 'loop-test',
      cadenceMs: 30_000,
      cadenceLabel: '30s',
      prompt: 'run tests',
      isActive: true,
      nextRunAt: Date.now(),
      runCount: 1,
      goalCondition: 'no new failures',
    }

    await createLoopRunHandler(sendMessage, 'EDIT')(schedule)

    expect(sent?.content).toBe(
      'run tests\n\nGoal condition to evaluate after this run: no new failures',
    )
    expect(sent?.agentMode).toBe('EDIT')
  })

  test('rejects a scheduled send when the send reports failure', async () => {
    const sendMessage: SendMessageFn = async (params) => {
      params.onRunOutcome?.('failure')
    }

    await expect(
      createLoopRunHandler(
        sendMessage,
        'EDIT',
      )({
        id: 'loop-test',
        cadenceMs: 30_000,
        cadenceLabel: '30s',
        prompt: 'run tests',
        isActive: true,
        nextRunAt: Date.now(),
        runCount: 1,
      }),
    ).rejects.toThrow('Scheduled loop run failed')
  })

  test('rejects a scheduled send when sendMessage itself rejects', async () => {
    const sendMessage: SendMessageFn = async () => {
      throw new Error('send failed')
    }

    await expect(
      createLoopRunHandler(
        sendMessage,
        'EDIT',
      )({
        id: 'loop-test',
        cadenceMs: 30_000,
        cadenceLabel: '30s',
        prompt: 'run tests',
        isActive: true,
        nextRunAt: Date.now(),
        runCount: 1,
      }),
    ).rejects.toThrow('send failed')
  })

  test('fails closed when sendMessage omits the outcome callback', async () => {
    const sendMessage: SendMessageFn = async () => {}

    await expect(
      createLoopRunHandler(
        sendMessage,
        'EDIT',
      )({
        id: 'loop-test',
        cadenceMs: 30_000,
        cadenceLabel: '30s',
        prompt: 'run tests',
        isActive: true,
        nextRunAt: Date.now(),
        runCount: 1,
      }),
    ).rejects.toThrow('did not report an outcome')
  })

  test('uses the first outcome when a sender reports duplicates', async () => {
    const sendMessage: SendMessageFn = async (params) => {
      params.onRunOutcome?.('success')
      params.onRunOutcome?.('failure')
    }

    await expect(
      createLoopRunHandler(
        sendMessage,
        'EDIT',
      )({
        id: 'loop-test',
        cadenceMs: 30_000,
        cadenceLabel: '30s',
        prompt: 'run tests',
        isActive: true,
        nextRunAt: Date.now(),
        runCount: 1,
      }),
    ).resolves.toBeUndefined()
  })
})
