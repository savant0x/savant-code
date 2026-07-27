import type { EchoPhase, TraceDocument, TraceEvent } from './runner'
import type { TaskDefinition } from './schema'

const VALID_TRANSITIONS: Record<EchoPhase, EchoPhase[]> = {
  idle: ['red', 'green'],
  red: ['green', 'idle'],
  green: ['audit', 'idle'],
  audit: ['self_correct', 'complete', 'idle'],
  self_correct: ['green', 'complete', 'idle'],
  complete: ['idle'],
  unknown: [],
}

const WRITE_TOOLS = new Set(['write_file', 'str_replace', 'apply_patch'])

/** Phases in which terminal commands are permitted. */
const TERMINAL_COMMAND_PHASES = new Set<EchoPhase>(['audit', 'green'])

/** Phases in which write tools are permitted. */
const WRITE_PHASES = new Set<EchoPhase>(['green', 'self_correct'])

export interface FsmMetrics {
  /** Number of observed phase transitions that conform to the ECHO FSM. */
  valid_transitions: number
  /** Number of observed phase transitions that violate the ECHO FSM. */
  invalid_transitions: number
  /** True if there were no invalid transitions. */
  strict_phase_order_passed: boolean
  /** True if the actual phase sequence matches the expected sequence (if defined). */
  expected_sequence_matched: boolean
  /** Number of write-tool calls made outside green/self_correct. */
  write_in_red_violations: number
  /** Number of run_terminal_command calls made outside audit/green. */
  terminal_command_violations: number
  /** Number of sequentialthinking calls made by a non-thinker agent. */
  sequentialthinking_violations: number
}

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
export function evaluateExpectedCalls(actual: number, expected: string): boolean {
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

function normalizePhase(value: string): EchoPhase | undefined {
  const lower = value.toLowerCase()
  if (
    lower === 'idle' ||
    lower === 'red' ||
    lower === 'green' ||
    lower === 'audit' ||
    lower === 'self_correct' ||
    lower === 'complete'
  ) {
    return lower
  }
  return undefined
}

export class MetricAggregator {
  /**
   * Compute the full metric report from a completed trace.
   *
   * @param trace The trace document produced by the runner.
   * @param task The task definition used to drive the run.
   */
  static aggregate(trace: TraceDocument, task: TaskDefinition): MetricReport {
    const fsm = this.computeFsmMetrics(trace, task)
    const subagent = this.computeSubagentMetrics(trace, task)
    const customTools = this.computeCustomToolMetrics(trace, task)

    const passed =
      fsm.strict_phase_order_passed &&
      fsm.expected_sequence_matched &&
      fsm.invalid_transitions === 0 &&
      fsm.write_in_red_violations === 0 &&
      fsm.terminal_command_violations === 0 &&
      fsm.sequentialthinking_violations === 0 &&
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

  private static computeFsmMetrics(
    trace: TraceDocument,
    task: TaskDefinition,
  ): FsmMetrics {
    const metrics: FsmMetrics = {
      valid_transitions: 0,
      invalid_transitions: 0,
      strict_phase_order_passed: true,
      expected_sequence_matched: true,
      write_in_red_violations: 0,
      terminal_command_violations: 0,
      sequentialthinking_violations: 0,
    }

    const phaseSequence: EchoPhase[] = []
    const agentTypeById = new Map<string, string>()
    agentTypeById.set('main', 'base')

    for (const event of trace.events) {
      this.handleFsmEvent(event, metrics, phaseSequence, agentTypeById, task)
    }

    const expected = task.validation.fsm_assertions?.expected_phase_sequence
    if (expected && expected.length > 0) {
      const normalizedExpected = expected
        .map((p) => normalizePhase(p))
        .filter((p): p is EchoPhase => p !== undefined)
      metrics.expected_sequence_matched =
        normalizedExpected.length === phaseSequence.length &&
        normalizedExpected.every((phase, index) => phaseSequence[index] === phase)
    }

    return metrics
  }

  private static handleFsmEvent(
    event: TraceEvent,
    metrics: FsmMetrics,
    phaseSequence: EchoPhase[],
    agentTypeById: Map<string, string>,
    task: TaskDefinition,
  ): void {
    if (event.type === 'phase_transition') {
      const allowed = VALID_TRANSITIONS[event.from] ?? []
      if (allowed.includes(event.to)) {
        metrics.valid_transitions += 1
      } else {
        metrics.invalid_transitions += 1
        metrics.strict_phase_order_passed = false
      }
      phaseSequence.push(event.to)
    }

    if (event.type === 'print' && event.raw.type === 'subagent_start') {
      agentTypeById.set(event.raw.agentId, event.raw.agentType)
    }

    if (event.type === 'print' && event.raw.type === 'tool_call') {
      const toolName = event.raw.toolName
      const currentPhase = this.derivePhaseAtEvent(phaseSequence)
      const agentType = agentTypeById.get(event.raw.agentId ?? 'main') ?? 'base'
      this.checkToolPermission(
        toolName,
        currentPhase,
        agentType,
        metrics,
        task,
      )
    }
  }

  private static derivePhaseAtEvent(phaseSequence: EchoPhase[]): EchoPhase {
    if (phaseSequence.length === 0) {
      return 'idle'
    }
    return phaseSequence[phaseSequence.length - 1]
  }

  private static checkToolPermission(
    toolName: string,
    currentPhase: EchoPhase,
    agentType: string,
    metrics: FsmMetrics,
    task: TaskDefinition,
  ): void {
    if (WRITE_TOOLS.has(toolName)) {
      const allowWriteInRed = task.validation.fsm_assertions?.allow_write_in_red ?? false
      if (!WRITE_PHASES.has(currentPhase)) {
        if (currentPhase === 'red' && allowWriteInRed) {
          // Explicitly allowed by the task.
          return
        }
        metrics.write_in_red_violations += 1
      }
    }

    if (toolName === 'run_terminal_command') {
      if (!TERMINAL_COMMAND_PHASES.has(currentPhase)) {
        metrics.terminal_command_violations += 1
      }
    }

    if (toolName === 'sequentialthinking') {
      if (!agentType.startsWith('thinker')) {
        metrics.sequentialthinking_violations += 1
      }
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

    const metCount = required.filter((agent) => distinctAgentTypes.has(agent)).length
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
