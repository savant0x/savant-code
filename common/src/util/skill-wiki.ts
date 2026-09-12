/**
 * FID-2026-0912-003 — durable pattern wiki (the WikiSkill "Wiki Layer"
 * adapted to Savant's deterministic, operator-governed harness).
 *
 * One markdown page per promoted failure pattern, written by the mechanical
 * session-end review (zero model calls) from the dedup engine's recurrence
 * output. Pages are UPDATE-ONLY: evidence rows append when the observation
 * changes and never disappear with the page; the harness cannot forget.
 * Bounded: evidence rows cap at WIKI_MAX_EVIDENCE_ROWS (oldest dropped,
 * newest kept) so a future proposer's context budget stays predictable.
 *
 * The wiki is NEVER read into agent context at boot — it exists for the
 * session-end writer, the operator, and (future FID) an isolated proposer.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

/** Rows kept in a page's Evidence section (newest kept, oldest dropped). */
export const WIKI_MAX_EVIDENCE_ROWS = 12

export type WikiPatternInput = {
  /** The dedup engine's key (sha256(toolName + normalized error line)). */
  key: string
  toolName: string
  /** Unstripped sample line — context for the reader, never re-hashed. */
  errorFirstLine: string
  /** Recurrences within the rolling 14-day window. */
  count: number
  totalCount: number
  firstTs: string
  lastTs: string
}

export type WikiUpdateResult = 'created' | 'updated'

export function wikiRootDir(rootDir: string): string {
  return path.join(rootDir, 'dev', 'wiki')
}

export function wikiPatternsDir(rootDir: string): string {
  return path.join(wikiRootDir(rootDir), 'patterns')
}

export function wikiIndexPath(rootDir: string): string {
  return path.join(wikiRootDir(rootDir), 'index.md')
}

/**
 * Deterministic page slug: kebab-cased tool name + a 12-hex-char key
 * prefix (the full key is 64 chars; the prefix is enough to disambiguate
 * same-tool patterns while keeping filenames readable).
 */
export function patternSlug(pattern: {
  key: string
  toolName: string
}): string {
  const tool = pattern.toolName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${tool}-${pattern.key.slice(0, 12)}`
}

/** One evidence row: a dated observation line (the `- ` prefixed lines). */
function evidenceRow(pattern: WikiPatternInput, observedAt: string): string {
  return (
    `- ${observedAt.slice(0, 10)} — recurrences ${pattern.count} ` +
    `(total ${pattern.totalCount}), first ${pattern.firstTs.slice(0, 10)}, ` +
    `last ${pattern.lastTs.slice(0, 10)}`
  )
}

/** The data content of an evidence row (everything after the em-dash) —
 * the identity used for duplicate-observation detection. Two reviews of an
 * unchanged pattern share a data signature even on different dates. */
function evidenceData(line: string): string {
  const idx = line.indexOf('—')
  return idx === -1 ? line.trim() : line.slice(idx + 1).trim()
}

/** Build the full page for a first observation. */
export function buildPatternPage(
  pattern: WikiPatternInput,
  observedAt: string,
): string {
  const lines: string[] = [
    `# Pattern: ${pattern.toolName}`,
    '',
    '> Auto-maintained by the session-end review (FID-2026-0912-003).',
    '> Mechanical distillation of a recurring failure pattern — update-only;',
    '> never auto-deleted. Not read into agent context at boot.',
    '',
    '- **Tool:** ' + pattern.toolName,
    '- **Dedup key:** `sha256:' + pattern.key + '`',
    '- **Sample line:** `' + pattern.errorFirstLine + '`',
    '- **Recurrences (14d window):** ' +
      pattern.count +
      ' (total ' +
      pattern.totalCount +
      ')',
    '- **First seen:** ' + pattern.firstTs,
    '- **Last seen:** ' + pattern.lastTs,
    '- **Routing:** ' +
      'promote via FID when resolved+verified (hybrid routing rule)',
    '',
    '## Evidence',
    '',
    evidenceRow(pattern, observedAt),
    '',
  ]
  return lines.join('\n')
}

/**
 * Append an evidence row to an existing page, keeping at most
 * WIKI_MAX_EVIDENCE_ROWS rows (oldest dropped). Returns the page unchanged
 * when the row already appears (identical re-review — idempotent).
 */
export function appendPatternEvidence(
  page: string,
  pattern: WikiPatternInput,
  observedAt: string,
): string {
  const row = evidenceRow(pattern, observedAt)
  const lines = page.split('\n')

  const markerIndex = lines.indexOf('## Evidence')
  if (markerIndex === -1) return page

  // Idempotence: an observation identical to the NEWEST existing row
  // (same data, regardless of review date) appends nothing. Keyed on the
  // data signature, not the full row — the date varies per review.
  const oldRows = lines
    .slice(markerIndex + 1)
    .filter((line) => line.startsWith('- '))
  if (
    oldRows.length > 0 &&
    evidenceData(oldRows[oldRows.length - 1]) === evidenceData(row)
  ) {
    return page
  }

  // Head: everything through the '## Evidence' marker, with the live
  // observation fields refreshed in place.
  const head = lines
    .slice(0, markerIndex + 1)
    .map((line) =>
      line
        .replace(
          /\*\*Recurrences \(14d window\):\*\* \d+ \(total \d+\)/,
          `**Recurrences (14d window):** ${pattern.count} (total ${pattern.totalCount})`,
        )
        .replace(/\*\*Last seen:\*\* .*/, `**Last seen:** ${pattern.lastTs}`),
    )

  // Old evidence rows, oldest first — cap keeps the NEWEST rows.
  const kept = [...oldRows, row].slice(-WIKI_MAX_EVIDENCE_ROWS)

  return [...head, '', ...kept, ''].join('\n')
}

