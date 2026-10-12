/**
 * Envelope-tag recognition for the stream XML parser (FID-2026-1012-002).
 *
 * Extracted from `stream-xml-parser.ts` when that module crossed the 300-line
 * ceiling: the tag vocabulary and the two recognition helpers are a self-
 * contained concern (which tags count as protocol markup, and which tool-call
 * -shaped tags must be discarded rather than rendered).
 */
import { toolXmlName } from '@savant-code/common/tools/constants'

export const startToolTag = `<${toolXmlName}>`
export const endToolTag = `</${toolXmlName}>`
export const legacyStartToolTag = '<tool_call>'
export const legacyEndToolTag = '</tool_call>'

/**
 * FID-2026-1012-002: envelope names that are the canonical envelope written
 * with the wrong prefix or case. Models do emit these (an observed
 * `<SAVANT_TOOL_CALL>` block reached the user as raw JSON), and a near-miss is
 * still protocol markup — it must be recognized rather than rendered.
 */
const ENVELOPE_ALIASES: readonly string[] = [
  toolXmlName,
  'savant_tool_call',
  'codebuff_tool_call',
]

/** Any `<...tool_call...>`-shaped tag, at any case, with or without `code`. */
const TOOL_CALL_SHAPED_TAG = /<\s*(\/?)\s*([a-z0-9_]*tool_call[a-z0-9_]*)\s*>/i

/**
 * Rewrite a recognized alias (or a case variant of one) to the canonical bare
 * tag, so the parser's state machine matches exactly one form.
 */
export function normalizeEnvelopeTags(text: string): string {
  return text.replace(
    /<\s*(\/?)\s*([a-z0-9_]*tool_call[a-z0-9_]*)\s*>/gi,
    (match: string, slash: string, rawName: string) => {
      const name = rawName.toLowerCase()
      if (!ENVELOPE_ALIASES.includes(name)) return match
      return slash === '/' ? endToolTag : startToolTag
    },
  )
}

/**
 * The first tool-call-shaped tag that is NOT the canonical envelope, with its
 * name and raw length — so an unrecognized envelope can be discarded rather
 * than leaked. Returns null when the chunk holds no such tag.
 */
export function findForeignToolCallTag(
  text: string,
): { index: number; name: string; length: number } | null {
  const match = TOOL_CALL_SHAPED_TAG.exec(text)
  if (match?.index === undefined) return null
  // A closing tag on its own has no content to discard.
  if (match[1] === '/') return null
  const name = match[2]?.toLowerCase() ?? ''
  if (ENVELOPE_ALIASES.includes(name)) return null
  return { index: match.index, name, length: match[0].length }
}
