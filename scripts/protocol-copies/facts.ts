// =============================================================================
// ECHO.md fact extraction
// =============================================================================

export interface LawFact {
  number: number
  title: string
  /** The ECHO.md directive text for this law (normalized). */
  directive: string
}

export interface ProtocolFacts {
  laws: LawFact[]
  fsmStates: string[]
  circuitBreakers: string[]
  fiveQuestions: string[]
  fidLifecycleStages: string[]
  antiPatternTitles: string[]
  authoringPhrases: string[]
}

/** Strip markdown bold markers and collapse whitespace for comparisons. */
export function normalizeCell(cell: string): string {
  return cell.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
}

/** Extract lines of a markdown table block starting at a heading. */
function tableRowsAfter(lines: string[], heading: string): string[][] {
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []
  const rows: string[][] = []
  let sawTableRow = false
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue // blank lines between heading and table / rows
    if (!line.startsWith('|')) {
      // Stop at the first non-table content after we've collected rows.
      if (sawTableRow) break
      continue
    }
    if (/^\|[\s\-|]+\|?$/.test(line)) continue // separator row
    sawTableRow = true
    rows.push(
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
  }
  return rows
}

/** Extract a numbered list block starting at a heading (first line of each item). */
function numberedListAfter(lines: string[], heading: string): string[] {
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []
  const items: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (/^#{1,6}\s/.test(line) || /^-{3,}$/.test(line)) break // next section
    if (/^\d+\.\s/.test(line)) items.push(line)
  }
  return items
}

/** Extract the first fenced code block after a heading. */
function fencedBlockAfter(lines: string[], heading: string): string[] {
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []
  let inFence = false
  const content: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trimStart().startsWith('```')) {
      if (inFence) break
      inFence = true
      continue
    }
    if (inFence) content.push(line)
  }
  return content
}

/** Slice a section between two headings (inclusive start, exclusive end). */
function sectionBetween(
  lines: string[],
  startHeading: string,
  endHeadings: string[],
): string {
  const start = lines.findIndex((line) => line.trim() === startHeading)
  if (start === -1) return ''
  let end = lines.length
  for (const endHeading of endHeadings) {
    const idx = lines.findIndex(
      (line, i) => i > start && line.trim() === endHeading,
    )
    if (idx !== -1 && idx < end) end = idx
  }
  return lines.slice(start, end).join('\n')
}

/** Parse the 15 laws from the two ECHO.md law tables. */
export function extractLaws(echoMd: string): LawFact[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  const laws: LawFact[] = []
  for (const heading of [
    '### Laws 1-4: The Immutable Process Laws',
    '### Laws 5-15: The Extended Code Laws',
  ]) {
    for (const row of tableRowsAfter(lines, heading)) {
      const cells = row.map(normalizeCell)
      if (cells.length < 2 || !/^\d+$/.test(cells[0])) continue
      // Laws 1-4: [#, Law, Directive, Enforcement]; Laws 5-15: [#, Law, Why].
      const directive = cells[2] ?? cells[1]
      laws.push({ number: Number(cells[0]), title: cells[1], directive })
    }
  }
  return laws.sort((a, b) => a.number - b.number)
}

/** Extract FSM state names from the State Transitions table (first column). */
export function extractFsmStates(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  const states: string[] = []
  for (const row of tableRowsAfter(lines, '### State Transitions')) {
    const cell = normalizeCell(row[0] ?? '')
    // Skip the header row (first cell == "State") and any empty cells.
    if (!cell || cell.toLowerCase() === 'state') continue
    states.push(cell)
  }
  return states
}

/** Extract circuit-breaker titles from the numbered rules block. */
export function extractCircuitBreakers(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  const titles: string[] = []
  for (const item of numberedListAfter(lines, '### Circuit Breaker Rules')) {
    // "1. **Max Changes Per Pass** — ..." → "Max Changes Per Pass"
    const boldMatch = item.match(/\*\*([^*]+)\*\*/)
    const title = boldMatch
      ? boldMatch[1]
      : item
          .replace(/^\d+\.\s+/, '')
          .split('—')[0]
          .trim()
    titles.push(title)
  }
  return titles
}

/** Extract the five questions verbatim (bold/backtick-normalized). */
export function extractFiveQuestions(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  return numberedListAfter(lines, '## The Five Questions').map((item) =>
    item.replace(/\*\*/g, '').replace(/`/g, ''),
  )
}

/** Extract FID-lifecycle stage names from the fenced diagram block. */
export function extractFidLifecycleStages(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  const fence = fencedBlockAfter(lines, '## FID Lifecycle')
  for (const line of fence) {
    const match = line.match(/^\s*(Created\s*→\s*Analyzed[\s\S]*?Archived)/)
    if (match) {
      return match[1]
        .split('→')
        .map((stage) => stage.trim())
        .filter(Boolean)
    }
  }
  return []
}

/** Extract anti-pattern titles (first column) from the Anti-Patterns table. */
export function extractAntiPatternTitles(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  return tableRowsAfter(lines, '## Anti-Patterns (Never Do These)')
    .map((row) => normalizeCell(row[0] ?? '').replace(/['"]/g, ''))
    .filter((cell) => cell && cell.toLowerCase() !== 'anti-pattern')
}

/** Extract the canonical FID-authoring phrases that must survive in the copies. */
export function extractAuthoringPhrases(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  const section = sectionBetween(lines, '### FID Authoring Rules', [
    '### Spawning the Recorder',
    '## Anti-Patterns',
  ])
  const phrases = [
    '## FID Authoring Rules',
    'dev/fids/',
    'FID-YYYY-MMDD-NNN',
    'templates/FID-TEMPLATE.md',
    'Only the Recorder',
    'created | analyzed | fixed | verified | converged | closed',
  ]
  return phrases.filter((phrase) => section.includes(phrase))
}

/** Extract every canonical fact from ECHO.md (fail-fast on missing anchors). */
export function extractFacts(echoMd: string): ProtocolFacts {
  const laws = extractLaws(echoMd)
  if (laws.length !== 15) {
    throw new Error(
      `protocol-copies: expected 15 laws from ECHO.md, found ${laws.length}.`,
    )
  }
  const fsmStates = extractFsmStates(echoMd)
  const circuitBreakers = extractCircuitBreakers(echoMd)
  const fiveQuestions = extractFiveQuestions(echoMd)
  const fidLifecycleStages = extractFidLifecycleStages(echoMd)
  const antiPatternTitles = extractAntiPatternTitles(echoMd)
  const authoringPhrases = extractAuthoringPhrases(echoMd)
  for (const [label, list, min] of [
    ['FSM states', fsmStates, 6],
    ['circuit breakers', circuitBreakers, 5],
    ['five questions', fiveQuestions, 5],
    ['FID-lifecycle stages', fidLifecycleStages, 6],
    ['anti-pattern titles', antiPatternTitles, 8],
    ['authoring phrases', authoringPhrases, 6],
  ] as const) {
    if (list.length < min) {
      throw new Error(
        `protocol-copies: expected at least ${min} ${label} from ECHO.md, found ${list.length}.`,
      )
    }
  }
  return {
    laws,
    fsmStates,
    circuitBreakers,
    fiveQuestions,
    fidLifecycleStages,
    antiPatternTitles,
    authoringPhrases,
  }
}
