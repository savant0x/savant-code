// FID-2026-0820-010 Step 4 — pure diff-payload parser.
//
// Extracts a renderable diff from the structured tool_call inputs the
// transcript already carries, so edit-class tools render as real diffs
// instead of raw JSON. Pure function: (toolName, inputJson) => payload|null,
// never throws — malformed input degrades to null and the caller falls back
// to the raw JSON view (Law 14).

export interface DiffLine {
  type: 'add' | 'del' | 'ctx'
  text: string
}

export interface DiffHunk {
  header: string | null
  lines: DiffLine[]
}

export interface DiffPayload {
  path: string | null
  hunks: DiffHunk[]
}

/** Tools whose structured input always yields a renderable diff. */
const DIFF_TOOLS = new Set([
  'str_replace',
  'edit_file',
  'apply_patch',
  'propose_write_file',
  'write_file',
])

function parseJsonObject(
  inputJson: string | null,
): Record<string, unknown> | null {
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

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function linesOf(text: string, type: DiffLine['type']): DiffLine[] {
  return text.split('\n').map((line) => ({ type, text: line }))
}

/**
 * Parse one apply_patch-style patch body. Meta lines (`*** Begin Patch`,
 * `*** Update File: …`, `*** End Patch`) are structural, not content;
 * `@@` opens a hunk header; `+`/`-` classify; everything else is context.
 */
function parsePatch(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null
  for (const line of diff.split('\n')) {
    if (line.startsWith('***')) continue
    if (line.startsWith('@@')) {
      current = { header: line, lines: [] }
      hunks.push(current)
      continue
    }
    if (current === null) {
      current = { header: null, lines: [] }
      hunks.push(current)
    }
    if (line.startsWith('+')) {
      current.lines.push({ type: 'add', text: line.slice(1) })
    } else if (line.startsWith('-')) {
      current.lines.push({ type: 'del', text: line.slice(1) })
    } else {
      current.lines.push({ type: 'ctx', text: line })
    }
  }
  return hunks.filter((hunk) => hunk.lines.length > 0)
}

/** Best-effort target path from patch meta or git-style file headers. */
function extractPatchPath(diff: string): string | null {
  for (const line of diff.split('\n')) {
    const codex = /^\*\*\* (?:Update|Add|Delete) File: (.+)$/.exec(line)
    if (codex !== null) return codex[1].trim()
    const git = /^-{3} (?:[ab]\/)?(.+)$/.exec(line)
    if (git !== null && git[1].trim() !== 'dev/null') return git[1].trim()
  }
  return null
}

/**
 * Parse the structured input of an edit-class tool call into a diff payload.
 * Returns null when the tool carries no diff-shaped input or the JSON is
 * malformed — callers fall back to the raw JSON rendering.
 */
export function parseDiffInput(
  toolName: string,
  inputJson: string | null,
): DiffPayload | null {
  if (!DIFF_TOOLS.has(toolName)) return null
  const input = parseJsonObject(inputJson)
  if (input === null) return null

  if (toolName === 'str_replace' || toolName === 'edit_file') {
    const oldString = asString(input.oldString ?? input.old_string)
    const newString = asString(input.newString ?? input.new_string)
    if (oldString === null || newString === null) return null
    return {
      path: asString(input.path ?? input.file_path),
      hunks: [
        {
          header: null,
          lines: [...linesOf(oldString, 'del'), ...linesOf(newString, 'add')],
        },
      ],
    }
  }

  if (toolName === 'apply_patch') {
    const diff = asString(input.diff ?? input.patch)
    if (diff === null) return null
    const hunks = parsePatch(diff)
    if (hunks.length === 0) return null
    return { path: asString(input.path) ?? extractPatchPath(diff), hunks }
  }

  // write_file family: the whole-file snapshot renders as one all-add hunk.
  const content = asString(input.content)
  if (content === null) return null
  return {
    path: asString(input.path ?? input.file_path),
    hunks: [{ header: null, lines: linesOf(content, 'add') }],
  }
}
