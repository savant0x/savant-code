/**
 * Tool outcome durability — FID-2026-1006-002 WP3 (T149 idea 3).
 *
 * Pins the one invariant this work package adopts: a tool call's outcome is
 * RECORDED when it is materialized, never inferred from auxiliary progress.
 * From that moment the call is not redispatchable; a call that never reached a
 * result surface never claims an outcome at all. The design study behind the
 * model is `docs/tool-outcome-durability.md`.
 *
 * The state model lives in `tools/tool-executor/tool-outcome-state.ts` and is
 * re-exported from `result-lifecycle.ts` (the public path used here); all runs
 * go through the shared fixture barrel, never `./native`.
 */

import { beforeEach, describe, expect, it } from 'bun:test'

import {
  createBaseParams,
  EchoComplianceTracker,
  makeAgentState,
  makeAgentTemplate,
  newTempProjectWithFile,
  runGateOrderTest,
  type ChunkRecord,
} from './tool-executor-gate-order-fixtures'
import { getOrCreateEnforcement } from '../echo/enforcement'
import {
  isRedispatchable,
  markToolOutcomeReady,
  resetToolOutcomes,
  toolOutcomeState,
} from '../tools/tool-executor/result-lifecycle'

beforeEach(() => {
  resetToolOutcomes()
})

describe('tool outcome durability (FID-2026-1006-002 WP3)', () => {
  it('1. an unrecorded call is dispatching and redispatchable; a settled one is not', () => {
    expect(toolOutcomeState('never-seen')).toBe('dispatching')
    expect(isRedispatchable('dispatching')).toBe(true)
    // The point of the model: a recorded outcome is terminal.
    expect(isRedispatchable('outcome_ready')).toBe(false)
  })

  it('2. a successful result materializes outcome_ready on the result surface', async () => {
    const { projectRoot, target } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['write_file']),
    )
    const tracker = new EchoComplianceTracker({
      fidPaths: [],
      userPrompt: 'outcome-durability',
    })
    tracker.recordRead([target])
    params.agentState = makeAgentState({ echoCompliance: tracker })
    getOrCreateEnforcement(params.agentState).state.filesRead.add(target)
    params.toolCallId = 'outcome-ready-write'
    params.toolName = 'write_file'
    params.input = {
      path: target,
      instructions: 'outcome durability write',
      content: '// outcome durability\n',
    }
    params.requestToolCall = async () => ({
      output: [
        {
          type: 'json' as const,
          value: { file: target, content: '// outcome durability\n' },
        },
      ],
    })

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    expect(chunks.find((c) => c.type === 'tool_result')).toBeDefined()
    expect(toolOutcomeState('outcome-ready-write')).toBe('outcome_ready')
    expect(isRedispatchable(toolOutcomeState('outcome-ready-write'))).toBe(
      false,
    )
  })

  it('3. a rejected call also settles its outcome — a rejection is not pending work', async () => {
    const { projectRoot, target } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['write_file']),
    )
    const tracker = new EchoComplianceTracker({
      fidPaths: [],
      userPrompt: 'outcome-durability-rejection',
    })
    tracker.recordRead([target])
    params.agentState = makeAgentState({ echoCompliance: tracker })
    getOrCreateEnforcement(params.agentState).state.filesRead.add(target)
    params.toolCallId = 'outcome-ready-rejection'
    params.toolName = 'write_file'
    params.input = {
      path: target,
      instructions: 'rejected write',
      content: '// rejected\n',
    }
    // A failed predecessor rejects the awaited handler: the rejection path
    // (FID-2026-0802-005 C2 — the run survives, the call fails).
    const rejectedPredecessor = Promise.reject(
      new Error('predecessor tool failed'),
    )
    rejectedPredecessor.catch(() => {})
    params.previousToolCallFinished = rejectedPredecessor

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    expect(chunks.find((c) => c.type === 'error')).toBeDefined()
    expect(toolOutcomeState('outcome-ready-rejection')).toBe('outcome_ready')
    expect(isRedispatchable(toolOutcomeState('outcome-ready-rejection'))).toBe(
      false,
    )
  })

  it('4. a gate-halted call never claims an outcome (no result surface, no outcome)', async () => {
    const { projectRoot } = newTempProjectWithFile('// pre-existing\n')
    const chunks: ChunkRecord[] = []
    // `write_file` is not declared for this template, so the capability gate
    // halts the call before any handler runs. Auxiliary progress (a parse, a
    // trace event, an error chunk) must not be readable as an outcome.
    const params = createBaseParams(
      projectRoot,
      chunks,
      makeAgentTemplate(['read_files']),
    )
    params.toolCallId = 'outcome-halted'
    params.toolName = 'write_file'
    params.input = { path: 'not-declared.ts', instructions: 'x', content: 'y' }

    await expect(runGateOrderTest(params)).resolves.toBeUndefined()

    expect(chunks.find((c) => c.type === 'tool_call')).toBeUndefined()
    expect(chunks.find((c) => c.type === 'tool_result')).toBeUndefined()
    expect(toolOutcomeState('outcome-halted')).toBe('dispatching')
    expect(isRedispatchable(toolOutcomeState('outcome-halted'))).toBe(true)
  })

  it('5. resetToolOutcomes clears the store (test seam, not a production clear)', () => {
    markToolOutcomeReady('outcome-ready-reset')
    expect(toolOutcomeState('outcome-ready-reset')).toBe('outcome_ready')

    resetToolOutcomes()

    expect(toolOutcomeState('outcome-ready-reset')).toBe('dispatching')
  })
})
