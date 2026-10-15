/**
 * FID-2026-0914-003 — stage-0 discovery filter (Stage A, step 2).
 *
 * Cuts the 214-record feed down to serious candidates. Hard-excluded by
 * construction (measured on the live payload, 2026-09-14):
 * - status `risky` (MQ2 operator ruling: hard-exclusion — 17 such
 *   first-party/aggregator hosts exist, e.g. mx.236600.xyz)
 * - status `down` (dead entries)
 * - category `free-relay` (anonymous relays — the measured LLMjacking class)
 * - `categoryConfirmed: false` (all 18 null-category verified records are
 *   unconfirmed — audit A10 proved stage-0 drops nothing viable)
 * - categories other than first-party-free / commercial-aggregator
 * - probe.reachable false
 */
import type { FeedCard } from './parse-feed'

const ELIGIBLE_CATEGORIES: ReadonlySet<string> = new Set([
  'first-party-free',
  'commercial-aggregator',
])

export function stage0Filter(cards: FeedCard[]): FeedCard[] {
  return cards.filter(
    (card) =>
      card.status === 'verified' &&
      card.categoryConfirmed &&
      card.category !== null &&
      ELIGIBLE_CATEGORIES.has(card.category) &&
      card.probe !== null &&
      card.probe.reachable,
  )
}
