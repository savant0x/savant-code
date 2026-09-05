import { describe, expect, it } from 'bun:test'

import { MetricAggregator } from '../src/metrics'
import { computeFsmMetrics } from '../src/metrics-fsm'

import type { EchoPhase, TraceDocument } from '../src/runner'
import type { TaskDefinition, TrajectoryAssertion } from '../src/schema'

function makeTask(
  trajectoryAssertions: TrajectoryAssertion[] = [],
  expectedPhaseSequence?: string[],
): TaskDefinition {
  return {
    schema_version: '2.0',
    task_id: 'fsm-alignment-001',
    category: 'fsm_compliance',
    difficulty: 'medium',
    environment: { network_disabled: true },
    inputs: { prompt: 'governed run' },
    validation: {
      timeout_seconds: 60,
      deterministic_checks: [],
      trajectory_assertions: trajectoryAssertions,
      ...(expectedPhaseSequence
        ? {
            fsm_assertions: {
              strict_phase_order: true,
              allow_write_in_red: false,
              expected_phase_sequence: expectedPhaseSequence,
            },
          }
        : {}),
    },
  }
}

function makeTrace(
  events: TraceDocument['events'],
  currentPhase: EchoPhase = 'idle',
): TraceDocument {
  return {
    task_id: 'fsm-alignment-001',
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

function transition(
  from: EchoPhase,
  to: EchoPhase,
): TraceDocument['events'][number] {
  return { type: 'phase_transition', from, to }
}

function subagentStart(
  agentId: string,
  agentType: string,
): TraceDocument['events'][number] {
  return {
    type: 'print',
    raw: {
      type: 'subagent_start',
      agentId,
      agentType,
      displayName: agentType,
      onlyChild: false,
    },
  }
}

function toolCall(
  toolName: string,
  agentId?: string,
): TraceDocument['events'][number] {
  return {
    type: 'print',
    raw: {
      type: 'tool_call',
      toolCallId: `tc-${toolName}-${agentId ?? 'main'}`,
      toolName,
      input: {},
      ...(agentId !== undefined ? { agentId } : {}),
    },
  }
}

describe('FsmMetrics adversarial alignment (FID-2026-0824-014)', () => {
  it('scores an adversarial traversal as fully legal', () => {
    const trace = makeTrace([
      transition('idle', 'red'),
      transition('red', 'green'),
      transition('green', 'audit'),
      transition('audit', 'adversarial'),
      transition('adversarial', 'complete'),
    ])

    const result = computeFsmMetrics(trace, makeTask())
    expect(result.valid_transitions).toBe(5)
    expect(result.invalid_transitions).toBe(0)
    expect(result.strict_phase_order_passed).toBe(true)
  })

  it('accepts adversarial retreat to self_correct and its recovery path', () => {
    const trace = makeTrace([
      transition('idle', 'red'),
      transition('red', 'green'),
      transition('green', 'audit'),
      transition('audit', 'adversarial'),
      transition('adversarial', 'self_correct'),
      // Recovery completes from self_correct directly — this harness reserves
      // complete for audit/self_correct (green→complete is not an edge).
      transition('self_correct', 'complete'),
    ])

    const result = computeFsmMetrics(trace, makeTask())
    expect(result.valid_transitions).toBe(6)
    expect(result.invalid_transitions).toBe(0)
  })

  it('still rejects illegal edges into and out of adversarial', () => {
    const trace = makeTrace([
      transition('idle', 'adversarial'),
      transition('adversarial', 'red'),
    ])

    const result = computeFsmMetrics(trace, makeTask())
    expect(result.invalid_transitions).toBe(2)
    expect(result.strict_phase_order_passed).toBe(false)
  })
})

describe('trajectory_assertions enforcement (FID-2026-0824-014)', () => {
  const forgeNoTerminal = {
    agent_type: 'forge',
    denied_tools: ['run_terminal_command', 'spawn_agents'],
    required_tools: [] as string[],
  }

  const verifierRequireSearch: TrajectoryAssertion = {
    agent_type: 'verifier',
    denied_tools: ['write_file'],
    required_tools: ['code_search'],
  }

  it('counts a denied tool call by the matching agent', () => {
    const trace = makeTrace([
      subagentStart('forge-1', 'forge'),
      toolCall('run_terminal_command', 'forge-1'),
    ])

    const result = computeFsmMetrics(trace, makeTask([forgeNoTerminal]))
    expect(result.denied_tool_violations).toBe(1)
  })

  it('does not flag allowed forge tools', () => {
    const trace = makeTrace([
      subagentStart('forge-1', 'forge'),
      toolCall('code_search', 'forge-1'),
    ])

    const result = computeFsmMetrics(trace, makeTask([forgeNoTerminal]))
    expect(result.denied_tool_violations).toBe(0)
  })

  it('scopes denials per agent type — the main agent is unaffected', () => {
    const trace = makeTrace([toolCall('run_terminal_command')])

    const result = computeFsmMetrics(trace, makeTask([forgeNoTerminal]))
    expect(result.denied_tool_violations).toBe(0)
  })

  it('flags verifier writes while leaving the phase-based write counter untouched', () => {
    const verifierNoWrite: TrajectoryAssertion = {
      agent_type: 'verifier',
      denied_tools: ['write_file'],
      required_tools: [],
    }
    const trace = makeTrace([
      transition('idle', 'green'),
      subagentStart('verifier-1', 'verifier'),
      toolCall('write_file', 'verifier-1'),
    ])

    const result = computeFsmMetrics(trace, makeTask([verifierNoWrite]))
    expect(result.denied_tool_violations).toBe(1)
    // The write happened inside green — the ROLE channel fires, the PHASE
    // channel must stay silent (orthogonal axes).
    expect(result.write_in_red_violations).toBe(0)
  })

  it('reports required tools that no matching agent ever invoked', () => {
    const trace = makeTrace([subagentStart('verifier-1', 'verifier')])

    const result = computeFsmMetrics(trace, makeTask([verifierRequireSearch]))
    expect(result.required_tool_missing).toBe(1)
  })

  it('clears required tools when the matching agent invokes them', () => {
    const trace = makeTrace([
      subagentStart('verifier-1', 'verifier'),
      toolCall('code_search', 'verifier-1'),
    ])

    const result = computeFsmMetrics(trace, makeTask([verifierRequireSearch]))
    expect(result.required_tool_missing).toBe(0)
    expect(result.denied_tool_violations).toBe(0)
  })

  it('matches an expected phase sequence that includes adversarial', () => {
    const trace = makeTrace([
      transition('idle', 'red'),
      transition('red', 'green'),
      transition('green', 'audit'),
      transition('audit', 'adversarial'),
      transition('adversarial', 'complete'),
    ])

    const result = computeFsmMetrics(
      trace,
      makeTask([], ['red', 'green', 'audit', 'adversarial', 'complete']),
    )
    expect(result.expected_sequence_matched).toBe(true)
  })

  it('fails the aggregate report when a role denial fires', () => {
    const trace = makeTrace([
      subagentStart('forge-1', 'forge'),
      toolCall('spawn_agents', 'forge-1'),
    ])

    const report = MetricAggregator.aggregate(
      trace,
      makeTask([forgeNoTerminal]),
    )
    expect(report.fsm.denied_tool_violations).toBe(1)
    expect(report.passed).toBe(false)
  })
})
