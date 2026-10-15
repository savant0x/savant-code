import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

export type ExecutionPolicy = {
  allowCapabilityOverride: boolean
  allowFsmOverride: boolean
  allowSandboxOverride: boolean
}

/**
 * Resolve non-protocol development conveniences at the execution boundary.
 *
 * EHEL is intentionally absent: protocol enforcement is always authoritative.
 * A development override is valid only for an explicitly non-strict harness
 * session; strict and single-agent contracts fail closed even when a caller
 * supplies `devMode: true`.
 */
export function resolveExecutionPolicy(params: {
  fileContext: Pick<ProjectFileContext, 'devMode'>
  agentState: Pick<AgentState, 'protocolStrictMode' | 'protocolVariant'>
}): ExecutionPolicy {
  const developmentOverrideAllowed =
    params.fileContext.devMode === true &&
    params.agentState.protocolStrictMode === false &&
    params.agentState.protocolVariant === 'harness'

  return {
    allowCapabilityOverride: developmentOverrideAllowed,
    allowFsmOverride: developmentOverrideAllowed,
    allowSandboxOverride: developmentOverrideAllowed,
  }
}
