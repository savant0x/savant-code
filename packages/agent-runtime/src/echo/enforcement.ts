/**
 * Echo enforcement (Law 0-15 runtime) — class facade (FID-2026-0819-005
 * Loop 303). Tool pipelines live in `./enforcement/tool-pipeline`, turn-end
 * evaluation in `./enforcement/turn-end`, refresh cadence in
 * `./enforcement/refresh`, grounding-checkpoint ops in
 * `./enforcement/grounding-ops`, steering budget in `./enforcement/steering`,
 * and the shared factory in `./enforcement/factory`. Public surface unchanged;
 * instance fields are package-visible so the extracted modules can operate on
 * the live instance through the `EnforcementSelf` structural contract.
 */
import { AdvisoryLogger } from './advisory-logger'
import {
  ensureCheckpointOp,
  isGroundingCompleteOp,
  isGroundingReadCallOp,
  recordGroundingReadsOp,
  syncCheckpointOp,
} from './enforcement/grounding-ops'
import {
  applyExplicitRefresh,
  applyHistoryReplacement,
  applyStepBoundaryRefresh,
} from './enforcement/refresh'
import { drainSteeringMessages } from './enforcement/steering'
import {
  afterToolCallImpl,
  beforeToolCallImpl,
} from './enforcement/tool-pipeline'
import {
  evaluateTurnEndImpl,
  evaluateUngroundedTurnEndImpl,
} from './enforcement/turn-end'
import { createEnforcementState } from './enforcement-state'
import { createGroundingCheckpoint, isAgentGrounded } from './grounding'

import type { EchoEnforcementOptions } from './enforcement/factory'
import type {
  AdvisoryWarning,
  EnforcementMode,
  EnforcementResult,
} from './types'
import type { DesignContract } from '@savant-code/common/types/design-system'
import type { AgentState } from '@savant-code/common/types/session-state'

export { getOrCreateEnforcement } from './enforcement/factory'
export type { EchoEnforcementOptions } from './enforcement/factory'
export {
  COMPLETION_GATE_MAX_RETRIES,
  resolveEnforcementMode,
} from './enforcement/helpers'
export {
  CONDENSED_REFRESH_USER_TURNS,
  MAX_ACTIVE_MS_WITHOUT_REFRESH,
  MAX_INTERNAL_STEPS_WITHOUT_REFRESH,
} from './enforcement/constants'

export class EchoEnforcement {
  state = createEnforcementState()
  logger = new AdvisoryLogger()
  mode: EnforcementMode
  requiredProtocolFile: string
  gateArmed: boolean
  designContract?: DesignContract
  readonly agentState?: AgentState
  lastRefreshAtMs: number | null = null
  lastRefreshTurn = 0
  lastRefreshEpoch: string | null = null
  internalStepsSinceRefresh = 0
  groundingReadPending = false

  // Steering budget (mirrors the tracker's FID-2026-0804-009 budgeting): a
  // blocked pre-write advisory (Law 7/8) collects corrective text that the
  // tool executor injects into the agent's message history so the running
  // agent knows what to do next — bounded, deduped per law+file, so a
  // non-compliant agent is nudged a couple of times, never looped.
  pendingSteering: AdvisoryWarning[] = []
  steeredKeys = new Set<string>()
  steeringCount = 0
  readonly steeringPerLaw = new Map<number, number>()

  constructor(mode: EnforcementMode, options: EchoEnforcementOptions = {}) {
    this.mode = mode
    this.requiredProtocolFile = options.protocolFile ?? 'ECHO.md'
    this.gateArmed = options.gateArmed ?? true
    this.designContract = options.designContract
    this.agentState = options.agentState
    if (this.agentState) {
      const checkpoint = this.agentState.groundingCheckpoint
      if (checkpoint && isAgentGrounded(this.agentState)) {
        this.state.protocolRead = true
        this.state.turnCount = checkpoint.logicalUserTurnCount
        this.lastRefreshAtMs = checkpoint.lastRefreshAtMs ?? null
        this.lastRefreshTurn = checkpoint.lastRefreshTurn ?? 0
        this.lastRefreshEpoch = checkpoint.lastRefreshEpoch ?? null
        this.internalStepsSinceRefresh =
          checkpoint.internalStepsSinceRefresh ?? 0
        this.state.completionGateRetries = checkpoint.completionGateRetries
        this.state.completionGateDisarmed = checkpoint.completionGateDisarmed
      } else if (this.gateArmed) {
        this.agentState.groundingCheckpoint = createGroundingCheckpoint(
          this.agentState,
        )
      }
    }
    // FID-2026-0806-005: subagents inherit the parent's protocol read.
    if (options.protocolPreSeeded === true) {
      this.state.protocolRead = true
    }
  }

