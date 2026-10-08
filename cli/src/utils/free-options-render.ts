/**
 * FID-2026-0928-012 — free-options renderers (markdown reference + command
 * output). Pure functions over FreeOptionsReport; split from free-options.ts
 * for the 300-line ceiling. The markdown file is the agent-answerable
 * reference: a stable path the user and the agent both read (one truth).
 */
import type { FreeOptionsReport } from './free-options-types'

function freeClaimCaveat(report: FreeOptionsReport): string {
  return report.catalogEvidence?.class === 'reported-unverified'
    ? 'reported free models; listing unverified'
    : 'advertised free models'
}

function quotaCaveat(report: FreeOptionsReport): string {
  const reading = report.quotaReading
  if (!reading || reading.source === 'none' || reading.state === 'unknown')
    return 'account quota unverified'
  if (reading.state === 'unavailable') return 'account quota unavailable'
  if (reading.state === 'exhausted') return 'account quota observed exhausted'
  if (reading.state === 'approaching_limit')
    return 'account quota approaching limit'
  return 'account quota observed healthy'
}

function quotaFootnote(report: FreeOptionsReport): string {
  const reading = report.quotaReading
  return !reading || reading.source === 'none' || reading.state === 'unknown'
    ? 'Configured keys and public listings do not verify your account quota'
    : `${quotaCaveat(report)} (source: ${reading.source})`
}

/** Render the agent-answerable markdown reference. */
export function renderFreeOptionsMarkdown(report: FreeOptionsReport): string {
  const lines: string[] = []
  lines.push('# Free options right now')
  lines.push('')
  lines.push(
    `fetchedAt: ${report.fetchedAt ?? 'n/a'}${report.stale ? ' (**STALE** — older than 24h; run `/provider free` to refresh)' : ''}`,
  )
  lines.push('')
  lines.push(`## Wired — ${freeClaimCaveat(report)}; account access unverified`)
  lines.push('')
  if (report.wiredFree.length === 0) {
    lines.push('_No configured provider exposes models in the free catalog._')
  } else {
    for (const lane of report.wiredFree) {
      lines.push(`### ${lane.label} (\`${lane.providerId}\`)`)
      lines.push('')
      for (const model of lane.models) lines.push(`- \`${model}\``)
      lines.push('')
    }
  }
  lines.push('## Free tiers you have NOT wired')
  lines.push('')
  if (report.notWired.length === 0) {
    lines.push(
      '_Every supported free-catalog provider has credentials configured._',
    )
  } else {
    for (const lane of report.notWired) {
      lines.push(
        `- **${lane.label}** — ${lane.models.length} free model(s) — run \`${lane.setupCommand}\``,
      )
    }
  }
  lines.push('')
  lines.push('## Local & free')
  lines.push('')
  for (const lane of report.localFree) {
    lines.push(
      `- **${lane.label}** — registered local integration; server and model presence unverified — \`${lane.setupCommand}\``,
    )
  }
  lines.push('')
  for (const lane of report.discoveryOnly ?? []) {
    lines.push(
      `- ${lane.label}: ${lane.models.length} advertised free model(s); discovery only, integration unavailable`,
    )
  }
  for (const offer of report.discoveryOffers ?? [])
    lines.push(`- Discovery: ${offer} (source: custats free-token feed)`)
  lines.push(
    `${quotaFootnote(report)}. Local registration does not verify a running server.`,
  )
  return lines.join('\n')
}

/** Render the `/provider free` chat output lines. */
export function renderCommandOutput(report: FreeOptionsReport): string[] {
  const lines: string[] = []
  // Truthy guard, matching renderFreeOptionsAnnounce: `liftCatalog` rejects a
  // non-string `fetchedAt`, but `''` passes its typeof check, so `=== null`
  // would render "fetchedAt :" from a hand-corrupted cache (FID-2026-1001-002
  // Loop 3).
  if (!report.fetchedAt) {
    lines.push(
      "Couldn't fetch the free-model catalog and no cached copy exists.",
    )
  } else {
    const age = report.stale ? ' (cached, older than 24h)' : ''
    lines.push(`Free-model catalog${age} — fetchedAt ${report.fetchedAt}:`)
  }
  if (report.wiredFree.length > 0) {
    lines.push('')
    lines.push('**Free models on providers you already wired:**')
    for (const lane of report.wiredFree) {
      lines.push(`- ${lane.label}: ${lane.models.length} free model(s)`)
    }
  }
  if (report.notWired.length > 0) {
    lines.push('')
    lines.push('**Free tiers you have NOT wired:**')
    for (const lane of report.notWired) {
      lines.push(`- ${lane.label} → ${lane.setupCommand}`)
    }
  }
  lines.push('')
  lines.push('**Local & free:**')
  for (const lane of report.localFree) {
    lines.push(`- ${lane.label} (no key) → ${lane.setupCommand}`)
  }
  lines.push('')
  lines.push(
    'The full reference (with model ids) is saved to free-options.md in your Savant config directory — ask the agent "what free options do I have?" and it can read it for you.',
  )
  for (const lane of report.discoveryOnly ?? [])
    lines.push(`- ${lane.label}: discovery only; integration unavailable`)
  for (const offer of report.discoveryOffers ?? [])
    lines.push(`- Discovery: ${offer} (source: custats free-token feed)`)
  lines.push(`${quotaFootnote(report)}; local servers must be running.`)
  return lines
}

