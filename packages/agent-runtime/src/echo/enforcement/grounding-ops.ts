/**
 * Grounding-checkpoint operations shared by the `EchoEnforcement` class and
 * the extracted `enforcement/` modules (FID-2026-0819-005 Loop 303: extracted
 * verbatim from `echo/enforcement.ts`; `this.` → `self.`).
 */
import {
  createGroundingCheckpoint,
  getRequiredGroundingPaths,
  normalizeGroundingPath,
} from '../grounding'
import { extractPaths } from './helpers'

import type { EnforcementSelf } from './self'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Detect a grounding-set read call. With no `agentState` (SDK embedders) the
 * required set is the protocol file alone; otherwise the checkpoint's
 * required paths decide.
 */
export function isGroundingReadCallOp(
  self: EnforcementSelf,
  toolName: string,
  input: Record<string, unknown>,
): boolean {
  if (toolName !== 'read_files') {
    return false
  }
  if (!self.agentState) {
    const target = normalizeGroundingPath(self.requiredProtocolFile)
    return extractPaths(input).some(
      (p) => normalizeGroundingPath(String(p)) === target,
    )
  }
  const required = new Set(getRequiredGroundingPaths(self.agentState))
  return extractPaths(input).some((p) =>
    required.has(normalizeGroundingPath(String(p))),
  )
}

/** Record completed grounding reads into the checkpoint (sorted, deduped). */
export function recordGroundingReadsOp(
  self: EnforcementSelf,
  paths: string[],
): void {
  const checkpoint = self.ensureCheckpoint()
  if (!checkpoint) return
  const required = new Set(checkpoint.requiredPaths)
  for (const filePath of paths.map(normalizeGroundingPath)) {
    if (
      required.has(filePath) &&
      !checkpoint.completedPaths.includes(filePath)
    ) {
      checkpoint.completedPaths.push(filePath)
    }
  }
  checkpoint.completedPaths.sort()
}

/** True when the checkpoint's completed set equals its required set. */
export function isGroundingCompleteOp(self: EnforcementSelf): boolean {
  const checkpoint = self.ensureCheckpoint()
  if (!checkpoint) return false
  const complete =
    checkpoint.completedPaths.length === checkpoint.requiredPaths.length &&
    checkpoint.completedPaths.every(
      (path, index) => path === checkpoint.requiredPaths[index],
    )
  if (complete) {
    checkpoint.fullGroundingCompleted = true
    checkpoint.lastFullGroundingTurn = checkpoint.logicalUserTurnCount
    checkpoint.completionGateRetries = self.state.completionGateRetries
    checkpoint.completionGateDisarmed = self.state.completionGateDisarmed
  }
  return complete
}

/** Mirror enforcement state into the grounding checkpoint. */
export function syncCheckpointOp(self: EnforcementSelf): void {
  const checkpoint = self.ensureCheckpoint()
  if (!checkpoint) return
  checkpoint.completionGateRetries = self.state.completionGateRetries
  checkpoint.completionGateDisarmed = self.state.completionGateDisarmed
  checkpoint.logicalUserTurnCount = self.state.turnCount
  checkpoint.internalStepsSinceRefresh = self.internalStepsSinceRefresh
}

/** Lazily create the agent grounding checkpoint. */
export function ensureCheckpointOp(
  self: EnforcementSelf,
): AgentState['groundingCheckpoint'] {
  if (!self.agentState?.protocolFile) return undefined
  if (!self.agentState.groundingCheckpoint) {
    self.agentState.groundingCheckpoint = createGroundingCheckpoint(
      self.agentState,
    )
  }
  return self.agentState.groundingCheckpoint
}
