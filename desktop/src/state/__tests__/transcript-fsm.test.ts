import { describe, expect, test } from 'bun:test'

import { applyEventBatch, initialTranscriptState } from '../transcript-store'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

const PHASE_CALL = {
  type: 'tool_call',
  toolCallId: 'tc-fsm',
  toolName: 'transition_phase',
  input: {},
} as const

function phaseResult(phase: string): PrintModeEvent {
  return {
    type: 'tool_result',
    toolCallId: 'tc-fsm',
    toolName: 'transition_phase',
    output: [{ type: 'json', value: { phase } }],
  }
}

describe('fsmPhase tracking (FID-2026-0820-010 Step 5)', () => {
  test('a transition_phase result sets the FSM phase (G2 rule)', () => {
    const state = applyEventBatch(initialTranscriptState, [
      PHASE_CALL,
      phaseResult('audit'),
    ])
    expect(state.fsmPhase).toBe('audit')
  })

  test('the phase advances across successive transitions', () => {
    const once = applyEventBatch(initialTranscriptState, [
      PHASE_CALL,
      phaseResult('red'),
    ])
    expect(once.fsmPhase).toBe('red')
    const twice = applyEventBatch(once, [PHASE_CALL, phaseResult('green')])
    expect(twice.fsmPhase).toBe('green')
  })

  test('absent or unparseable phase leaves the previous phase untouched', () => {
    const seeded = applyEventBatch(initialTranscriptState, [
      PHASE_CALL,
      phaseResult('audit'),
    ])
    // A transition_phase result with NO json part: no scrape, no guess.
    const empty = applyEventBatch(seeded, [
      {
        type: 'tool_result',
        toolCallId: 'tc-fsm-2',
        toolName: 'transition_phase',
        output: [],
      },
    ])
    expect(empty.fsmPhase).toBe('audit')
    // A non-transition result never moves the phase.
    const other = applyEventBatch(seeded, [
      {
        type: 'tool_result',
        toolCallId: 'tc-x',
        toolName: 'write_file',
        output: [{ type: 'json', value: { phase: 'complete' } }],
      },
    ])
    expect(other.fsmPhase).toBe('audit')
  })

  test('non-string phase values are ignored', () => {
    const state = applyEventBatch(initialTranscriptState, [
      {
        type: 'tool_result',
        toolCallId: 'tc-bad',
        toolName: 'transition_phase',
        output: [{ type: 'json', value: { phase: 42 } }],
      },
    ])
    expect(state.fsmPhase).toBeNull()
  })
})
