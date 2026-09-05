import { buildProtocolRefreshSummary } from '../protocol-summary'
import {
  CONDENSED_REFRESH_USER_TURNS,
  MAX_ACTIVE_MS_WITHOUT_REFRESH,
  MAX_INTERNAL_STEPS_WITHOUT_REFRESH,
} from './constants'

import type { EnforcementSelf } from './self'

/** Refresh cadence constants (moved verbatim from `echo/enforcement.ts`). */
export {
  CONDENSED_REFRESH_USER_TURNS,
  MAX_ACTIVE_MS_WITHOUT_REFRESH,
  MAX_INTERNAL_STEPS_WITHOUT_REFRESH,
}

/**
 * Advances the bounded internal-step safety backstop. Logical user turns
 * are recorded separately at the outer run boundary.
 */
export function applyStepBoundaryRefresh(self: EnforcementSelf): {
  refreshText?: string
} {
  self.internalStepsSinceRefresh++
  if (self.agentState?.groundingCheckpoint) {
    self.agentState.groundingCheckpoint.internalStepsSinceRefresh =
      self.internalStepsSinceRefresh
  }
  if (!self.state.protocolRead || !self.gateArmed) return {}

  const checkpoint = self.ensureCheckpoint()
  const now = Date.now()
  const lastRefreshTurn = checkpoint?.lastRefreshTurn ?? self.lastRefreshTurn
  const turnsSinceRefresh = self.state.turnCount - lastRefreshTurn
  const cadenceDue = turnsSinceRefresh >= CONDENSED_REFRESH_USER_TURNS
  const backstopDue =
    self.internalStepsSinceRefresh >= MAX_INTERNAL_STEPS_WITHOUT_REFRESH ||
    (self.lastRefreshAtMs !== null &&
      now - self.lastRefreshAtMs >= MAX_ACTIVE_MS_WITHOUT_REFRESH)
  // Backstop freshness is independent of the five-turn cadence. A single
  // long/tool-heavy logical turn must be able to refresh immediately after a
  // cadence refresh; the epoch below still makes the same trigger idempotent.
  if (!(cadenceDue || backstopDue)) return {}

  const reason = cadenceDue ? 'cadence' : 'backstop'
  const epoch = `${checkpoint?.groundingSetFingerprint ?? 'unknown'}:${self.state.turnCount}:${reason}`
  if (checkpoint?.lastRefreshEpoch === epoch) return {}

  self.internalStepsSinceRefresh = 0
  self.lastRefreshAtMs = now
  self.lastRefreshTurn = self.state.turnCount
  self.lastRefreshEpoch = epoch
  if (checkpoint) {
    checkpoint.lastRefreshTurn = self.state.turnCount
    checkpoint.lastRefreshReason = reason
    checkpoint.lastRefreshEpoch = epoch
    checkpoint.lastRefreshAtMs = now
    checkpoint.internalStepsSinceRefresh = 0
  }
  return { refreshText: buildProtocolRefreshSummary() }
}

export function applyExplicitRefresh(
  self: EnforcementSelf,
  reason: 'contract-change' | 'explicit' | 'compaction',
): { refreshText?: string } {
  if (!self.state.protocolRead || !self.gateArmed) return {}
  const checkpoint = self.ensureCheckpoint()
  const fingerprint = checkpoint?.groundingSetFingerprint ?? 'unknown'
  const epoch = `${fingerprint}:${self.state.turnCount}:${reason}`
  if (
    checkpoint?.lastRefreshEpoch === epoch ||
    self.lastRefreshEpoch === epoch
  ) {
    return {}
  }

  const now = Date.now()
  self.internalStepsSinceRefresh = 0
  self.lastRefreshAtMs = now
  self.lastRefreshTurn = self.state.turnCount
  self.lastRefreshEpoch = epoch
  if (checkpoint) {
    checkpoint.lastRefreshTurn = self.state.turnCount
    checkpoint.lastRefreshReason = reason
    checkpoint.lastRefreshEpoch = epoch
    checkpoint.lastRefreshAtMs = now
    checkpoint.internalStepsSinceRefresh = 0
  }
  return { refreshText: buildProtocolRefreshSummary() }
}

export function applyHistoryReplacement(self: EnforcementSelf): {
  refreshText?: string
} {
  if (!self.state.protocolRead || !self.gateArmed) return {}
  const checkpoint = self.ensureCheckpoint()
  const now = Date.now()
  const fingerprint = checkpoint?.groundingSetFingerprint ?? 'unknown'
  const epoch = `${fingerprint}:${self.state.turnCount}:compaction:replacement:${now}`
  self.internalStepsSinceRefresh = 0
  self.lastRefreshAtMs = now
  self.lastRefreshTurn = self.state.turnCount
  self.lastRefreshEpoch = epoch
  if (checkpoint) {
    checkpoint.lastRefreshTurn = self.state.turnCount
    checkpoint.lastRefreshReason = 'compaction'
    checkpoint.lastRefreshEpoch = epoch
    checkpoint.lastRefreshAtMs = now
    checkpoint.internalStepsSinceRefresh = 0
  }
  return { refreshText: buildProtocolRefreshSummary() }
}
