/**
 * CHANGELOG notation parser.
 *
 * The changelog legitimately covers many records under a single heading without
 * spelling each id out, so a literal substring search reports dozens of false
 * coverage gaps. This module is the single authority on which notations count
 * as a claim, split out of `changelog-coverage.ts` so that file stays the gate
 * and this stays the parser.
 *
 *   range        `FID-2026-0815-004..009`   `FID-2026-0811-022–029`
 *                `FID-2026-0809-012 through 018`   `FID-2026-0816-005..-012`
 *   slash        `FID-2026-0812-008/009`
 *   compound     `FID-2026-0905-001/-004/-005/-007`
 *                `FID-2026-0824-022 + -023..-027`
 *   short form   `FIDs 003–010`   `FID-013`  (date inherited from the section)
 *
 * Ranges expand to the inclusive span, so a compound naming 004/005/007 also
 * covers 006. Over-covering is the safe direction: a missed gap is a false
 * alarm, while a false gap is noise that trains readers to ignore the gate.
 */

/** Characters that may separate enumerated siblings or a range end. */
const SEPARATORS = new Set([
  '/',
  '+',
  ',',
  '&',
  '~',
  '.',
  '-',
  ' ',
  '\t',
  '…',
  '–',
  '—',
])

/** Ceiling on how far past an id the enumeration is read. */
const TAIL_WINDOW = 48
const MAX_SEQ = 999

/**
 * A short-form reference: the record is named but its date is not, because the
 * section already established it — `FIDs 003–010`, `FID-013`. The `(?!\d)`
 * guard is what keeps a full id out of this pattern: after `FID-` it would
 * otherwise match the leading `202` of `FID-2026-0918-001`.
 */
const SHORT_FORM =
  /\bFIDs?\s*[-–—]?(\d{1,3})(?!\d)(?:(?:\.\.|[-–—])\s*[-–—]?(\d{1,3})(?!\d))?/g

/**
 * The sibling/range numbers named immediately after a base id, e.g. `..009`,
 * `–029`, ` through 018`, `/009`, `/-004/-005/-007`, `+ -023..-027`.
 *
 * A number only counts when a separator precedes it and no digit, dash, or
 * date-fragment follows — that is what keeps `2026-09-18` in
 * `**Closed + archived 2026-09-18**` from being read as sequence 18, and what
 * stops a trailing `)` (as in `(FID-2026-0918-001)`) from opening an
 * enumeration at all.
 */
export function parseEnumerationTail(tail: string): number[] {
  const numbers: number[] = []
  let index = 0
  let sawSeparator = false
  while (index < tail.length && index < TAIL_WINDOW) {
    const char = tail[index] as string
    if (SEPARATORS.has(char)) {
      sawSeparator = true
      index += 1
      continue
    }
    // ` through 018` — the one word the changelog uses as a range connector.
    // Matched as that literal rather than a word class, so unrelated prose
    // (`up to 2 other hosts`) can never be read as an enumeration.
    const through = /^through\b/.exec(tail.slice(index))
    if (through) {
      sawSeparator = true
      index += through[0].length
      continue
    }
    const digits = /^\d{1,4}/.exec(tail.slice(index))
    if (!digits) break
    const text = digits[0]
    const after = tail[index + text.length] ?? ''
    // A 4-digit run is a year, and a following dash means a date fragment;
    // both are excluded so the `2026-09-18` in a status suffix is never read
    // as sequence 18. `/` is NOT excluded — it is a compound separator
    // (`001/-004/-005`), not a date fragment.
    const startsGroup = sawSeparator && !/[\d-–—]/.test(after)
    if (startsGroup) {
      const value = Number(text)
      if (value > 0 && value <= MAX_SEQ) numbers.push(value)
    }
    index += text.length
    sawSeparator = false
  }
  return numbers
}

/**
 * The sequence spans a short-form reference names: `FIDs 003–010` is 3..10 and
 * `FID-013` is just 13. Exported so the test legs can pin both shapes directly
 * rather than inferring them through the collector.
 */
export function parseShortForm(text: string): { start: number; end: number }[] {
  return [...text.matchAll(SHORT_FORM)].flatMap((match) => {
    const start = Number(match[1])
    const end = match[2] === undefined ? start : Number(match[2])
    return start > 0 && start <= MAX_SEQ ? [{ start, end }] : []
  })
}