  beforeToolCall(params: {
    toolName: string
    input: Record<string, unknown>
    agentId: string
    /** FID-2026-0822-004: the agent's assistant TEXT so far in this step —
     *  threaded to the P5b YAGNI gate (text channel). */
    assistantText?: string
    /** FID-2026-0822-004: `yagni.enforced: false` disables the P5b gate. */
    yagniEnforced?: boolean
  }): EnforcementResult {
    return beforeToolCallImpl(
      this,
      params.toolName,
      params.input,
      params.agentId,
      params.assistantText,
      params.yagniEnforced,
    )
  }

  afterToolCall(params: {
    toolName: string
    input: Record<string, unknown>
    result: { text?: string; error?: string }
    writtenContent?: string
    writeSucceeded?: boolean
  }): EnforcementResult {
    return afterToolCallImpl(
      this,
      params.toolName,
      params.input,
      params.result,
      params.writtenContent,
      params.writeSucceeded,
    )
  }

  evaluateTurnEnd(): { blocked: boolean; report: string } {
    return evaluateTurnEndImpl(this)
  }

  /**
   * Advances the bounded internal-step safety backstop. Logical user turns
   * are recorded separately at the outer run boundary.
   */
  onStepBoundary(): { refreshText?: string } {
    return applyStepBoundaryRefresh(this)
  }

  /** Count one completed logical user turn; internal loop steps do not count. */
  recordLogicalUserTurn(): { refreshText?: string } {
    this.state.turnCount++
    const checkpoint = this.ensureCheckpoint()
    if (checkpoint) {
      checkpoint.logicalUserTurnCount = this.state.turnCount
    }
    return this.onStepBoundary()
  }

  /**
   * Request a refresh for an explicit operator/governance event or a detected
   * contract change. The event is idempotent for the current checkpoint epoch.
   */
  requestGroundingRefresh(
    reason: 'contract-change' | 'explicit' | 'compaction',
  ): { refreshText?: string } {
    return applyExplicitRefresh(this, reason)
  }

  /** Record a successful grounding-set read after its handler completed. */
  recordSuccessfulGroundingRead(paths: string[]): void {
    this.groundingReadPending = false
    if (!this.agentState) return
    recordGroundingReadsOp(this, paths)
    if (isGroundingCompleteOp(this)) {
      this.state.protocolRead = true
      this.syncCheckpoint()
    }
  }

  /**
   * FID-2026-0810-002 Change 5: first-turn completion gate. The loop calls
   * this when a MAIN agent would end its turn. While the protocol is unread
   * and the gate is armed, an ungrounded text-only completion is blocked:
   * corrective steering is returned for the loop to inject, and the loop
   * continues so the agent performs the boot reads. After
   * COMPLETION_GATE_MAX_RETRIES the completion gate disarms for the session
   * with a one-time notice (bounded — a model that never reads cannot wedge
   * the session or re-trigger steering on every subsequent message). The
   * tool-level gate (beforeToolCall) remains armed.
   */
  evaluateUngroundedTurnEnd(): {
    blocked: boolean
    steering?: string
    notice?: string
  } {
    return evaluateUngroundedTurnEndImpl(this)
  }

  isGroundingReadCall(
    toolName: string,
    input: Record<string, unknown>,
  ): boolean {
    return isGroundingReadCallOp(this, toolName, input)
  }

  syncCheckpoint(): void {
    syncCheckpointOp(this)
  }

  ensureCheckpoint(): AgentState['groundingCheckpoint'] {
    return ensureCheckpointOp(this)
  }

  /** Record that context compaction was requested before a history mutation. */
  recordCompaction(): { refreshText?: string } {
    return this.requestGroundingRefresh('compaction')
  }

  /**
   * Deliver a refresh after a history replacement has actually completed.
   * This bypasses the pre-compaction idempotency epoch because the replacement
   * may have discarded the refresh emitted before it.
   */
  recordHistoryReplacement(): { refreshText?: string } {
    return applyHistoryReplacement(this)
  }

  /**
   * Drain budgeted corrective steering messages for blocked pre-write
   * advisories (Law 7/8). Bounded per enforcement instance: at most
   * MAX_STEERING_TOTAL messages total, one per law (deduped per law+file).
   */
  takeSteeringMessages(): string[] {
    return drainSteeringMessages(this)
  }

  getState(): Readonly<ReturnType<typeof createEnforcementState>> {
    return this.state
  }

  setDesignContract(contract: DesignContract | undefined): void {
    this.designContract = contract
  }

  getMode(): EnforcementMode {
    return this.mode
  }

  setMode(mode: EnforcementMode): void {
    this.mode = mode
  }
}
