import type { JSONValue } from '@savant-code/common/types/json'

const CONTROL_TAG =
  /<\/?\s*(system|user|assistant|environment_context|compaction-notice|evidence-restored|skill_instructions|echo-refresh)\b[^>]*>/gi
const OVERRIDE =
  /\b(?:(?:ignore|disregard)\s+(?:all\s+)?(?:previous|prior)\s+(?:instructions|rules)|system\s+override\s*:|you\s+are\s+now\s+in\s+(?:unrestricted|developer|sudo)\s+mode)/gi
const MAX_NODES = 2048
const MAX_DEPTH = 16

/** Untrusted reports remain data; neither tags nor override text become control. */
export function sanitizeSubagentReport(input: JSONValue): {
  output: JSONValue
  sanitized: boolean
  detectedTags: string[]
  detectedCategories: string[]
} {
  const tags = new Set<string>(),
    categories = new Set<string>()
  let nodes = 0
  const text = (value: string): string =>
    value
      .replace(CONTROL_TAG, (match: string, tag: string) => {
        tags.add(tag.toLowerCase())
        categories.add('control-tag')
        return match.replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      })
      .replace(OVERRIDE, () => {
        categories.add('instruction_override')
        return '[blocked untrusted subagent instruction_override]'
      })
  const walk = (value: JSONValue, depth: number): JSONValue => {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) {
      categories.add('traversal-limit')
      return '[untrusted report omitted: traversal limit]'
    }
    if (typeof value === 'string') return text(value)
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) {
      const result = value
        .slice(0, Math.max(0, MAX_NODES - nodes))
        .map((entry) => walk(entry, depth + 1))
      if (result.length < value.length) {
        categories.add('traversal-limit')
        result.push('[remaining report omitted]')
      }
      return result
    }
    const entries: [string, JSONValue][] = []
    for (const [key, entry] of Object.entries(value)) {
      if (nodes >= MAX_NODES) {
        categories.add('traversal-limit')
        entries.push(['reportOmitted', '[remaining report omitted]'])
        break
      }
      entries.push([text(key), walk(entry, depth + 1)])
    }
    return Object.fromEntries(entries)
  }
  const output = walk(input, 0)
  return {
    output,
    sanitized: categories.size > 0,
    detectedTags: [...tags].sort(),
    detectedCategories: [...categories].sort(),
  }
}
