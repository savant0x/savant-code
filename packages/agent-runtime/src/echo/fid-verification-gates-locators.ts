/**
 * @module echo/fid-verification-gates-locators
 *
 * FID Verification Gates — fence-aware document locators (FID-2026-0823-009).
 * Extracted verbatim from fid-verification-gates.ts under the 300-line
 * ceiling (FID-2026-0913-002 split discipline; zero behavior change). Pure
 * functions: parse and locate the contract's sections and byte spans.
 */

/** Strip fenced code blocks — documented examples (templates/FID-TEMPLATE.md) are
 * never parsed as real contract declarations; fence contents are documentation. */
export function withoutFencedBlocks(content: string): string {
  return content.replace(/```[^\s]*\n[\s\S]*?```/g, '')
}

/**
 * Extract a headed section up to the next same-or-higher heading (or EOF). `start`
 * is line-anchored (^ + $) so inline prose mentions never shadow the real section;
 * fenced examples are excluded first (withoutFencedBlocks).
 */
export function sectionBetween(
  content: string,
  start: RegExp,
  next: RegExp,
): string | undefined {
  const without = withoutFencedBlocks(content)
  const match = without.match(start)
  if (!match || match.index === undefined) return undefined
  const after = without.slice(match.index + match[0].length)
  const nextMatch = after.search(next)
  return nextMatch === -1 ? after : after.slice(0, nextMatch)
}

/** The `## Verification Gates` section body (declarations + receipt). */
export function verificationGatesSection(content: string): string | undefined {
  return sectionBetween(content, /^## Verification Gates\s*$/m, /^## /m)
}

/**
 * The receipt region on the fence-stripped view, as an exact byte span:
 * the anchored heading match (heading + consumed line terminator) plus the
 * body up to the next heading. ONE shared locator so the block reader
 * (`receiptBlock`) and the fingerprint (`computeFidFingerprint`, which
 * removes exactly this span) always agree on the region's byte extent
 * (FID-2026-0907-010: the old literal-length removal was one byte short,
 * leaving a stray line terminator in the hashed view and making every
 * FIRST receipt stamp validate as stale).
 */
export function receiptSpan(
  stripped: string,
): { start: number; headingLength: number; length: number } | undefined {
  const headingMatch = stripped.match(/^### Verification Receipt\s*$/m)
  if (!headingMatch || headingMatch.index === undefined) return undefined
  const after = stripped.slice(headingMatch.index + headingMatch[0].length)
  const next = after.search(/^(## |### )/m)
  const block = next === -1 ? after : after.slice(0, next)
  return {
    start: headingMatch.index,
    headingLength: headingMatch[0].length,
    length: headingMatch[0].length + block.length,
  }
}

/** The `### Verification Receipt` block inside the gates section. */
export function receiptBlock(content: string): string | undefined {
  const stripped = withoutFencedBlocks(content)
  const span = receiptSpan(stripped)
  if (!span) return undefined
  return stripped.slice(
    span.start + span.headingLength,
    span.start + span.length,
  )
}
