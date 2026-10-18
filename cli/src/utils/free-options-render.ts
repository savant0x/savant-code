/**
 * FID-2026-1017-005 — free-options surfaces rendered from the shared view.
 *
 * The boot panel, the markdown artifact and `/provider free` all consume
 * `buildFreeOptionsView`; this module only assembles strings. The resolved
 * artifact path is an argument in every renderer that names it, so no surface
 * can point at a bare filename while the writer writes elsewhere.
 */
import { renderFreeOptionsArtifact } from './free-options-artifact'
import {
  catalogDeltaLine,
  renderOffersCommandBlock,
} from './free-options-offers'
import {
  buildFreeOptionsView,
  dataFreshnessLabel,
  freeOptionsPreviewLine,
  freeOptionsSelectionLine,
} from './free-options-view'

import type { FreeOptionsReport } from './free-options-types'
import type { FreeOptionsView } from './free-options-view'

/** Render the agent-answerable markdown reference (with identity header). */
export function renderFreeOptionsMarkdown(view: FreeOptionsView): string {
  return renderFreeOptionsArtifact(view).text
}

/** The compact coding selection; the artifact carries the broad discovery list. */
export function renderCommandOutput(
  report: FreeOptionsReport,
  markdownPath: string,
  nowMs: number = Date.now(),
): string[] {
  const view = buildFreeOptionsView(report, {
    markdownPath,
    generatedAt: report.exportStatus?.generatedAt ?? '',
    freshness: dataFreshnessLabel(report),
    audience: 'coding',
    nowMs,
  })
  const lines: string[] = []
  // Truthy guard: `liftCatalog` rejects a non-string `fetchedAt`, but `''`
  // passes its typeof check, so `=== null` would render "fetchedAt :"
  // from a hand-corrupted cache (FID-2026-1001-002 Loop 3).
  if (!report.fetchedAt) {
    lines.push(
      "Couldn't fetch the free-model catalog and no cached copy exists.",
    )
  } else {
    const age = report.stale ? ' (cached, older than 24h)' : ''
    lines.push(`Free-model catalog${age} — fetchedAt ${report.fetchedAt}:`)
    const delta = catalogDeltaLine(view.newModelIds)
    if (delta) lines.push(delta)
  }
  lines.push('')
  lines.push(
    'Coding-focused candidates are shown here. The complete discovery report is saved to:',
  )
  lines.push(`  ${view.header.markdownPath}`)
  const exported = report.exportStatus
  if (exported && !exported.ok) {
    lines.push(
      `⚠ Export failed: ${exported.error ?? 'unknown error'}; the file may be missing.`,
    )
  } else if (exported) {
    lines.push(
      `Export ok — generatedAt ${exported.generatedAt} · ${exported.generationId}`,
    )
  }
  if (view.wired.length > 0) {
    lines.push('')
    lines.push(
      '**Advertised free models — text candidates on configured providers:**',
    )
    for (const lane of view.wired) {
      lines.push(`- ${lane.label}: ${lane.models.length} text candidate(s)`)
    }
  }
  if (view.notWired.length > 0) {
    lines.push('')
    lines.push('**Free tiers you have NOT wired:**')
    for (const lane of view.notWired) {
      lines.push(`- ${lane.label} → ${lane.setupCommand}`)
    }
  }
  lines.push('')
  lines.push('**Local & free:**')
  for (const lane of view.local) {
    lines.push(`- ${lane.label} (no key) → ${lane.setupCommand}`)
  }
  lines.push('')
  for (const lane of view.discoveryOnly) {
    lines.push(`- ${lane.label}: discovery only; integration unavailable`)
  }
  lines.push(
    ...renderOffersCommandBlock(
      view.offers.flatMap((group) => group.rows),
      view.header.markdownPath,
    ),
  )
  lines.push(freeOptionsSelectionLine(view), view.quotaFootnote)
  return lines
}

/** Copy mirrors the selected preview; the report link reaches broad evidence. */
export function renderFreeOptionsCopy(
  view: FreeOptionsView,
  refreshError?: string,
): string {
  const { counts } = view.header
  const lines = [
    `Free options — ${view.header.freshness}`,
    `${counts.wiredModels} text candidate(s) on ${counts.wiredProviders} configured provider(s) · ${counts.offers} relevant offer(s)`,
    view.header.markdownPath,
    freeOptionsSelectionLine(view),
  ]
  for (const lane of [...view.wired, ...view.notWired]) {
    lines.push(`${lane.label} (${lane.providerId})`)
    for (const model of lane.models) lines.push(`  ${model}`)
    if ('setupCommand' in lane) lines.push(`  ${lane.setupCommand}`)
  }
  for (const lane of view.local)
    lines.push(`${lane.label} (no key) → ${lane.setupCommand}`)
  for (const group of view.offers) {
    lines.push(`[${group.category}]`)
    for (const row of group.rows)
      lines.push(`  ${row.title} — ${row.deadlineLabel} — ${row.url}`)
  }
  lines.push(freeOptionsPreviewLine(view), view.quotaFootnote)
  if (refreshError) lines.push(`Refresh note: ${refreshError}`)
  return lines.filter(Boolean).join('\n')
}
