import type { EnforcementState } from '../echo/types'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { AgentState } from '@savant-code/common/types/session-state'

/** Refresh per run/tool so model replacements cannot inherit stale identity. */
export function seedComplianceContext(
  state: EnforcementState,
  rootDir: string | undefined,
  template: Pick<AgentTemplate, 'model' | 'modelRoute' | 'id'>,
  agent: Pick<AgentState, 'agentId' | 'runId'>,
): void {
  state.telemetryRootDir = rootDir
  state.telemetryIdentity = {
    model: template.model,
    provider: template.modelRoute?.providerId ?? '',
    sessionId: agent.runId ?? agent.agentId,
    agentRole: template.id,
  }
}
