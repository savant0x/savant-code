// FID-2026-0819-005 Loop 230: run settlement + handler-dispatch, extracted
// verbatim from execution.ts (over the 300-line ceiling). runOnce wires
// resolve()/dispatch(); behavior contract unchanged (FID-2026-0802-008 E1).

import type { RunReturnType } from '../types'
import type { Logger } from '@savant-code/common/types/contracts/logger'

export type RunSettlement = {
  promise: Promise<RunReturnType>
  /** Resolve the run with the final RunReturnType (marks the run settled). */
  resolve: (value: RunReturnType) => void
  /**
   * FID-2026-0802-008 E1: event/stream handlers are dispatched
   * fire-and-forget from sendAction, so a throwing handler (the default
   * client handleEvent throws to force error visibility) would otherwise
   * become an unhandled promise rejection — a process-crash risk. Route
   * handler errors into the run promise instead; once the run has settled,
   * rejections are dropped.
   */
  dispatch: (fn: () => void | Promise<void>) => Promise<void>
}

export function createRunSettlement(options: {
  logger?: Logger
  /** Invoked once when the run settles (e.g. to stop state snapshotting). */
  onSettled?: () => void
}): RunSettlement {
  let resolvePromise: (
    value: RunReturnType | PromiseLike<RunReturnType>,
  ) => void = () => {}
  let _reject: (error: Error) => void = () => {}
  const promise = new Promise<RunReturnType>((res, rej) => {
    resolvePromise = res
    _reject = rej
  })

  // Snapshot support: stop emitting the moment the run settles so a late
  // snapshot can never overwrite the final state persisted by the host.
  let settled = false
  const resolve = (value: RunReturnType) => {
    settled = true
    options.onSettled?.()
    resolvePromise(value)
  }

  const rejectRunWithHandlerError = (error: unknown) => {
    if (settled) return
    _reject(error instanceof Error ? error : new Error(String(error)))
  }

  const dispatch = async (fn: () => void | Promise<void>) => {
    try {
      await fn()
    } catch (error) {
      options.logger?.debug?.(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Event/stream handler threw; rejecting run',
      )
      rejectRunWithHandlerError(error)
    }
  }

  return { promise, resolve, dispatch }
}