export type RejectedProposal = {
  patternKey: string
  toolName: string
  skillName: string
  proposalSha: string
  reason: string
  rejectedAt: string
}

/** One rejected-proposal evidence line (WikiSkill skill-impact.md analog). */
function rejectedProposalRow(rejection: RejectedProposal): string {
  return (
    `- ${rejection.rejectedAt.slice(0, 10)} — REJECTED ${rejection.skillName} ` +
    `(${rejection.proposalSha.slice(0, 19)}): ${rejection.reason}`
  )
}

/**
 * FID-2026-0912-004: rejected-proposal memory. On operator rejection or a
 * gate failure, the proposal summary lands on the owning pattern page so
 * future proposers never repeat it (WikiSkill's institutional-memory rule).
 * Idempotent on proposalSha; creates the page shell if it doesn't exist yet.
 */
export function appendRejectedProposal(
  rootDir: string,
  rejection: RejectedProposal,
): void {
  const dir = wikiPatternsDir(rootDir)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(
    dir,
    `${patternSlug({ key: rejection.patternKey, toolName: rejection.toolName })}.md`,
  )
  const row = rejectedProposalRow(rejection)
  let page: string
  if (fs.existsSync(file)) {
    page = fs.readFileSync(file, 'utf8')
  } else {
    page = buildPatternPage(
      {
        key: rejection.patternKey,
        toolName: rejection.toolName,
        errorFirstLine: '(no live observation — page created by a rejection)',
        count: 0,
        totalCount: 0,
        firstTs: rejection.rejectedAt,
        lastTs: rejection.rejectedAt,
      },
      rejection.rejectedAt,
    )
  }
  if (page.includes(rejection.proposalSha.slice(0, 19))) return // idempotent (rows render the sha prefix)
  const lines = page.split('\n')
  const markerIndex = lines.indexOf('## Rejected Proposals')
  if (markerIndex === -1) {
    const trimmed = [...lines]
    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '')
      trimmed.pop()
    trimmed.push('', '## Rejected Proposals', '', row, '')
    page = trimmed.join('\n')
  } else {
    lines.splice(markerIndex + 2, 0, row) // newest directly under the heading
    page = lines.join('\n')
  }
  fs.writeFileSync(file, page, 'utf8')
  rebuildWikiIndex(rootDir)
}

/** Create-or-update the page for a promoted pattern. */
export function updateWikiPattern(
  rootDir: string,
  pattern: WikiPatternInput,
  opts: { now?: number } = {},
): WikiUpdateResult {
  const observedAt = new Date(opts.now ?? Date.now()).toISOString()
  const dir = wikiPatternsDir(rootDir)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${patternSlug(pattern)}.md`)

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, buildPatternPage(pattern, observedAt), 'utf8')
    rebuildWikiIndex(rootDir)
    return 'created'
  }
  const page = fs.readFileSync(file, 'utf8')
  fs.writeFileSync(
    file,
    appendPatternEvidence(page, pattern, observedAt),
    'utf8',
  )
  rebuildWikiIndex(rootDir)
  return 'updated'
}

/** Rebuild index.md: pages sorted by recurrences desc, then name. */
export function rebuildWikiIndex(rootDir: string): string {
  const dir = wikiPatternsDir(rootDir)
  const rows: { name: string; tool: string; count: number }[] = []
  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.md')) continue
      const page = fs.readFileSync(path.join(dir, entry), 'utf8')
      const tool = page.match(/^# Pattern: (.*)$/m)?.[1] ?? entry
      const count = Number.parseInt(
        page.match(/\*\*Recurrences \(14d window\):\*\* (\d+)/)?.[1] ?? '0',
        10,
      )
      rows.push({ name: entry, tool, count })
    }
  }
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  const lines: string[] = [
    '# Pattern Wiki',
    '',
    '> Auto-maintained by the session-end review (FID-2026-0912-003).',
    '> Durable knowledge distilled from recurring failure patterns — the',
    '> WikiSkill Wiki Layer, adapted: mechanical, update-only, never purged.',
    '> Not read into agent context at boot.',
    '',
    '| Pattern | Tool | Recurrences (14d) |',
    '| --- | --- | --- |',
  ]
  for (const row of rows) {
    lines.push(
      `| [patterns/${row.name}](patterns/${row.name}) | ${row.tool} | ${row.count} |`,
    )
  }
  if (rows.length === 0) lines.push('_No patterns recorded yet._')
  const index = lines.join('\n').trimEnd() + '\n'
  fs.mkdirSync(wikiRootDir(rootDir), { recursive: true })
  fs.writeFileSync(wikiIndexPath(rootDir), index, 'utf8')
  return index
}
