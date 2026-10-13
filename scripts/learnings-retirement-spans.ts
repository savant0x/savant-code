import { LEARNINGS_INSERTION_MARKER } from './learnings-schema.js'

/** Structural prose after a lesson stays in place when its fields retire. */
function retainedTailStart(block: string): number {
  let lastFieldEnd = -1
  for (const match of block.matchAll(/^- \*\*[^*]+:\*\*.*$/gm))
    lastFieldEnd = (match.index ?? 0) + match[0].length
  if (lastFieldEnd !== -1) {
    const newline = block.indexOf('\n', lastFieldEnd)
    return newline === -1 ? block.length : newline + 1
  }
  return block.indexOf(LEARNINGS_INSERTION_MARKER)
}

/** Shared by planning and journal validation; untouched bytes retain their order. */
export function removeLessonSpans(
  content: string,
  titles: Set<string>,
): string {
  const parts = content.split(/^## Lesson:/m)
  let out = parts[0] ?? ''
  for (let i = 1; i < parts.length; i += 1) {
    const block = parts[i] ?? ''
    const title = (block.split('\n', 1)[0] ?? '').trim()
    if (!titles.has(title)) {
      out += `## Lesson:${block}`
      continue
    }
    const tailStart = retainedTailStart(block)
    if (tailStart !== -1) out += block.slice(tailStart)
  }
  return out
}
