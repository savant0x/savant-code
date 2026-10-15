import { join } from 'node:path'

import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { mock, spyOn } from 'bun:test'

import { mockFileContext } from '../../__tests__/test-utils'
import { HookEngine } from '../engine'

import type { HookInputData } from '../types'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0919-031 — shared harness for the lifecycle hook suites (the parent
 * `lifecycle-hooks.test.ts` and the compaction/notification sibling).
 *
 * The capture surfaces intercept the engine's dispatch so a pin can assert what
 * the runtime FIRED rather than what a helper returned. Both suites need it and
 * the event payloads are `HookInputData`, so the shape lives here once.
 */

export const repoRoot = join(import.meta.dir, '..', '..', '..', '..', '..')

export type HookCapture = {
  /** Every hook input the runtime dispatched, in order. */
  fired: HookInputData[]
  /** Only the inputs for one event name. */
  of: (event: string) => HookInputData[]
  restore: () => void
}

/** Intercept dispatch: nothing spawns, nothing blocks, everything is recorded. */
export function installHookCapture(): HookCapture {
  const fired: HookInputData[] = []
  spyOn(HookEngine.prototype, 'fireAndForgetTrigger').mockImplementation(
    (input: HookInputData) => {
      fired.push(input)
    },
  )
  return {
    fired,
    of: (event: string) =>
      fired.filter((input) => input.hook_event_name === event),
    restore: () => mock.restore(),
  }
}

/** A root (non-child) agent state with a known run id. */
export function rootAgentState(runId: string): AgentState {
  const agentState = getInitialSessionState(mockFileContext).mainAgentState
  agentState.runId = runId
  return agentState
}
