import { computeFsmMetrics, type FsmMetrics } from './metrics-fsm'

import type { TraceDocument } from './runner'
import type { TaskDefinition } from './schema'

export type { FsmMetrics } from './metrics-fsm'

export interface SubagentMetrics {
  distinct_agent_types_spawned: string[]
  /** Required agents from the task (if specified). */
  required_agents?: string[]
  /** True if every required agent was spawned at least once. */
  utilization_passed: boolean
  /** Ratio of required agents that were spawned (0..1). */
  utilization_ratio: number
}

export interface CustomToolCheckResult {
  tool_name: string
  expected_calls: string
  actual_calls: number
  passed: boolean
}

export interface CustomToolMetrics {
  checks: CustomToolCheckResult[]
  passed: boolean
}

export interface MetricReport {
  task_id: string
  run_id: string
  /** True if the run satisfied every FSM, subagent, and custom-tool assertion. */
  passed: boolean
  fsm: FsmMetrics
  subagent: SubagentMetrics
  custom_tools: CustomToolMetrics
}

/**
 * Parse the simple expected-calls DSL used in the task schema.
 *
 * Supported forms: "N", ">N", ">=N", "<N", "<=N", "==N", "!=N".
 */
export function evaluateExpectedCalls(
  actual: number,
  expected: string,
): boolean {
  const normalized = expected.trim()
  const match = normalized.match(/^(>=|<=|==|!=|>|<)?(\d+)$/)
  if (!match) {
    throw new Error(`Invalid expected_calls expression: ${expected}`)
  }

  const operator = match[1] ?? '>='
  const value = Number.parseInt(match[2], 10)

  switch (operator) {
    case '>=':
      return actual >= value
    case '>':
      return actual > value
    case '<=':
      return actual <= value
    case '<':
      return actual < value
    case '==':
      return actual === value
    case '!=':
      return actual !== value
    default:
      return false
  }
}

export class MetricAggregator {
  /**
   * Compute the full metric report from a completed trace.
   *
   * @param trace The trace document produced by the runner.
   * @param task The task definition used to drive the run.
   */
  static aggregate(trace: TraceDocument, task: TaskDefinition): MetricReport {
    const fsm = computeFsmMetrics(trace, task)
    const subagent = this.computeSubagentMetrics(trace, task)
    const customTools = this.computeCustomToolMetrics(trace, task)

    const passed =
      fsm.strict_phase_order_passed &&
      fsm.expected_sequence_matched &&
      fsm.invalid_transitions === 0 &&
      fsm.write_in_red_violations === 0 &&
      fsm.terminal_command_violations === 0 &&
      fsm.sequentialthinking_violations === 0 &&
      fsm.denied_tool_violations === 0 &&
      fsm.required_tool_missing === 0 &&
      subagent.utilization_passed &&
      customTools.passed

    return {
      task_id: trace.task_id,
      run_id: trace.run_id,
      passed,
      fsm,
      subagent,
      custom_tools: customTools,
    }
  }

  private static computeSubagentMetrics(
    trace: TraceDocument,
    task: TaskDefinition,
  ): SubagentMetrics {
    const distinctAgentTypes = new Set<string>()
    for (const event of trace.events) {
      if (event.type === 'print' && event.raw.type === 'subagent_start') {
        distinctAgentTypes.add(event.raw.agentType)
      }
    }

    const spawned = Array.from(distinctAgentTypes)
    const required = task.validation.required_agents

    if (!required || required.length === 0) {
      return {
        distinct_agent_types_spawned: spawned,
        utilization_passed: true,
        utilization_ratio: 1,
      }
    }

    const metCount = required.filter((agent) =>
      distinctAgentTypes.has(agent),
    ).length
    return {
      distinct_agent_types_spawned: spawned,
      required_agents: required,
      utilization_passed: metCount === required.length,
      utilization_ratio: metCount / required.length,
    }
  }

  private static computeCustomToolMetrics(
    trace: TraceDocument,
    task: TaskDefinition,
  ): CustomToolMetrics {
    const checks = task.validation.custom_tool_checks ?? []
    if (checks.length === 0) {
      return { checks: [], passed: true }
    }

    const callCounts = new Map<string, number>()
    for (const event of trace.events) {
      if (event.type === 'print' && event.raw.type === 'tool_call') {
        const count = callCounts.get(event.raw.toolName) ?? 0
        callCounts.set(event.raw.toolName, count + 1)
      }
    }

    const results = checks.map((check) => {
      const actual = callCounts.get(check.tool_name) ?? 0
      const passed = evaluateExpectedCalls(actual, check.expected_calls)
      return {
        tool_name: check.tool_name,
        expected_calls: check.expected_calls,
        actual_calls: actual,
        passed,
      }
    })

    return {
      checks: results,
      passed: results.every((r) => r.passed),
    }
  }
}
