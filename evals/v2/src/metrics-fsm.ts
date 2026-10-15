import type { EchoPhase, TraceDocument, TraceEvent } from './runner'
import type { TaskDefinition } from './schema'

const VALID_TRANSITIONS: Record<EchoPhase, EchoPhase[]> = {
  idle: ['red', 'green'],
  red: ['green', 'idle'],
  green: ['audit', 'idle'],
  audit: ['self_correct', 'complete', 'idle', 'adversarial'],
  adversarial: ['complete', 'self_correct', 'idle'],
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
  /** Tool calls matching an agent_type's denied_tools assertion (FID-2026-0824-014). */
  denied_tool_violations: number
  /** Required_tools entries never invoked by a matching agent (end-of-run check). */
  required_tool_missing: number
}

function normalizePhase(value: string): EchoPhase | undefined {
  const lower = value.toLowerCase()
  if (
    lower === 'idle' ||
    lower === 'red' ||
    lower === 'green' ||
    lower === 'audit' ||
    lower === 'adversarial' ||
    lower === 'self_correct' ||
    lower === 'complete'
  ) {
    return lower
  }
  return undefined
}

/** Compute the ECHO FSM metrics from a completed trace. */
export function computeFsmMetrics(
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
    denied_tool_violations: 0,
    required_tool_missing: 0,
  }

  const phaseSequence: EchoPhase[] = []
  const agentTypeById = new Map<string, string>()
  agentTypeById.set('main', 'base')
  // FID-2026-0824-014: additive per-agent separation-of-duties channel.
  const trajectoryAssertions = task.validation.trajectory_assertions ?? []
  const deniedByAgentType = new Map<string, Set<string>>()
  for (const assertion of trajectoryAssertions) {
    let denied = deniedByAgentType.get(assertion.agent_type)
    if (!denied) {
      denied = new Set<string>()
      deniedByAgentType.set(assertion.agent_type, denied)
    }
    for (const toolName of assertion.denied_tools) {
      denied.add(toolName)
    }
  }
  const toolsByAgentType = new Map<string, Set<string>>()

  for (const event of trace.events) {
    handleFsmEvent(
      event,
      metrics,
      phaseSequence,
      agentTypeById,
      deniedByAgentType,
      toolsByAgentType,
      task,
    )
  }

  // Required-tool assertions evaluate at END of run: every listed tool must
  // have been invoked by a matching agent at least once.
  for (const assertion of trajectoryAssertions) {
    const observed = toolsByAgentType.get(assertion.agent_type)
    for (const toolName of assertion.required_tools) {
      if (!observed?.has(toolName)) {
        metrics.required_tool_missing += 1
      }
    }
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

function handleFsmEvent(
  event: TraceEvent,
  metrics: FsmMetrics,
  phaseSequence: EchoPhase[],
  agentTypeById: Map<string, string>,
  deniedByAgentType: Map<string, Set<string>>,
  toolsByAgentType: Map<string, Set<string>>,
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
    const currentPhase = derivePhaseAtEvent(phaseSequence)
    const agentType = agentTypeById.get(event.raw.agentId ?? 'main') ?? 'base'
    let observedTools = toolsByAgentType.get(agentType)
    if (!observedTools) {
      observedTools = new Set<string>()
      toolsByAgentType.set(agentType, observedTools)
    }
    observedTools.add(toolName)
    // Role-based denial check — orthogonal to phase (separation of duties).
    if (deniedByAgentType.get(agentType)?.has(toolName)) {
      metrics.denied_tool_violations += 1
    }
    checkToolPermission(toolName, currentPhase, agentType, metrics, task)
  }
}

function derivePhaseAtEvent(phaseSequence: EchoPhase[]): EchoPhase {
  if (phaseSequence.length === 0) {
    return 'idle'
  }
  return phaseSequence[phaseSequence.length - 1]
}

function checkToolPermission(
  toolName: string,
  currentPhase: EchoPhase,
  agentType: string,
  metrics: FsmMetrics,
  task: TaskDefinition,
): void {
  if (WRITE_TOOLS.has(toolName)) {
    const allowWriteInRed =
      task.validation.fsm_assertions?.allow_write_in_red ?? false
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
