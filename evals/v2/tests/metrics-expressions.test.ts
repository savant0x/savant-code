import { describe, it, expect } from 'bun:test'

import { MetricAggregator, evaluateExpectedCalls } from '../src/metrics'

import type { EchoPhase, TraceDocument } from '../src/runner'
import type { TaskDefinition } from '../src/schema'

// FID-2026-0819-005 Loop 199: FSM-sequence/custom-check failure suites and
// the evaluateExpectedCalls describe moved verbatim from metrics.test.ts;
// fixtures copied verbatim.

function makeTask(overrides: Partial<TaskDefinition> = {}): TaskDefinition {
  return {
    schema_version: '2.0',
    task_id: 'metrics-test-001',
    category: 'pure_coding',
    difficulty: 'easy',
    environment: {
      setup_script: 'echo setup',
      network_disabled: true,
    },
    inputs: { prompt: 'fix it' },
    validation: {
      timeout_seconds: 60,
      deterministic_checks: [],
    },
    ...overrides,
  }
}

function makeTrace(
  events: TraceDocument['events'],
  currentPhase: EchoPhase = 'idle',
): TraceDocument {
  return {
    task_id: 'metrics-test-001',
    run_id: 'run-001',
    started_at: new Date().toISOString(),
    current_phase: currentPhase,
    events,
    metadata: {
      total_steps: events.length,
      subagent_count: 0,
      tool_call_count: 0,
      phase_transition_count: 0,
      final_phase: currentPhase,
    },
  }
}

describe('MetricAggregator', () => {
  it('flags a mismatched expected phase sequence', () => {
    const trace = makeTrace([
      { type: 'phase_transition', from: 'idle', to: 'green' },
      { type: 'phase_transition', from: 'green', to: 'complete' },
    ])

    const task = makeTask({
      validation: {
        timeout_seconds: 60,
        deterministic_checks: [],
        fsm_assertions: {
          strict_phase_order: true,
          allow_write_in_red: false,
          expected_phase_sequence: ['red', 'green', 'audit', 'complete'],
        },
      },
    })

    const result = MetricAggregator.aggregate(trace, task)
    expect(result.fsm.expected_sequence_matched).toBe(false)
    expect(result.passed).toBe(false)
  })

  it('flags a failed custom tool check', () => {
    const trace = makeTrace([
      {
        type: 'print',
        raw: {
          type: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'code_search',
          input: {},
        },
      },
    ])

    const task = makeTask({
      validation: {
        timeout_seconds: 60,
        deterministic_checks: [],
        custom_tool_checks: [
          { tool_name: 'code_search', expected_calls: '>=2' },
        ],
      },
    })

    const result = MetricAggregator.aggregate(trace, task)
    expect(result.custom_tools.passed).toBe(false)
    expect(result.passed).toBe(false)
  })
})

describe('evaluateExpectedCalls', () => {
  it('parses common expressions', () => {
    expect(evaluateExpectedCalls(2, '2')).toBe(true)
    expect(evaluateExpectedCalls(1, '2')).toBe(false)
    expect(evaluateExpectedCalls(3, '>=2')).toBe(true)
    expect(evaluateExpectedCalls(1, '>0')).toBe(true)
    expect(evaluateExpectedCalls(5, '<=5')).toBe(true)
    expect(evaluateExpectedCalls(4, '==4')).toBe(true)
    expect(evaluateExpectedCalls(4, '!=3')).toBe(true)
  })

  it('throws on malformed expressions', () => {
    expect(() => evaluateExpectedCalls(1, 'foo')).toThrow()
  })
})
