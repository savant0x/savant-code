/**
 * fid-receipt-stamp — receipt block insertion for fid:verify (FID-2026-0823-009).
 * Extracted verbatim from fid-verify.ts under the 300-line ceiling
 * (FID-2026-0913-002 split discipline; zero behavior change).
 */

/**
 * Byte span of the first line matching `pattern` on its own line, outside
 * fenced blocks. Line-anchored + fence-aware: prose, backticked, or fenced
 * mentions of a heading can never hijack the stamp (FID-2026-0907-010).
 */
function findHeadingLine(
  content: string,
  pattern: RegExp,
): { start: number; end: number } | undefined {
  let offset = 0
  let fenced = false
  for (const line of content.split('\n')) {
    if (line.trimStart().startsWith('```')) fenced = !fenced
    else if (!fenced && pattern.test(line))
      return { start: offset, end: offset + line.length }
    offset += line.length + 1
  }
  return undefined
}

/** Insert (or replace) the receipt block after the `## Verification Gates` section. */
export function stampReceipt(content: string, receipt: string): string {
  const existing = findHeadingLine(content, /^###\s+Verification Receipt\s*$/)
  if (existing) {
    // Search for the next heading AFTER the receipt heading line.
    const after = content.slice(existing.end + 1)
    const next = after.search(/^(## |### )/m)
    const tail = next === -1 ? '' : after.slice(next)
    return `${content.slice(0, existing.start).trimEnd()}\n\n${receipt}\n\n${tail.trimStart()}`
  }
  const gates = findHeadingLine(content, /^##\s+Verification Gates\s*$/)
  if (!gates) return `${content.trimEnd()}\n\n${receipt}\n`
  const after = content.slice(gates.end + 1)
  const next = after.search(/^## |^### /m)
  if (next === -1) return `${content.trimEnd()}\n\n${receipt}\n`
  const insertAt = gates.end + 1 + next
  return (
    content.slice(0, insertAt).trimEnd() +
    `\n\n${receipt}\n\n` +
    content.slice(insertAt).trimStart()
  )
}
