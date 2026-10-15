/**
 * Pure presentation helpers for research-source results.
 *
 * Extracted from research-sources.ts so the selector module stays within the
 * 300-line new-file cap. These helpers have zero internal imports and no
 * side effects — they are deterministic functions of their inputs, which is
 * what makes them independently unit-testable and safe to move without
 * touching any call-graph edge.
 */

/**
 * Parse a search facade's `{ organic: [...] }` JSON result into flat hits.
 * Returns [] for a malformed payload or a non-organic shape.
 */
export function parseOrganicHits(result: string): Array<{
  title?: string
  link?: string
  snippet?: string
}> {
  try {
    const parsed = JSON.parse(result) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>
    }
    return Array.isArray(parsed.organic) ? parsed.organic : []
  } catch {
    return []
  }
}

/**
 * Format a search facade's `{ organic: [...] }` JSON result into readable
 * documentation text (title + link + snippet per hit). Full page content is
 * left to the agent's SSRF-guarded `read_url` — this returns the discovery
 * layer plus enough context to decide which URL to fetch.
 */
export function formatOrganicAsDocumentation(
  result: string,
  libraryTitle: string,
  topic?: string,
): string | null {
  const hits = parseOrganicHits(result).filter((hit) => hit.title || hit.link)
  if (hits.length === 0) return null

  const heading =
    `Documentation for "${libraryTitle}"` +
    (topic ? ` (topic: ${topic})` : '') +
    ' — top results:\n'
  const lines = hits.map((hit) => {
    const title = hit.title ?? hit.link ?? ''
    const link = hit.link ? `\n  ${hit.link}` : ''
    const snippet = hit.snippet ? `\n  ${hit.snippet}` : ''
    return `- ${title}${link}${snippet}`
  })
  return heading + lines.join('\n')
}

/** Rough token bound (4 chars/token — the same heuristic as Context7 path). */
export function boundDocumentation(text: string, maxTokens?: number): string {
  if (typeof maxTokens !== 'number' || maxTokens <= 0) return text
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n\n[truncated]'
}
