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
  lines.push('## Wired — free models you can use today')
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
    lines.push('_Every free-catalog provider is wired._')
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
      `- **${lane.label}** — runs on your machine, no key — \`${lane.setupCommand}\``,
    )
  }
  lines.push('')
  return lines.join('\n')
}

/** Render the `/provider free` chat output lines. */
export function renderCommandOutput(report: FreeOptionsReport): string[] {
  const lines: string[] = []
  if (report.fetchedAt === null) {
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
  return lines
}
