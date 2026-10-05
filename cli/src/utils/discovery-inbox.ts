/**
 * FID-2026-1004-007 — route NEW free-provider candidates from the discovery
 * harvest into the provider notification inbox, so `/notifications` is the
 * durable review surface for new lanes.
 *
 * Only `new` candidates route. `changed` fires for probe latency/uptime
 * jitter on most hosts every harvest (measured: ~34 of ~35 announced hosts
 * each run) and would flood the inbox. `info` severity keeps them inbox-only
 * — the CLI toast filter skips `info` — and the coordinator's
 * first-observation baseline records facts without spamming. Additions stay
 * operator-approved: nothing here mutates provider config.
 */
import { providerNotifications } from './provider-notifications'

import type { DiscoveryCounts } from './discovery-announce'
import type { ProviderFact } from '@savant-code/common/providers/provider-notifications'

/** Minimal observe surface — the coordinator satisfies it; tests inject a plain object. */
export interface DiscoveryNoticeSink {
  observe(source: string, facts: ProviderFact[], observedAt?: number): void
}

/** One `candidate` fact per NEW host (pure; testable). */
export function buildDiscoveryFacts(counts: DiscoveryCounts): ProviderFact[] {
  return counts.newHosts.map((host) => ({
    key: `candidate:${host}`,
    value: 'new',
    providerId: host,
    kind: 'candidate',
    severity: 'info',
    selected: false,
    message: `${host} — a new free-provider candidate appeared in the discovery harvest. Review dev/provider-candidates/report.md; additions require /provider add (operator-approved).`,
  }))
}

/**
 * Observe the NEW-candidate facts. Fail-silent — discovery routing never
 * breaks the TUI (FID-2026-1004-007).
 */
export function observeDiscoveryCandidates(
  counts: DiscoveryCounts,
  coordinator: DiscoveryNoticeSink = providerNotifications,
): void {
  const facts = buildDiscoveryFacts(counts)
  if (facts.length === 0) return
  try {
    coordinator.observe('discovery', facts, counts.observedAtMs)
  } catch {
    /* Fail-silent: routing problems never break the TUI. */
  }
}