/** The `YYYY-MMDD` prefixes a section establishes, for short-form resolution. */
function sectionPrefixes(section: string): Set<string> {
  // Case-insensitive on purpose: a record is referenced just as concretely by a
  // lowercase slug as by an uppercase id, and the v0.0.23 section carries its
  // whole `2026-0809` wave only inside a Nova inbox path
  // (`2026-08-09-fid-2026-0809-003-010-…`). A case-sensitive scan misses it
  // and the section's `FIDs 003–010` then has no date to resolve against.
  const prefixes = new Set(
    [...section.matchAll(/FID-(\d{4}-\d{4})-\d{3}/gi)].map(
      (match) => match[1] as string,
    ),
  )
  // The heading line only, not the body, so a section cannot absorb every month
  // it happens to mention: `## v0.0.23 — 2026-08-09` establishes `2026-0809`.
  const heading = /^##[^\n]*?(\d{4})-(\d{2})-(\d{2})/.exec(section)
  if (heading?.[1] && heading[2] && heading[3]) {
    prefixes.add(`${heading[1]}-${heading[2]}${heading[3]}`)
  }
  return prefixes
}

/**
 * Every FID id the changelog claims, with ranges, compounds, and short forms
 * expanded.
 *
 * A short form carries no date of its own, so it is resolved against the
 * `YYYY-MMDD` prefixes of the full ids in its OWN `##` section and nothing
 * else. Section scoping is the whole safety argument: without it a bare
 * `FID-013` could borrow a neighbouring section's month and silently cover the
 * wrong record. A section carrying no full id resolves no short forms at all,
 * which is the conservative direction — an unresolved short form leaves a
 * record counted as a gap rather than wrongly credited.
 */
export function collectCoveredFids(changelog: string): Set<string> {
  const covered = new Set<string>()
  for (const section of changelog.split(/(?=^## )/m)) {
    const prefixes = sectionPrefixes(section)
    for (const match of section.matchAll(/FID-(\d{4})-(\d{4})-(\d{3})/g)) {
      const seq = match[3] as string
      const base = `FID-${match[1]}-${match[2]}-`
      covered.add(`${base}${seq}`)
      const at = (match.index ?? 0) + match[0].length
      const siblings = parseEnumerationTail(section.slice(at, at + TAIL_WINDOW))
      if (siblings.length === 0) continue
      const lowest = Math.min(Number(seq), ...siblings)
      const highest = Math.max(Number(seq), ...siblings)
      for (let n = lowest; n <= highest; n += 1) {
        covered.add(`${base}${String(n).padStart(3, '0')}`)
      }
    }
    if (prefixes.size === 0) continue
    for (const { start, end } of parseShortForm(section)) {
      const lowest = Math.min(start, end)
      const highest = Math.max(start, end)
      for (const prefix of prefixes) {
        for (let n = lowest; n <= highest; n += 1) {
          covered.add(`FID-${prefix}-${String(n).padStart(3, '0')}`)
        }
      }
    }
  }
  return covered
}

/**
 * FID-2026-0927-002 step 3a — short-form references found in the changelog.
 *
 * `parseShortForm` exists so a range or abbreviated reference does not read as
 * a coverage gap, which is why the baseline reached zero. But that is a
 * *tolerance*: a released record whose work is documented only as
 * `FIDs 003–010` or a bare `FID-013` is invisible to a reader, which is exactly
 * the mis-attribution class the gate was built on. Surfacing short forms keeps
 * reintroduction visible without legislating notation — range notation is
 * legitimate house style (`FID-2026-0815-004..009`), so this reports rather
 * than rejects.
 */
export function collectAbbreviatedReferences(
  changelog: string,
): { section: string; text: string }[] {
  const found: { section: string; text: string }[] = []
  for (const section of changelog.split(/(?=^## )/m)) {
    const title =
      section
        .split('\n')[0]
        ?.replace(/^##\s*/, '')
        .trim() ?? ''
    if (!title) continue
    for (const match of section.matchAll(SHORT_FORM)) {
      found.push({ section: title, text: match[0].trim() })
    }
  }
  return found
}
