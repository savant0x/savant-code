interface DiffLine {
  kind: ' ' | '-' | '+'
  text: string
}
const MAX_LCS_CELLS = 1_000_000

/** Linear-space LCS reconstruction: exact changes without index-shift noise. */
function lcsLengths(a: string[], b: string[]): Uint32Array {
  const row = new Uint32Array(b.length + 1)
  for (const line of a) {
    let diagonal = 0
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]
      row[j] = line === b[j - 1] ? diagonal + 1 : Math.max(above, row[j - 1])
      diagonal = above
    }
  }
  return row
}

function commonLines(a: string[], b: string[]): string[] {
  if (a.length === 0 || b.length === 0) return []
  if (a.length === 1) return b.includes(a[0]) ? [a[0]] : []
  const middle = Math.floor(a.length / 2)
  const left = lcsLengths(a.slice(0, middle), b)
  const right = lcsLengths(a.slice(middle).reverse(), [...b].reverse())
  let split = 0
  for (let j = 1; j <= b.length; j++) {
    if (left[j] + right[b.length - j] > left[split] + right[b.length - split])
      split = j
  }
  return [
    ...commonLines(a.slice(0, middle), b.slice(0, split)),
    ...commonLines(a.slice(middle), b.slice(split)),
  ]
}

function lineChanges(a: string[], b: string[]): DiffLine[] {
  const lines: DiffLine[] = []
  let i = 0,
    j = 0
  for (const common of commonLines(a, b)) {
    while (a[i] !== common) lines.push({ kind: '-', text: a[i++] })
    while (b[j] !== common) lines.push({ kind: '+', text: b[j++] })
    lines.push({ kind: ' ', text: common })
    i++
    j++
  }
  for (; i < a.length; i++) lines.push({ kind: '-', text: a[i] })
  for (; j < b.length; j++) lines.push({ kind: '+', text: b[j] })
  return lines
}

/** Bounded unified review; oversized LCS inputs are explicitly refused. */
export function computeUnifiedSkillDiff(
  live: string,
  draft: string,
  options: {
    contextLines?: number
    maxOutputLines?: number
  } = {},
): string {
  if (live === draft) return '(identical)'
  const a = live.replace(/\r\n/g, '\n').split('\n')
  const b = draft.replace(/\r\n/g, '\n').split('\n')
  if (a.length * b.length > MAX_LCS_CELLS)
    return '(diff exceeds safe LCS budget; review the full draft and live files)'
  const lines = lineChanges(a, b)
  const removed = lines.filter((line) => line.kind === '-').length
  const added = lines.filter((line) => line.kind === '+').length
  if (!removed && !added) return '(identical)'
  const out = [`[-${removed}/+${added} lines]`]
  const context = Math.max(0, Math.min(options.contextLines ?? 2, 10))
  const cap = Math.max(3, Math.min(options.maxOutputLines ?? 80, 80))
  const ranges: { start: number; end: number }[] = []
  lines.forEach((line, index) => {
    if (line.kind === ' ') return
    const start = Math.max(0, index - context),
      end = Math.min(lines.length, index + context + 1)
    const last = ranges.at(-1)
    if (last && start <= last.end) last.end = end
    else ranges.push({ start, end })
  })
  for (const { start, end } of ranges) {
    const oldStart = lines
      .slice(0, start)
      .filter((line) => line.kind !== '+').length
    const newStart = lines
      .slice(0, start)
      .filter((line) => line.kind !== '-').length
    const hunk = lines.slice(start, end)
    const oldCount = hunk.filter((line) => line.kind !== '+').length
    const newCount = hunk.filter((line) => line.kind !== '-').length
    out.push(
      `@@ -${oldCount ? oldStart + 1 : oldStart},${oldCount} +${newCount ? newStart + 1 : newStart},${newCount} @@`,
    )
    out.push(...hunk.map((line) => `${line.kind} ${line.text}`))
  }
  return out.length > cap
    ? [...out.slice(0, cap - 1), '… diff truncated; review full files'].join(
        '\n',
      )
    : out.join('\n')
}
