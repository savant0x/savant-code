import { describe, it, expect } from 'bun:test'

import { MetricAggregator, evaluateExpectedCalls } from '../src/metrics'

import type { EchoPhase, TraceDocument } from '../src/runner'
import type { TaskDefinition } from '../src/schema'

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
  it('counts valid and invalid phase transitions', () => {
    const trace = makeTrace([
      { type: 'phase_transition', from: 'idle', to: 'red' },
      { type: 'phase_transition', from: 'red', to: 'green' },
      { type: 'phase_transition', from: 'green', to: 'audit' },
      { type: 'phase_transition', from: 'audit', to: 'complete' },
    ])

    const result = MetricAggregator.aggregate(trace, makeTask())
    expect(result.fsm.valid_transitions).toBe(4)
    expect(result.fsm.invalid_transitions).toBe(0)
    expect(result.fsm.strict_phase_order_passed).toBe(true)
    expect(result.passed).toBe(true)
  })

  it('flags invalid transitions', () => {
    const trace = makeTrace([
      { type: 'phase_transition', from: 'idle', to: 'green' },
      { type: 'phase_transition', from: 'green', to: 'red' },
    ])

    const result = MetricAggregator.aggregate(trace, makeTask())
    expect(result.fsm.valid_transitions).toBe(1)
    expect(result.fsm.invalid_transitions).toBe(1)
    expect(result.fsm.strict_phase_order_passed).toBe(false)
  })

  it('checks the expected phase sequence', () => {
    const trace = makeTrace([
      { type: 'phase_transition', from: 'idle', to: 'red' },
      { type: 'phase_transition', from: 'red', to: 'green' },
      { type: 'phase_transition', from: 'green', to: 'audit' },
      { type: 'phase_transition', from: 'audit', to: 'complete' },
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
    expect(result.fsm.expected_sequence_matched).toBe(true)
  })

  it('detects write tools in red phase', () => {
    const trace = makeTrace([
      { type: 'phase_transition', from: 'idle', to: 'red' },
      {
        type: 'print',
        raw: {
          type: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'write_file',
          input: {},
        },
      },
    ])

    const result = MetricAggregator.aggregate(trace, makeTask())
    expect(result.fsm.write_in_red_violations).toBe(1)
  })

  it('permits write tools in green phase', () => {
    const trace = makeTrace([
      { type: 'phase_transition', from: 'idle', to: 'green' },
      {
        type: 'print',
        raw: {
          type: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'str_replace',
          input: {},
        },
      },
    ])

    const result = MetricAggregator.aggregate(trace, makeTask())
    expect(result.fsm.write_in_red_violations).toBe(0)
  })

  it('permits write tools in red phase when explicitly allowed', () => {
    const trace = makeTrace([
      { type: 'phase_transition', from: 'idle', to: 'red' },
      {
        type: 'print',
        raw: {
          type: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'write_file',
          input: {},
        },
      },
    ])

    const task = makeTask({
      validation: {
        timeout_seconds: 60,
        deterministic_checks: [],
        fsm_assertions: {
          strict_phase_order: true,
          allow_write_in_red: true,
        },
      },
    })

    const result = MetricAggregator.aggregate(trace, task)
    expect(result.fsm.write_in_red_violations).toBe(0)
  })

  it('detects terminal commands outside audit/green', () => {
    const trace = makeTrace([
      { type: 'phase_transition', from: 'idle', to: 'red' },
      {
        type: 'print',
        raw: {
          type: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'run_terminal_command',
          input: {},
        },
      },
    ])

    const result = MetricAggregator.aggregate(trace, makeTask())
    expect(result.fsm.terminal_command_violations).toBe(1)
  })

  it('detects sequentialthinking by a non-thinker agent', () => {
    const trace = makeTrace([
      {
        type: 'print',
        raw: {
          type: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'sequentialthinking',
          input: {},
        },
      },
    ])

    const result = MetricAggregator.aggregate(trace, makeTask())
    expect(result.fsm.sequentialthinking_violations).toBe(1)
  })

  it('allows sequentialthinking by a thinker subagent', () => {
    const trace = makeTrace([
      {
        type: 'print',
        raw: {
          type: 'subagent_start',
          agentId: 'thinker-1',
          agentType: 'thinker-gemini',
          displayName: 'Thinker',
          onlyChild: false,
        },
      },
      {
        type: 'print',
        raw: {
          type: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'sequentialthinking',
          input: {},
          agentId: 'thinker-1',
        },
      },
    ])

    const result = MetricAggregator.aggregate(trace, makeTask())
    expect(result.fsm.sequentialthinking_violations).toBe(0)
  })

  it('computes subagent utilization', () => {
    const trace = makeTrace([
      {
        type: 'print',
        raw: {
          type: 'subagent_start',
          agentId: 'forge-1',
          agentType: 'forge',
          displayName: 'Forge',
          onlyChild: false,
        },
      },
    ])

    const task = makeTask({
      validation: {
        timeout_seconds: 60,
        deterministic_checks: [],
        fsm_assertions: {
          strict_phase_order: true,
          allow_write_in_red: false,
        },
        required_agents: ['forge', 'verifier'],
      },
    })

    const result = MetricAggregator.aggregate(trace, task)
    expect(result.subagent.distinct_agent_types_spawned).toEqual(['forge'])
    expect(result.subagent.utilization_passed).toBe(false)
    expect(result.subagent.utilization_ratio).toBe(0.5)
  })

  it('evaluates custom tool checks', () => {
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
          { tool_name: 'code_search', expected_calls: '==1' },
        ],
      },
    })

    const result = MetricAggregator.aggregate(trace, task)
    expect(result.custom_tools.passed).toBe(true)
    expect(result.custom_tools.checks[0].actual_calls).toBe(1)
  })

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
