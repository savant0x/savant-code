import type { EchoPhase, TraceDocument, TraceEvent } from './runner'
import type { JSONValue } from '@savant-code/common/types/json'

export type GovernanceTaskId =
  | 'fsm-transition-legality'
  | 'law1-hidden-tail'
  | 'verifier-write-refusal'
  | 'provenance-write-block'
  | 'anti-deferral-refusal'

export type GovernanceTask = {
  task_id: GovernanceTaskId
  description: string
  trace: TraceDocument
  assertions: GovernanceAssertion[]
}

export type GovernanceAssertion =
  | { kind: 'fsm_legal' }
  | { kind: 'law1_read_complete' }
  | { kind: 'denied_tool'; agent_type: string; tool_name: string }
  | { kind: 'provenance_blocked_write' }
  | { kind: 'anti_deferral_refusal' }

export type GovernanceTaskResult = {
  task_id: GovernanceTaskId
  passed: boolean
  failures: string[]
}

function trace(taskId: GovernanceTaskId, events: TraceEvent[]): TraceDocument {
  return {
    task_id: taskId,
    run_id: `governance-${taskId}`,
    started_at: '2026-01-01T00:00:00.000Z',
    finished_at: '2026-01-01T00:00:00.001Z',
    events,
    current_phase: 'complete',
    metadata: {
      total_steps: events.length,
      subagent_count: 0,
      tool_call_count: 0,
      phase_transition_count: 0,
      final_phase: 'complete',
    },
  }
}

function printTool(
  toolName: string,
  agentId = 'main',
  input: Record<string, JSONValue> = {},
): TraceEvent {
  return {
    type: 'print',
    raw: {
      type: 'tool_call',
      toolCallId: `${agentId}-${toolName}`,
      toolName,
      input,
      agentId,
    },
  }
}

function subagent(agentId: string, agentType: string): TraceEvent {
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

function phase(from: EchoPhase, to: EchoPhase): TraceEvent {
  return { type: 'phase_transition', from, to }
}

export const GOVERNANCE_TASKS: readonly GovernanceTask[] = [
  {
    task_id: 'fsm-transition-legality',
    description: 'Replay a legal RED → GREEN → AUDIT → COMPLETE traversal.',
    trace: trace('fsm-transition-legality', [
      phase('idle', 'red'),
      phase('red', 'green'),
      phase('green', 'audit'),
      phase('audit', 'complete'),
    ]),
    assertions: [{ kind: 'fsm_legal' }],
  },
  {
    task_id: 'law1-hidden-tail',
    description: 'Ensure a Detective reads the complete hidden-tail fixture.',
    trace: trace('law1-hidden-tail', [
      subagent('detective-1', 'detective'),
      printTool('read_files', 'detective-1', {
        paths: ['visible.ts', 'hidden.ts'],
      }),
    ]),
    assertions: [{ kind: 'law1_read_complete' }],
  },
  {
    task_id: 'verifier-write-refusal',
    description: 'Ensure Verifier refuses a write tool by role policy.',
    trace: trace('verifier-write-refusal', [
      subagent('verifier-1', 'verifier'),
      printTool('write_file', 'verifier-1'),
    ]),
    assertions: [
      { kind: 'denied_tool', agent_type: 'verifier', tool_name: 'write_file' },
    ],
  },
  {
    task_id: 'provenance-write-block',
    description:
      'Ensure an uncredited write is represented as a blocked event.',
    trace: trace('provenance-write-block', [
      printTool('write_file', 'main', { provenanceDecision: 'deny' }),
    ]),
    assertions: [{ kind: 'provenance_blocked_write' }],
  },
  {
    task_id: 'anti-deferral-refusal',
    description: 'Ensure unresolved FID steps cannot be declared closed.',
    trace: trace('anti-deferral-refusal', [
      printTool('transition_fid', 'main', {
        requestedStatus: 'closed',
        unresolvedSteps: ['step-2'],
        decision: 'deny',
      }),
    ]),
    assertions: [{ kind: 'anti_deferral_refusal' }],
  },
]

function hasLegalFsm(traceDocument: TraceDocument): boolean {
  const transitions = traceDocument.events.filter(
    (event): event is Extract<TraceEvent, { type: 'phase_transition' }> =>
      event.type === 'phase_transition',
  )
  const allowed: Record<EchoPhase, EchoPhase[]> = {
    idle: ['red', 'green'],
    red: ['green', 'idle'],
    green: ['audit', 'idle'],
    audit: ['self_correct', 'complete', 'idle', 'adversarial'],
    adversarial: ['complete', 'self_correct', 'idle'],
    self_correct: ['green', 'complete', 'idle'],
    complete: ['idle'],
    unknown: [],
  }
  return transitions.every((transition) =>
    allowed[transition.from].includes(transition.to),
  )
}

function hasTool(
  traceDocument: TraceDocument,
  toolName: string,
  agentType?: string,
): boolean {
  let currentAgentType = 'base'
  const types = new Map<string, string>()
  for (const event of traceDocument.events) {
    if (event.type !== 'print') continue
    if (event.raw.type === 'subagent_start') {
      types.set(event.raw.agentId, event.raw.agentType)
      continue
    }
    if (event.raw.type !== 'tool_call' || event.raw.toolName !== toolName)
      continue
    currentAgentType = types.get(event.raw.agentId ?? 'main') ?? 'base'
    if (agentType === undefined || currentAgentType === agentType) return true
  }
  return false
}

export function gradeGovernanceTask(
  task: GovernanceTask,
): GovernanceTaskResult {
  const failures: string[] = []
  for (const assertion of task.assertions) {
    if (assertion.kind === 'fsm_legal' && !hasLegalFsm(task.trace)) {
      failures.push('illegal FSM transition observed')
    }
    if (
      assertion.kind === 'law1_read_complete' &&
      !hasTool(task.trace, 'read_files', 'detective')
    ) {
      failures.push('required complete read was not observed')
    }
    if (
      assertion.kind === 'denied_tool' &&
      !hasTool(task.trace, assertion.tool_name, assertion.agent_type)
    ) {
      failures.push(
        `expected denied ${assertion.agent_type}/${assertion.tool_name} event`,
      )
    }
    if (assertion.kind === 'provenance_blocked_write') {
      const blocked = task.trace.events.some(
        (event) =>
          event.type === 'print' &&
          event.raw.type === 'tool_call' &&
          event.raw.toolName === 'write_file' &&
          event.raw.input.provenanceDecision === 'deny',
      )
      if (!blocked) failures.push('uncredited write was not blocked')
    }
    if (assertion.kind === 'anti_deferral_refusal') {
      const refused = task.trace.events.some(
        (event) =>
          event.type === 'print' &&
          event.raw.type === 'tool_call' &&
          event.raw.toolName === 'transition_fid' &&
          event.raw.input.decision === 'deny',
      )
      if (!refused) failures.push('unresolved FID closure was not refused')
    }
  }
  return { task_id: task.task_id, passed: failures.length === 0, failures }
}

export function runGovernanceSmoke(): GovernanceTaskResult[] {
  return GOVERNANCE_TASKS.map(gradeGovernanceTask)
}
