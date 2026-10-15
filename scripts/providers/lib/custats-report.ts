/**
 * FID-2026-0928-011 — custats report rendering (MQ8-style stable report for
 * the custats legs, sibling of lib/report.ts for the freeairouter leg).
 * Pure function; no IO.
 */
import type { CustatsModels } from './custats-models'

type ReportOffer = {
  title: string
  url: string
  expiryKind: string
  expiryDate: string | null
  amountHint: string | null
}

export type CustatsReportInput = {
  nowUtc: string
  offersFetchSkipped: boolean
  modelsFetchSkipped: boolean
  attributed: Array<{ offer: ReportOffer; hosts: string[] }>
  unattributed: Array<{ offer: ReportOffer }>
  expiringSoon: Array<{
    title: string
    url: string
    expiryDate: string
    daysLeft: number | null
  }>
  models: CustatsModels | null
  modelsSourceFresh: boolean
}

export function renderCustatsReport(input: CustatsReportInput): string {
  const lines: string[] = []
  lines.push('# custats free-offer report')
  lines.push('')
  lines.push(
    `_Generated ${input.nowUtc} · offers leg: ${input.offersFetchSkipped ? 'SKIPPED (stale/failed feed)' : 'ok'} · models leg: ${input.modelsFetchSkipped ? 'SKIPPED (stale/failed feed)' : 'ok'} · pipeline: FID-2026-0928-011_`,
  )
  lines.push('')
  if (input.expiringSoon.length > 0) first(input, lines)
  lines.push('## Offers by host attribution')
  lines.push('')
  if (input.attributed.length > 0) {
    lines.push('| Offer | Hosts | Expiry | Amount |')
    lines.push('|---|---|---|---|')
    for (const a of input.attributed) {
      lines.push(
        `| [${a.offer.title}](${a.offer.url}) | ${a.hosts.join(', ')} | ${a.offer.expiryKind}${a.offer.expiryDate ? ` ${a.offer.expiryDate}` : ''} | ${a.offer.amountHint ?? '—'} |`,
      )
    }
    lines.push('')
  }
  if (input.unattributed.length > 0) {
    lines.push(
      '### Unattributed (operator review — new lanes enter via SEED_HOSTS, never auto-queued)',
    )
    lines.push('')
    for (const u of input.unattributed) {
      lines.push(`- **${u.offer.title}** — ${u.offer.url}`)
    }
    lines.push('')
  }
  if (input.models && input.modelsSourceFresh) {
    modelsSection(input, lines)
  }
  lines.push('---')
  lines.push('')
  lines.push(
    'Offers are untrusted feed text (single-operator source); nothing here mutates provider config. Promotion runs through the standard quality gauntlet.',
  )
  return lines.join('\n')
}

function first(input: CustatsReportInput, lines: string[]): void {
  lines.push('## Expiring soon')
  lines.push('')
  for (const o of input.expiringSoon) {
    lines.push(
      `- **${o.title}** — ends ${o.expiryDate}${o.daysLeft !== null ? ` (in ${o.daysLeft}d)` : ''} — ${o.url}`,
    )
  }
  lines.push('')
}

function modelsSection(input: CustatsReportInput, lines: string[]): void {
  const models = input.models
  if (!models) return
  lines.push('## Free-model catalog (enrichment signal)')
  lines.push('')
  lines.push(
    `- fetchedAt ${models.fetchedAt} · total ${models.totalModels ?? '?'} · new since last: ${models.newModelIds.length}`,
  )
  for (const id of models.newModelIds) lines.push(`  - NEW: ${id}`)
  const expiring = models.models.filter((m) => m.expirationDate)
  if (expiring.length > 0) {
    lines.push(`- models with an expiration_date (${expiring.length}):`)
    for (const m of expiring.slice(0, 20)) {
      lines.push(
        `  - ${m.id} (${m.providerId ?? '?'}) expires ${m.expirationDate}`,
      )
    }
  }
  for (const a of models.archived.slice(0, 5)) {
    lines.push(
      `  - retired: ${a.id} (${a.providerId ?? '?'}) removed ${a.removedAt}`,
    )
  }
  lines.push('')
}
