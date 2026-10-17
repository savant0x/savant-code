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
import { buildFreeOptionsView, dataFreshnessLabel } from './free-options-view'

import type { FreeOptionsReport } from './free-options-types'
import type { FreeOptionsView } from './free-options-view'

/** Render the agent-answerable markdown reference (with identity header). */
export function renderFreeOptionsMarkdown(view: FreeOptionsView): string {
  return renderFreeOptionsArtifact(view).text
}

/** The compact `/provider free` view. The panel carries the complete list. */
export function renderCommandOutput(
  report: FreeOptionsReport,
  markdownPath: string,
): string[] {
  const view = buildFreeOptionsView(report, {
    markdownPath,
    generatedAt: report.exportStatus?.generatedAt ?? '',
    freshness: dataFreshnessLabel(report),
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
    'Every model id and every offer is in the free-options panel above; the same reference is saved to:',
  )
  lines.push(`  ${view.header.markdownPath}`)
  const exported = report.exportStatus
  if (exported && !exported.ok) {
    lines.push(
      `⚠ Export failed: ${exported.error ?? 'unknown error'}. The panel above is complete; the file may be missing.`,
    )
  } else if (exported) {
    lines.push(
      `Export ok — generatedAt ${exported.generatedAt} · ${exported.generationId}`,
    )
  }
  if (view.wired.length > 0) {
    lines.push('')
    lines.push('**Free models on providers you already wired:**')
    for (const lane of view.wired) {
      lines.push(`- ${lane.label}: ${lane.models.length} free model(s)`)
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
      report.discoveryOffers ?? [],
      view.header.markdownPath,
    ),
  )
  lines.push(view.quotaFootnote)
  return lines
}
