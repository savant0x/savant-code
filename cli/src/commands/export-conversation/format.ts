/**
 * Pure formatting helpers shared by the HTML renderers and the copy-text
 * builders of the `/export` command.
 */

// FID-2026-1013-011 W2-1/W2-3: the tool label and the tool input/output
// renderers were byte-identical copies of the `/copy` ones; both now live in
// `@savant-code/common/util/tool-display`. Re-exported so the `/export`
// renderers keep their import site.
export {
  renderToolInput,
  renderToolOutput,
  toolDisplayName,
} from '@savant-code/common/util/tool-display'

/** Title-case an agent id/type into a display name, e.g. `code-searcher` → `Code Searcher`. */
export function formatAgentName(agentName: string): string {
  const cleaned = agentName.replace(/[-_]/g, ' ').trim()
  if (!cleaned) return 'Agent'
  return cleaned.replace(/\b\w/g, (l) => l.toUpperCase())
}

/** Format a timestamp as `MM-DD-YYYY h:mm AM/PM EST` (America/New_York). */
export function formatExportTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)
  const values: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value
  }
  return `${values.month}-${values.day}-${values.year} ${values.hour}:${values.minute} ${values.dayPeriod ?? ''} EST`
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
