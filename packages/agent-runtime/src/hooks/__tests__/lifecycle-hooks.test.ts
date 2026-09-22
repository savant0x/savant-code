/**
 * FID-2026-0919-031 — `Stop` / `Interrupt`, the terminal pair (parent suite;
 * compaction and `Notification` live in the `lifecycle-hooks-compaction`
 * sibling, and the census pins for all five in the sibling too).
 *
 * FID-2026-0919-030 classified `PreCompact`, `PostCompact`, `Stop`, `Interrupt`
 * and `Notification` as declared-with-no-firing-site, each with the blocker that
 * kept it inert. Wiring them meant ruling on semantics the code did not have.
 *
 * **The `Stop` / `Interrupt` ruling** is *who ended the turn*, mutually
 * exclusive per turn: `Stop` means the agent finished on its own terms (with the
 * outcome — `failed` under `Stop` when the loop returned the error form);
 * `Interrupt` means it was cancelled, including an abort observed while handling
 * a failure. A FAILURE fires neither: the turn did not finish and was not
 * cancelled, and `SessionEnd` carries the failure.
 *
 * These pins drive the REAL boundaries — the loop and the abort arm — because a
 * pin that calls the helper directly would pass just as happily against a helper
 * nothing invokes, which is the defect being fixed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import {
  installHookCapture,
  rootAgentState,
  type HookCapture,
} from './lifecycle-hooks-test-harness'
import {
  getLoopAgentStepsBaseParams,
  getMockAgentState,
  loopAgentSteps,
  registerPartALifecycle,
} from '../../__tests__/loop-agent-steps-part-a-test-harness'
import { mockFileContext } from '../../__tests__/test-utils'
import { handleLoopAbort } from '../../run-agent-step/loop/exit-paths'
import { fireMainAgentTerminalHook } from '../lifecycle-hooks'

registerPartALifecycle()

let capture: HookCapture

beforeEach(() => {
  capture = installHookCapture()
})

afterEach(() => {
  capture.restore()
})

describe('Stop fires for a finished turn, Interrupt for a cancelled one (FID-2026-0919-031)', () => {
  it('Stop carries the completion outcome', () => {
    const agentState = rootAgentState('run-stop-1')
    agentState.creditsUsed = 12

    fireMainAgentTerminalHook({
      event: 'Stop',
      agentState,
      fileContext: mockFileContext,
      outputType: 'lastMessage',
    })

    expect(capture.of('Stop')).toHaveLength(1)
    expect(capture.of('Interrupt')).toHaveLength(0)
    expect(capture.of('Stop')[0].tool_result).toEqual({
      status: 'completed',
      runId: 'run-stop-1',
      creditsUsed: 12,
      outputType: 'lastMessage',
    })
    // Nobody failed and nobody cancelled, so there is no reason to report.
    expect(capture.of('Stop')[0].error_message).toBeUndefined()
  })

  it('an error-form turn reports failed, under Stop — the turn DID finish', () => {
    fireMainAgentTerminalHook({
      event: 'Stop',
      agentState: rootAgentState('run-stop-2'),
      fileContext: mockFileContext,
      outputType: 'error',
      errorMessage: 'provider down',
    })

    expect(capture.of('Stop')[0].tool_result).toMatchObject({
      status: 'failed',
    })
    expect(capture.of('Stop')[0].error_message).toBe('provider down')
  })

  it('Interrupt carries the cancellation, never a Stop', () => {
    fireMainAgentTerminalHook({
      event: 'Interrupt',
      agentState: rootAgentState('run-abort-1'),
      fileContext: mockFileContext,
      errorMessage: 'Run cancelled by user',
    })

    expect(capture.of('Interrupt')).toHaveLength(1)
    expect(capture.of('Stop')).toHaveLength(0)
    expect(capture.of('Interrupt')[0].tool_result).toMatchObject({
      status: 'cancelled',
    })
    expect(capture.of('Interrupt')[0].error_message).toBe(
      'Run cancelled by user',
    )
  })

  it('a CHILD run fires neither — children report through SubagentStop', () => {
    const child = rootAgentState('run-child-1')
    child.parentId = 'run-parent-1'

    fireMainAgentTerminalHook({
      event: 'Stop',
      agentState: child,
      fileContext: mockFileContext,
      outputType: 'lastMessage',
    })
    fireMainAgentTerminalHook({
      event: 'Interrupt',
      agentState: child,
      fileContext: mockFileContext,
      errorMessage: 'Run cancelled by user',
    })

    // Without this the session boundary would be claimed once per subagent.
    expect(capture.fired).toHaveLength(0)
  })

  it('no resolved project root means no hook — the contract is unchanged', () => {
    fireMainAgentTerminalHook({
      event: 'Stop',
      agentState: rootAgentState('run-stop-3'),
      fileContext: { ...mockFileContext, projectRoot: '', cwd: '' },
      outputType: 'lastMessage',
    })

    expect(capture.fired).toHaveLength(0)
  })
})

describe('the loop and the abort arm drive those events (FID-2026-0919-031)', () => {
  it('a completed main-agent turn fires exactly one Stop', async () => {
    // The real loop, with the harness's mock stream ending on end_turn.
    await loopAgentSteps({
      ...getLoopAgentStepsBaseParams(),
      agentType: 'test-agent',
    } as never)

    const stops = capture.of('Stop')
    expect(stops.length).toBe(1)
    expect(stops[0].tool_result).toMatchObject({ status: 'completed' })
    // The turn was not cancelled, so the other half of the pair stays silent.
    expect(capture.of('Interrupt')).toHaveLength(0)
  })

  it('the abort arm fires Interrupt, not Stop', async () => {
    await handleLoopAbort(
      {
        params: {
          ...getLoopAgentStepsBaseParams(),
          finishAgentRun: async () => {},
        },
        state: { totalSteps: 0 },
        ctx: { runId: 'run-abort-2' },
        initialAgentState: getMockAgentState(),
      } as never,
      new DOMException('aborted', 'AbortError'),
    )

    const interrupts = capture.of('Interrupt')
    expect(interrupts.length).toBe(1)
    expect(interrupts[0].tool_result).toMatchObject({ status: 'cancelled' })
    expect(capture.of('Stop')).toHaveLength(0)
  })
})
