// FID-2026-0901-006 P14 — CLI design-language pass, tool display helpers.
//
// The CLI titles every tool block with a Title-Case display name
// (getToolDisplayInfo, `cli/src/utils/savant-code-client.ts:125`) and gives
// the collapse header a one-line preview derived from the tool's real input
// (`$ command` for terminals, `Create/Write path (N lines)` for writes, the
// first result line otherwise — `cli/src/components/blocks/tool-branch.tsx`).
// The desktop showed raw snake_case names and no preview. These pure helpers
// mirror that language so the desktop header reads exactly like the terminal.

/** Title-Case a snake_case tool name, with the CLI's one override. */
export function toolDisplayName(toolName: string): string {
  const overrides: Record<string, string> = {
    list_directory: 'List Directories',
  }
  const capitalized = toolName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
  return overrides[toolName] ?? capitalized
}

/** Coerce a block-level input JSON string to an object (fail-safe). */
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

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function firstLine(text: string): string {
  return text.split('\n').find((line) => line.trim()) ?? ''
}

function sanitizePreview(value: string): string {
  return value.replace(/[#*_`~[\]()]/g, '').trim()
}

const PREVIEW_MAX_LENGTH = 120

function truncateSingleLine(value: string): string {
  const line = value.replace(/\s+/g, ' ').trim()
  return line.length > PREVIEW_MAX_LENGTH
    ? `${line.slice(0, PREVIEW_MAX_LENGTH - 1)}…`
    : line
}

/**
 * One-line collapsed-header preview, mirroring the CLI's per-tool previews:
 * - run_terminal_command → `$ <command>`
 * - write_file → `Create|Write <path> (N lines)` (Create vs Write resolved
 *   from the tool result message, same as the CLI's isCreateFile)
 * - read_files / glob / list_directory / code_search → first meaningful input value
 * - otherwise → first non-empty OUTPUT line (the CLI's "last line" read),
 *   falling back to the first input line when no output exists yet.
 */
export function toolCollapsedPreview(
  toolName: string,
  inputJson: string | null,
  outputText: string | null,
): string | null {
  // Structured tools own a dedicated preview in the card (ThinkingBlock
  // "💭 Thought N/M" or the TODOs ✓/○ count). Defer to it rather than the
  // generic output-last-line read, which grabs a bare `}` from their JSON
  // result. The card's preview chain already falls through to those.
  if (
    toolName === 'sequentialthinking' ||
    toolName === 'write_todos' ||
    toolName === 'suggest_followups'
  ) {
    return null
  }

  const input = parseInput(inputJson)

  if (toolName === 'run_terminal_command') {
    const command = input === null ? null : asString(input.command)
    return command === null ? null : `$ ${command.trim()}`
  }

  if (toolName === 'write_file') {
    if (input === null) return null
    const path = asString(input.path)
    if (path === null) return null
    const content = asString(input.content) ?? ''
    const lineCount = content.length === 0 ? 0 : content.split('\n').length
    // CLI isCreateFile: the result message says "Created file successfully",
    // "Created new file", or "Proposed new file".
    const message = outputText ?? ''
    const isCreate =
      message.includes('Created file successfully') ||
      message.includes('Created new file') ||
      message.includes('Proposed new file')
    return `${isCreate ? 'Create' : 'Write'} ${path} (${lineCount} lines)`
  }

  if (outputText !== null && outputText.trim() !== '') {
    const lines = outputText.split('\n').filter((line) => line.trim())
    if (lines.length > 3 && toolName === 'run_terminal_command') {
      return truncateSingleLine(`…\n${lines.slice(-3).join('\n')}`)
    }
    const last = lines[lines.length - 1] ?? ''
    const sanitized = sanitizePreview(last)
    if (sanitized !== '') return truncateSingleLine(sanitized)
  }

  if (input !== null) {
    for (const key of ['path', 'pattern', 'query', 'paths', 'url', 'skill']) {
      const value = input[key]
      if (typeof value === 'string' && value.trim() !== '') {
        return truncateSingleLine(sanitizePreview(firstLine(value)))
      }
      if (Array.isArray(value) && value.length > 0) {
        const paths = value.filter((v): v is string => typeof v === 'string')
        if (paths.length > 0) {
          return truncateSingleLine(paths.join(', '))
        }
      }
    }
    const thought = asString(input.thought)
    if (thought !== null && thought.trim() !== '') {
      return truncateSingleLine(firstLine(thought))
    }
  }

  return null
}
