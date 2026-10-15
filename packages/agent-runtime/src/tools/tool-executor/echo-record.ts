import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-0804-009: records read / spawn / verification activity on the
 * run's ECHO compliance tracker so Law 1 bookkeeping and the mechanical
 * Verifier criteria see the full run picture.
 */
export function recordEchoComplianceActivity(params: {
  echoCompliance: NonNullable<AgentState['echoCompliance']>
  toolName: string
  effectiveInput: Record<string, JSONValue>
}): void {
  const { echoCompliance, toolName, effectiveInput } = params

  if (toolName === 'read_files' || toolName === 'read_subtree') {
    const paths = Array.isArray(effectiveInput.paths)
      ? effectiveInput.paths.filter((p): p is string => typeof p === 'string')
      : typeof effectiveInput.paths === 'string'
        ? [effectiveInput.paths]
        : []
    echoCompliance.recordRead(paths)
  } else if (toolName === 'read_url') {
    if (typeof effectiveInput.url === 'string') {
      echoCompliance.recordRead([effectiveInput.url])
    }
  } else if (toolName === 'list_directory') {
    if (typeof effectiveInput.path === 'string') {
      echoCompliance.recordDirectoryRead(effectiveInput.path)
    }
  } else if (toolName === 'glob' || toolName === 'code_search') {
    const pattern =
      typeof effectiveInput.pattern === 'string'
        ? effectiveInput.pattern
        : undefined
    if (pattern) echoCompliance.recordPatternRead(pattern)
  } else if (
    toolName === 'run_terminal_command' ||
    toolName === 'run_readonly_command'
  ) {
    // Both terminal-command channels are first-class verification paths —
    // enforcement.ts credits verifiedFiles for both. The tracker must
    // agree, or it emits false Law 3 / verifier_criteria steering for
    // writes that were verified via the read-only channel
    // (FID-2026-0820-014 EC-3).
    if (typeof effectiveInput.command === 'string') {
      echoCompliance.recordVerification(effectiveInput.command)
    }
  } else if (toolName === 'spawn_agents') {
    const agents = Array.isArray(effectiveInput.agents)
      ? effectiveInput.agents
      : []
    for (const agent of agents) {
      if (
        agent &&
        typeof agent === 'object' &&
        'agent_type' in agent &&
        typeof (agent as { agent_type?: unknown }).agent_type === 'string'
      ) {
        echoCompliance.recordSpawn((agent as { agent_type: string }).agent_type)
      }
    }
  } else if (toolName === 'spawn_agent_inline') {
    if (typeof effectiveInput.agent_type === 'string') {
      echoCompliance.recordSpawn(effectiveInput.agent_type)
    }
  }
}
