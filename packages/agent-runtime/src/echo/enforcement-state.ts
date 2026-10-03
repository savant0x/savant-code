/**
 * ECHO Harness Enforcement Layer (EHEL) — enforcement state management.
 *
 * FID-2026-0805-007: Creates and manages per-conversation enforcement
 * state. Each conversation gets its own state instance, reset at turn
 * boundaries for batch scanning.
 */

import type { EnforcementState } from './types'

/**
 * FID-2026-1001-003 step 3: durability cap for the Law 1 read-ledger mirror
 * (checkpoint `readLedger`). Bounded FIFO: once full, the oldest entry is
 * evicted on every insert. Reads are cheap to re-do; the ledger exists so a
 * session restore does not re-block Law 1 on already-read files — a bounded
 * recent window satisfies that contract without unbounded growth.
 */
export const MAX_READ_LEDGER = 512

/**
 * Create a fresh enforcement state for a new conversation.
 */
export function createEnforcementState(): EnforcementState {
  return {
    filesRead: new Set(),
    filesReadCanonical: new Map(),
    // FID-2026-1001-003 step 1: per-call mutation classification (cleared on
    // every beforeToolCall, consumed in afterToolCall).
    pendingMutation: null,
    filesWritten: new Set(),
    dirtyFiles: new Set(),
    writtenFileContent: new Map(),
    hasVerifiedSinceLastDirty: true,
    verifiedFiles: new Set(),
    failureAttributedFiles: new Set(),
    writeCount: 0,
    // FID-2026-1001-003 step 4: repeat-block escalation ladder (N=3) and its
    // turn-termination arm (see ./types.ts and ./enforcement/escalation.ts).
    blockStrikes: new Map(),
    turnTerminationArmed: false,
    featuresWired: new Set(),
    featuresVerified: new Set(),
    hasSearchedSinceGreen: false,
    intentLogged: false,
    fidFilesWritten: new Set(),
    // FID-2026-0806-005: session-init gate starts unread; turns start at 0.
    protocolRead: false,
    turnCount: 0,
    // FID-2026-0810-002 Change 5: completion gate starts unspent and armed.
    completionGateRetries: 0,
    completionGateDisarmed: false,
    advisoryWarnings: [],
    turnStartWriteCount: 0,
    // P5b (FID-2026-0806-003): YAGNI enforcement state, initially empty.
    yagni: {
      lastAssessment: null,
      speculativeWritesRejected: 0,
    },
  }
}

/**
 * Reset turn-specific counters at the start of a new turn.
 * Preserves cross-turn state (filesRead, filesWritten, etc.).
 */
export function resetForNewTurn(state: EnforcementState): void {
  state.turnStartWriteCount = state.writeCount
  state.dirtyFiles.clear()
  state.writtenFileContent.clear()
  state.verifiedFiles.clear()
  state.failureAttributedFiles.clear()
  state.hasVerifiedSinceLastDirty = true
  // FID-2026-1001-003 step 4: a terminated or cleanly-ended turn must not
  // inherit a stale arm (the strikes themselves are deliberately NOT reset
  // here — only a compliant read or verification resets the ladder).
  state.turnTerminationArmed = false
}
