// FID-2026-0901-006 P16 — simple tool-item parsers (CLI parity).
//
// The CLI renders `web_search`, `read_url`, and `skill` through
// SimpleToolCallItem (`cli/src/components/tools/web-search.tsx`,
// `read-url.tsx`, `skill.tsx`): a compact `• Name description` line —
// search query, URL, or skill name — instead of the generic JSON view.
// Pure extractors mirroring that exact field access, never throw (Law 14).

export type SimpleToolItem = {
  /** CLI SimpleToolCallItem `name` (bold lead). */
  name: string
  /** CLI `description` (muted detail). */
  description: string
}

function parseInput(inputJson: string | null): Record<string, unknown> | null {
  if (inputJson === null) return null
  try {
    const value: unknown = JSON.parse(inputJson)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null
    }
    return value as { [key: string]: unknown }
  } catch {
    return null
  }
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** `web_search` → `Web Search <query>` (query required). */
export function parseWebSearchItem(
  inputJson: string | null,
): SimpleToolItem | null {
  const input = parseInput(inputJson)
  if (input === null) return null
  const query = trimmedString(input.query)
  if (query === null) return null
  return { name: 'Web Search', description: query }
}

/** `read_url` → `Read URL <url>` (url required). */
export function parseReadUrlItem(
  inputJson: string | null,
): SimpleToolItem | null {
  const input = parseInput(inputJson)
  if (input === null) return null
  const url = trimmedString(input.url)
  if (url === null) return null
  return { name: 'Read URL', description: url }
}

/** `skill` → `Load Skill <name>` (name required). */
export function parseSkillItem(
  inputJson: string | null,
): SimpleToolItem | null {
  const input = parseInput(inputJson)
  if (input === null) return null
  const skillName = trimmedString(input.name)
  if (skillName === null) return null
  return { name: 'Load Skill', description: skillName }
}
