/**
 * Durable Law 1 read-ledger mirroring (FID-2026-1001-003 step 3).
 *
 * `filesRead` lives on the ephemeral enforcement instance (WeakMap-keyed by
 * agentState object identity), so a session restore rebuilt an empty read
 * set and Law 1 re-blocked writes to files the session had demonstrably
 * read. This module owns the durable mirror on the grounding checkpoint:
 * canonical path → first-seen wall-clock ms, bounded FIFO.
 */
import { MAX_READ_LEDGER } from '../enforcement-state'

import type { GroundingCheckpoint } from '@savant-code/common/types/session-state'

/**
 * Mirror one canonical read path into the checkpoint's `readLedger`.
 * Dedupes by canonical path (first-seen timestamp wins); when the ledger is
 * at capacity, the oldest entry is evicted before insertion. Reads are cheap
 * to re-do — the ledger exists so a restore does not re-block Law 1, and a
 * bounded recent window satisfies that contract without unbounded growth.
 * Records READS only, never write credit.
 */
export function mirrorReadIntoLedger(
  checkpoint: GroundingCheckpoint,
  canonical: string,
): void {
  if (!checkpoint.readLedger) checkpoint.readLedger = {}
  const ledger = checkpoint.readLedger
  if (ledger[canonical] !== undefined) return
  if (Object.keys(ledger).length >= MAX_READ_LEDGER) {
    let oldestKey: string | undefined
    let oldest = Number.POSITIVE_INFINITY
    for (const [key, seenAt] of Object.entries(ledger)) {
      if (seenAt < oldest) {
        oldest = seenAt
        oldestKey = key
      }
    }
    if (oldestKey !== undefined) delete ledger[oldestKey]
  }
  ledger[canonical] = Date.now()
}
