import type { AdvisoryLogger } from '../advisory-logger'
import type { createEnforcementState } from '../enforcement-state'
import type { AdvisoryWarning, EnforcementMode } from '../types'
import type { DesignContract } from '@savant-code/common/types/design-system'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Live internal shape of `EchoEnforcement` shared with the extracted
 * `enforcement/` modules (FID-2026-0819-005 Loop 303). The class satisfies
 * this structurally.
 */
export type EnforcementSelf = {
  pendingSteering: AdvisoryWarning[]
  steeredKeys: Set<string>
  steeringCount: number
  steeringPerLaw: Map<number, number>
  state: ReturnType<typeof createEnforcementState>
  logger: AdvisoryLogger
  mode: EnforcementMode
  requiredProtocolFile: string
  gateArmed: boolean
  designContract?: DesignContract
  readonly agentState?: AgentState
  lastRefreshAtMs: number | null
  lastRefreshTurn: number
  lastRefreshEpoch: string | null
  internalStepsSinceRefresh: number
  groundingReadPending: boolean
  isGroundingReadCall(toolName: string, input: Record<string, unknown>): boolean
  syncCheckpoint(): void
  ensureCheckpoint(): AgentState['groundingCheckpoint']
}
