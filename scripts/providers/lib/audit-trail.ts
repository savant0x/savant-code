/**
 * FID-2026-0916-001 — the exclusion audit-trail builder (Stage A, step 4).
 *
 * One pure function owns WHY every non-candidate card was excluded
 * (MQ2): the three original classes keep their byte-identical reason
 * strings (report-stable parity), and the previously-silent classes
 * (unconfirmed category, monitor-directory, free-product, unreachable
 * probe) now render rows too — the report's "every gate decision, with
 * reason" claim covers the whole feed, not just the loud classes.
 *
 * Class order matters for the rendered audit section's determinism:
 * risky → free-relay → down → unconfirmed-category → monitor-directory
 * → free-product → unreachable. Cards passing stage-0 produce no rows.
 */
import type { FeedCard } from './parse-feed'
import type { ReportAuditRow } from './report'

export function buildExclusionAuditRows(cards: FeedCard[]): ReportAuditRow[] {
  const rows: ReportAuditRow[] = []
  const push = (host: string, reason: string): void => {
    rows.push({ host, decision: 'excluded', reason })
  }

  for (const card of cards) {
    if (card.status === 'risky') {
      push(card.host, 'status=risky (MQ2 hard-exclusion)')
      continue
    }
    if (card.category === 'free-relay') {
      push(
        card.host,
        'category=free-relay (anonymous relay class — LLMjacking)',
      )
      continue
    }
    if (card.status === 'down') {
      push(card.host, 'status=down (dead endpoint)')
      continue
    }
    if (!card.categoryConfirmed || card.category === null) {
      push(
        card.host,
        `unconfirmed category (categoryConfirmed=false${
          card.category === null ? ', category=null' : ''
        }) — no operator confirmation of the feed's classification`,
      )
      continue
    }
    if (card.category === 'monitor-directory') {
      push(
        card.host,
        'category=monitor-directory (a directory/listing site, not a provider)',
      )
      continue
    }
    if (card.category === 'free-product') {
      push(
        card.host,
        'category=free-product (a consumer product, not an API surface)',
      )
      continue
    }
    if (card.probe === null) {
      push(
        card.host,
        'no probe data in the feed record — cannot confirm reachability',
      )
      continue
    }
    if (!card.probe.reachable) {
      push(card.host, 'feed probe reports the endpoint unreachable')
      continue
    }
    // Candidate-class card (verified + confirmed first-party-free /
    // commercial-aggregator + reachable): stage-0 admits it — no row.
  }
  return rows
}
