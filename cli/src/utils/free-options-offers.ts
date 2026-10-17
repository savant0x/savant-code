/**
 * FID-2026-1016-010 — advertised-offer presentation for the free-options
 * surface (markdown reference + command output). Own module because the rows
 * now carry structure (category, deadline label, registry attribution) and the
 * renderer that composes them already sits against the 300-line ceiling.
 * Pure functions over FreeOfferRow; no IO.
 */
import type { FreeOfferRow } from './free-options-types'

/** Command output shows at most this many attributed offers; the rest count. */
export const MAX_COMMAND_OFFER_ROWS = 10

/** ` · known: Vercel` when the offer's prose names a registry provider. */
function offerSuffix(row: FreeOfferRow): string {
  return row.providerLabels.length > 0
    ? ` · known: ${row.providerLabels.join(', ')}`
    : ''
}

/** One offer line, shared by the markdown reference and the command view. */
export function offerRowLine(row: FreeOfferRow): string {
  return `${row.title} — ${row.deadlineLabel}${offerSuffix(row)}`
}

/**
 * Category groups, largest first, name breaking ties so the output is stable
 * run to run. Feed order is preserved inside a group. A null category (no
 * description tail parsed) groups under `Uncategorized` rather than vanishing.
 */
export function offerCategoryGroups(
  rows: readonly FreeOfferRow[],
): Array<{ category: string; rows: FreeOfferRow[] }> {
  const byCategory = new Map<string, FreeOfferRow[]>()
  for (const row of rows) {
    const category = row.category ?? 'Uncategorized'
    byCategory.set(category, [...(byCategory.get(category) ?? []), row])
  }
  return [...byCategory.entries()]
    .map(([category, group]) => ({ category, rows: group }))
    .sort(
      (a, b) =>
        b.rows.length - a.rows.length || a.category.localeCompare(b.category),
    )
}

/** `Startup programs 58 · Coding 21 · …` — every category, one line. */
export function offerCategorySummary(rows: readonly FreeOfferRow[]): string {
  return offerCategoryGroups(rows)
    .map((group) => `${group.category} ${group.rows.length}`)
    .join(' · ')
}

/**
 * The markdown `## Advertised offers` section: every offer retained (this file
 * is the agent-answerable reference), grouped by category with counts and the
 * known-provider marks. Empty rows render no section at all.
 */
export function renderOffersMarkdownSection(
  rows: readonly FreeOfferRow[],
): string[] {
  if (rows.length === 0) return []
  const lines = [
    '## Advertised offers',
    '',
    `_${rows.length} offer(s) advertised in the custats free-token feed; account eligibility unverified; a \`known:\` mark names a provider in your registry, not a configured key._`,
    '',
  ]
  for (const group of offerCategoryGroups(rows)) {
    lines.push(`### ${group.category} (${group.rows.length})`)
    lines.push('')
    for (const row of group.rows)
      lines.push(
        `- [${row.title}](${row.url}) — ${row.deadlineLabel}${offerSuffix(row)}`,
      )
    lines.push('')
  }
  return lines
}

/**
 * The bounded command block: attributed offers (capped, remainder counted)
 * followed by the per-category counts. The full list is the boot panel and
 * the artifact at `markdownPath` — resolved by the caller, never a bare name.
 */
export function renderOffersCommandBlock(
  rows: readonly FreeOfferRow[],
  markdownPath: string,
  maxRows: number = MAX_COMMAND_OFFER_ROWS,
): string[] {
  if (rows.length === 0) return []
  const attributed = rows.filter((row) => row.providerLabels.length > 0)
  const lines = [
    '',
    `**Advertised offers naming a provider in your registry (${attributed.length} of ${rows.length}):**`,
  ]
  if (attributed.length === 0) {
    lines.push(
      '- none — every advertised offer is unattributed review material',
    )
  } else {
    for (const row of attributed.slice(0, maxRows))
      lines.push(`- ${offerRowLine(row)}`)
    const hidden = attributed.length - maxRows
    if (hidden > 0)
      lines.push(`- … and ${hidden} more — the full list is in ${markdownPath}`)
  }
  lines.push('')
  lines.push(`Categories: ${offerCategorySummary(rows)}`)
  return lines
}

/**
 * The catalog delta both headers carry (FID-2026-1016-010): model ids the
 * envelope lifted as newly advertised. Null when there are none, so an empty
 * delta never renders a line.
 */
export function catalogDeltaLine(
  newModelIds: readonly string[] | undefined,
): string | null {
  const ids = newModelIds ?? []
  if (ids.length === 0) return null
  const shown = ids.slice(0, 5)
  return `new since the previous catalog: ${ids.length} model(s) — ${shown.join(', ')}${ids.length > shown.length ? ', …' : ''}`
}
