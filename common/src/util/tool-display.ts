/**
 * Canonical tool-display primitives (FID-2026-1013-011 Wave 2 — ECHO Law 13,
 * "one function, one truth").
 *
 * Six copies of these helpers had drifted across the tree: three Title-Case
 * `toolDisplayName`s (plus the CLI client's inline variant), four
 * `truncateSingleLine`s, a byte-identical `renderToolInput`/`renderToolOutput`
 * pair shared by `/copy` and `/export`, and two `sequentialthinking` coercion
 * helpers whose Desktop copy silently dropped stringified numeric/boolean
 * fields the CLI accepted. This module is their one home; every registered
 * name points here in `scripts/eslint-rules/shared-primitives.json`, so a
 * future copy fails `savant/no-duplicate-shared-primitive` mechanically.
 *
 * `cli/src/components/right-sidebar-format.ts` keeps a deliberately different,
 * sentence-case label — it lives there under the disambiguated name
 * `sidebarToolDisplayName` so `toolDisplayName` is unambiguously Title-Case
 * repo-wide.
 */

/** Hand-written labels that beat the mechanical Title-Case transform. */
const TOOL_DISPLAY_OVERRIDES: Readonly<Record<string, string>> = {
  list_directory: 'List Directories',
}

/**
 * Human-friendly tool label, e.g. `read_files` → `Read Files` and
 * `list_directory` → `List Directories`.
 *
 * An MCP `server__tool` identifier keeps only the tool half, so a label never
 * leaks the server namespace it was mounted under.
 */
export function toolDisplayName(toolName: string): string {
  const override = TOOL_DISPLAY_OVERRIDES[toolName]
  if (override !== undefined) return override
  const bare = toolName.includes('__')
    ? toolName.split('__').slice(1).join('_')
    : toolName
  return bare
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/**
 * Collapse every whitespace run to a single line and cap the result at
 * `maxLength` characters. The cap counts the `…` suffix, so the returned
 * string never exceeds `maxLength` (callers pass their own ceiling: 160 for
 * the CLI tool cards, 120 for the desktop collapse header).
 */
export function truncateSingleLine(value: string, maxLength = 160): string {
  const line = value.replace(/\s+/g, ' ').trim()
  return line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line
}

/**
 * Pretty-print a tool input for a transcript. `''` for `null`/`undefined` and
 * for containers with nothing in them — a tool call with no input renders as a
 * bare header rather than an empty code block. Never throws: a circular or
 * otherwise unserializable value degrades to `String(input)` (Law 14).
 */
export function renderToolInput(input: unknown): string {
  if (input == null) return ''
  if (
    (Array.isArray(input) && input.length === 0) ||
    (typeof input === 'object' &&
      !Array.isArray(input) &&
      Object.keys(input as Record<string, unknown>).length === 0)
  ) {
    return ''
  }
  try {
    return JSON.stringify(input, null, 2)
  } catch {
    return String(input)
  }
}

/**
 * Tool results are stored as strings; many are a JSON envelope (e.g. the
 * `[{"type":"json","value":{...}}]` shape from terminal/tool calls).
 * Pretty-print when the string parses as JSON so the transcript is readable;
 * otherwise keep the raw text. Returns the fence language to use alongside the
 * body.
 */
export function renderToolOutput(output: string): {
  body: string
  lang: string
} {
  const trimmed = output.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return {
        body: JSON.stringify(JSON.parse(trimmed), null, 2),
        lang: 'json',
      }
    } catch {
      // Not valid JSON — fall through to raw.
    }
  }
  return { body: output, lang: '' }
}

/**
 * Coerce a block-level input value to a positive integer, or `undefined`.
 *
 * Streaming/print-mode tool inputs can arrive with stringified primitives, so
 * a numeric string coerces exactly like the params schema's
 * `z.coerce.number().int().min(1)` does — the Desktop `sequentialthinking`
 * parser previously rejected `"3"` here while the CLI accepted it.
 */
export function asPositiveInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) {
    return value
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed >= 1) return parsed
  }
  return undefined
}

/**
 * Coerce a block-level boolean, or `undefined` when the value carries no
 * boolean meaning. Mirrors the params schema's coerced boolean, so `"true"` /
 * `"false"` from a stringified payload coerce instead of being dropped.
 */
export function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}
