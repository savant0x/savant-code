import { buildLoopPrompt } from './use-loop-scheduler'

import type { LoopSchedule } from './use-loop-scheduler'
import type {
  SendMessageFn,
  SendMessageOutcome,
} from '../types/contracts/send-message'
import type { AgentMode } from '../utils/constants'

export type RunOutcomeObserver = (outcome: SendMessageOutcome) => void
export type RunOutcomeErrorHandler = (error: unknown) => void

/**
 * Create a one-shot outcome reporter for a single send-message invocation.
 *
 * A send can reach several handled early-return/error paths, so callers must
 * not emit more than one scheduler outcome. Observer failures are delegated to
 * the caller's error handler and never change the send result.
 */
export function createRunOutcomeReporter(
  observer: RunOutcomeObserver | undefined,
  onObserverError: RunOutcomeErrorHandler,
): RunOutcomeObserver {
  let reported = false

  return (outcome) => {
    if (reported) return
    reported = true

    try {
      observer?.(outcome)
    } catch (error) {
      onObserverError(error)
    }
  }
}

/**
 * Adapt the chat send contract to the loop scheduler's promise callback.
 * Handled send failures reject the scheduler run so it records failure rather
 * than incorrectly advancing the loop as successful.
 */
export function createLoopRunHandler(
  sendMessage: SendMessageFn,
  agentMode: AgentMode,
): (schedule: LoopSchedule) => Promise<void> {
  return async (schedule) => {
    let outcome: SendMessageOutcome | undefined
    await sendMessage({
      content: buildLoopPrompt(schedule),
      agentMode,
      onRunOutcome: (nextOutcome) => {
        outcome ??= nextOutcome
      },
    })

    if (!outcome) {
      throw new Error('Scheduled loop run did not report an outcome')
    }
    if (outcome === 'failure') {
      throw new Error('Scheduled loop run failed')
    }
  }
}
