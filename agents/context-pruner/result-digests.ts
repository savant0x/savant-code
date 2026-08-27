/**
 * Result-digest recipes for the context-pruner preservation contract
 * (FID-2026-0824-024). A tool result that matches no special summary case in
 * `summarize-messages.ts` still contributes a bounded digest here — read /
 * search / web evidence is never silently dropped again.
 *
 * Embeddable by design: the handleSteps factory serializes these functions
 * via `.toString()` (FID-2026-0802-005 L5), so bodies may reference ONLY
 * parameters, locals, and factory-baked constants — never module-level state
 * or imports at generation time. The `./constants` import below exists for
 * source-tree typecheck only; the factory bakes those names as literals.
 */
import { DIGEST_HEAD_CHARS, DIGEST_TAIL_CHARS } from './constants'

/** Structural view of a tool-result content part (no runtime imports). */
export type DigestContentPart = {
  type?: unknown
  text?: unknown
  value?: unknown
}

/**
 * Build a bounded digest line for an otherwise-unpreserved tool result.
 * Returns null only when there is nothing to preserve (empty content).
 *
 * Shape: `[digest] <tool> bytes=<n>[ identity]\nHEAD:\n<first N chars>[…TAIL:\n<last M chars>]`
 */
export function buildResultDigest(
  toolName: string,
  content: readonly DigestContentPart[] | string | null | undefined,
  caps?: { headChars?: number; tailChars?: number },
): string | null {
  let serialized: string | null = null
  if (typeof content === 'string') {
    serialized = content
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      if (part.type === 'json' && part.value != null) {
        serialized =
          typeof part.value === 'string'
            ? part.value
            : JSON.stringify(part.value)
        break
      }
      if (part.type === 'text' && typeof part.text === 'string') {
        serialized = part.text
        break
      }
    }
  }
  if (serialized === null || serialized.length === 0) return null

  const byteSize = serialized.length

  // Identity heuristics over the first JSON-object part: common result fields
  // that name WHAT was inspected (path/query/url/command families).
  let identity = ''
  if (Array.isArray(content)) {
    const fields = [
      'path',
      'file',
      'filePath',
      'query',
      'pattern',
      'url',
      'command',
      'libraryTitle',
    ]
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      if (part.type !== 'json' || part.value == null) continue
      if (typeof part.value !== 'object') continue
      const obj = part.value as Record<string, unknown>
      for (const field of fields) {
        const v = obj[field]
        if (typeof v === 'string' && v.length > 0) {
          identity = `${field}=${v}`
          break
        }
        if (Array.isArray(v)) {
          const strs = v.filter(
            (item): item is string => typeof item === 'string',
          )
          if (strs.length > 0) {
            identity = `${field}=${strs.slice(0, 3).join(', ')}${
              strs.length > 3 ? ', …' : ''
            }`
            break
          }
        }
      }
      if (identity.length > 0) break
    }
  }

  // FID-2026-0824-024 post-closure amendment: operator-configured caps
  // override the baked defaults (embeddable-safe — params/locals only).
  const headChars = caps?.headChars ?? DIGEST_HEAD_CHARS
  const tailChars = caps?.tailChars ?? DIGEST_TAIL_CHARS
  const head = serialized.slice(0, headChars)
  const tail =
    byteSize > headChars + tailChars
      ? `\n…TAIL:\n${serialized.slice(-tailChars)}`
      : ''
  const idLine = identity.length > 0 ? ` ${identity}` : ''

  return `[digest] ${toolName} bytes=${byteSize}${idLine}\nHEAD:\n${head}${tail}`
}