/** Bounded label list: first 5, then an ellipsis. */
function boundedLabels(labels: string[]): string {
  const shown = labels.slice(0, 5).join(', ')
  return labels.length > 5 ? `${shown}, …` : shown
}

/**
 * Render the boot system-message lines announcing the cached free-lane
 * split (FID-2026-1001-002). Empty when there is nothing to say (no cache
 * timestamp, or every lane list empty) so a nothing message never posts.
 */
export function renderFreeOptionsAnnounce(
  report: FreeOptionsReport,
  discovery: DiscoveryDigestCounts | null = null,
): string[] {
  // Truthy guard, not `=== null`: a hand-corrupted cache JSON can leave
  // `fetchedAt` runtime-undefined (the type says `string | null`, so the
  // `=== null` form would let "catalog fetchedAt undefined" reach the user).
  if (!report.fetchedAt) return []
  // Free lanes only: a configured provider with no free lane has nothing
  // free to announce under the "Free AI lanes available" header.
  const total =
    report.wiredFree.length + report.notWired.length + report.localFree.length
  if (total === 0) return []
  const age = report.stale ? ' (cached copy is older than a day)' : ''
  const lines: string[] = [
    `Free AI lanes available${age} — catalog fetchedAt ${report.fetchedAt}:`,
  ]
  if (report.configuredProviders.length > 0) {
    lines.push(
      `- Configured: ${report.configuredProviders.length} provider(s) — ${boundedLabels(report.configuredProviders)}`,
    )
  }
  if (report.wiredFree.length > 0) {
    const labels = boundedLabels(report.wiredFree.map((lane) => lane.label))
    lines.push(
      `- Free catalog overlap: ${report.wiredFree.length} — ${labels} — ${freeClaimCaveat(report)}; ${quotaCaveat(report)}`,
    )
  }
  if (report.notWired.length > 0) {
    const labels = boundedLabels(report.notWired.map((lane) => lane.label))
    lines.push(
      `- Not wired: ${report.notWired.length} — ${labels} — each starts with /provider <name>`,
    )
  }
  if (report.localFree.length > 0) {
    const labels = boundedLabels(report.localFree.map((lane) => lane.label))
    lines.push(
      `- Local & free: ${report.localFree.length} — ${labels} — no key needed`,
    )
  }
  const offers = report.discoveryOffers ?? []
  if (offers.length > 0) {
    lines.push(
      `- Offers: ${offers.length} advertised free-token offer(s) in the custats feed; eligibility and deadlines unverified — ${offers.slice(0, 2).join('; ')}`,
    )
  }
  if (discovery && (discovery.newCount > 0 || discovery.changedCount > 0)) {
    lines.push(
      `- Discovery: ${discovery.newCount} new / ${discovery.changedCount} changed free-provider candidate(s) since the last harvest`,
    )
  }
  lines.push(
    'Run /provider free for the full split with model ids; /notifications to review.',
  )
  return lines
}

/**
 * FID-2026-1004-007 — the discovery delta the digest needs. The renderer's
 * contract is narrower than the producer's `DiscoveryCounts`, so it takes
 * this structural subset rather than importing the discovery module's type;
 * the call site is typed against `DiscoveryCounts`, so a producer rename
 * still fails the build (no silent drift).
 */
export interface DiscoveryDigestCounts {
  newCount: number
  changedCount: number
}

/**
 * Compose the once-per-day launch digest (FID-2026-1004-007): the rewired
 * free-lane announce (plus expiring offers and the discovery delta), or a
 * delta-only message when no catalog cache exists. Empty when there is
 * nothing honest to say, so a nothing message never posts.
 */
export function renderFreeOptionsDigest(
  report: FreeOptionsReport | null,
  discovery: DiscoveryDigestCounts | null,
): string[] {
  if (report) return renderFreeOptionsAnnounce(report, discovery)
  if (discovery && (discovery.newCount > 0 || discovery.changedCount > 0)) {
    return [
      `Free-provider discovery — ${discovery.newCount} new / ${discovery.changedCount} changed candidate(s) since the last harvest.`,
      'Run /provider free for the full split with model ids; /notifications to review.',
    ]
  }
  return []
}
