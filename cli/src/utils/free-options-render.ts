/**
 * FID-2026-0928-012 — free-options renderers (markdown reference + command
 * output). Pure functions over FreeOptionsReport; split from free-options.ts
 * for the 300-line ceiling. The markdown file is the agent-answerable
 * reference: a stable path the user and the agent both read (one truth).
 */
import type { FreeOptionsReport } from './free-options-types'

/** Render the agent-answerable markdown reference. */
export function renderFreeOptionsMarkdown(report: FreeOptionsReport): string {
  const lines: string[] = []
  lines.push('# Free options right now')
  lines.push('')
  lines.push(
    `fetchedAt: ${report.fetchedAt ?? 'n/a'}${report.stale ? ' (**STALE** — older than 24h; run `/provider free` to refresh)' : ''}`,
  )
  lines.push('')
  lines.push('## Wired — advertised free models; account access unverified')
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
    'Configured keys and public listings do not verify your account quota. Local registration does not verify a running server.',
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
  lines.push(
    'Configured keys and public listings do not verify account quota; local servers must be running.',
  )
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
export function renderFreeOptionsAnnounce(report: FreeOptionsReport): string[] {
  // Truthy guard, not `=== null`: a hand-corrupted cache JSON can leave
  // `fetchedAt` runtime-undefined (the type says `string | null`, so the
  // `=== null` form would let "catalog fetchedAt undefined" reach the user).
  if (!report.fetchedAt) return []
  const total =
    report.wiredFree.length + report.notWired.length + report.localFree.length
  if (total === 0) return []
  const age = report.stale ? ' (cached copy is older than a day)' : ''
  const lines: string[] = [
    `Free AI lanes available${age} — catalog fetchedAt ${report.fetchedAt}:`,
  ]
  if (report.wiredFree.length > 0) {
    const labels = boundedLabels(report.wiredFree.map((lane) => lane.label))
    lines.push(
      `- Wired & free: ${report.wiredFree.length} — ${labels} — advertised free models; account quota unverified`,
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
  lines.push('Run /provider free for the full split with model ids.')
  return lines
}
