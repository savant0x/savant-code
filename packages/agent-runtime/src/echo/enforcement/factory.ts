/**
 * Shared enforcement factory (FID-2026-0810-002 Change 4). Creates the
 * main-agent EchoEnforcement instance eagerly at loop start so `protocolRead`
 * state exists before the first step — a text-only first turn can no longer
 * bypass the gate by never triggering lazy construction. Subagents inherit the
 * parent's read via `protocolPreSeeded`; gate arming follows the resolved boot
 * contract (`agentState.protocolFile`), never a seeded bypass.
 */
import { EchoEnforcement } from '../enforcement'
import { resolveEnforcementMode } from './helpers'

import type { DesignContract } from '@savant-code/common/types/design-system'
import type { AgentState } from '@savant-code/common/types/session-state'

const enforcementInstances = new WeakMap<object, EchoEnforcement>()

export interface EchoEnforcementOptions {
  /** Protocol file the session-init gate requires (default `ECHO.md`). */
  protocolFile?: string
  /** Active declarative design contract for visual-write scanning. */
  designContract?: DesignContract
  /** Current serializable state to restore and synchronize. */
  agentState?: AgentState
  /**
   * FID-2026-0806-005: seed the session-init gate as already satisfied.
   * Subagents spawned by a compliant parent inherit the parent's read.
   */
  protocolPreSeeded?: boolean
  /**
   * FID-2026-0810-002 Change 3: arm the session-init gate. Universal — no
   * longer gated on strict mode. The shared factory passes
   * `Boolean(agentState.protocolFile)`, so CLI harness sessions (which always
   * resolve a boot contract) gate in every mode while SDK embedders with no
   * protocol variant keep legacy no-gate behavior. Defaults to true for
   * direct constructions (the historical strict-mode contract).
   */
  gateArmed?: boolean
}

export function getOrCreateEnforcement(
  agentState: AgentState,
): EchoEnforcement {
  const existing = enforcementInstances.get(agentState)
  if (existing) return existing
  const enforcement = new EchoEnforcement(
    resolveEnforcementMode(agentState.enforcementMode),
    {
      protocolFile: agentState.protocolFile,
      protocolPreSeeded: Boolean(agentState.parentId),
      gateArmed: Boolean(agentState.protocolFile),
      designContract: agentState.designContract,
      agentState,
    },
  )
  enforcementInstances.set(agentState, enforcement)
  return enforcement
}
