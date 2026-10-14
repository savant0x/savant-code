// FID-2026-0901-006 P14 — CLI design-language pass, tool display helpers.
//
// The CLI titles every tool block with a Title-Case display name
// (getToolDisplayInfo, `cli/src/utils/savant-code-client.ts:125`) and gives
// the collapse header a one-line preview derived from the tool's real input
// (`$ command` for terminals, `Create/Write path (N lines)` for writes, the
// first result line otherwise — `cli/src/components/blocks/tool-branch.tsx`).
// The desktop showed raw snake_case names and no preview. These pure helpers
// mirror that language so the desktop header reads exactly like the terminal.

import { truncateSingleLine } from '@savant-code/common/util/tool-display'

// FID-2026-1013-011 W2-1/W2-2: the Title-Case label and the single-line
// truncator are canonical in `@savant-code/common/util/tool-display` (the CLI
// `/copy`, `/export`, sidebar, and tool cards share them). The label is
// re-exported so `ToolCard` and this module's test keep their import site.
export { toolDisplayName } from '@savant-code/common/util/tool-display'

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

/** Coerce a nested JSON value to a plain object (fail-safe). */
function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  return value as { [key: string]: unknown }
}

/**
 * The payload a `set_output` call carries, mirroring the CLI
 * (`cli/src/components/tools/set-output.tsx`): a single `data` key is the
 * output wrapper and is unwrapped; otherwise the top-level fields are it.
 */
function setOutputPayload(input: Record<string, unknown>): unknown {
  const keys = Object.keys(input)
  if (keys.length === 1 && keys[0] === 'data') return input.data
  return input
}

/**
 * One-line `set_output` summary (W4-2): its `message` when present, else the
 * scalar verbatim, else compact JSON of the payload. Without this the generic
 * output-last-line read collapses a `set_output` card to a bare `}`.
 */
function setOutputPreview(input: Record<string, unknown>): string | null {
  const payload = setOutputPayload(input)
  const message =
    asObject(payload) === null ? null : asString(asObject(payload)?.message)
  if (message !== null && message.trim() !== '') {
    return truncateSingleLine(firstLine(message), PREVIEW_MAX_LENGTH)
  }
  if (typeof payload === 'string') {
    const text = firstLine(payload).trim()
    return text === '' ? null : truncateSingleLine(text, PREVIEW_MAX_LENGTH)
  }
  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return String(payload)
  }
  if (payload === null || payload === undefined) return null
  const json = JSON.stringify(payload)
  return json === undefined
    ? null
    : truncateSingleLine(json, PREVIEW_MAX_LENGTH)
}

function firstLine(text: string): string {
  return text.split('\n').find((line) => line.trim()) ?? ''
}

function sanitizePreview(value: string): string {
  return value.replace(/[#*_`~[\]()]/g, '').trim()
}

const PREVIEW_MAX_LENGTH = 120

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

  // W4-2: set_output owns a payload summary (message-first, `data` unwrapped)
  // and apply_patch owns a verb+path header, so neither falls through to the
  // bare `}` the JSON result's last line would produce.
  if (toolName === 'set_output') {
    return input === null ? null : setOutputPreview(input)
  }

  if (toolName === 'apply_patch') {
    if (input === null) return null
    const operation = asObject(input.operation)
    const path = asString(operation?.path ?? input.path)
    const type = operation === null ? null : asString(operation.type)
    if (path !== null) {
      const verb =
        type === 'create_file'
          ? 'Create'
          : type === 'delete_file'
            ? 'Delete'
            : 'Patch'
      return `${verb} ${path}`
    }
    // Flat legacy fixture: a patch body with no path field of its own.
    return asString(input.diff ?? input.patch) === null ? null : 'Patch'
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
      return truncateSingleLine(
        `…\n${lines.slice(-3).join('\n')}`,
        PREVIEW_MAX_LENGTH,
      )
    }
    const last = lines[lines.length - 1] ?? ''
    const sanitized = sanitizePreview(last)
    if (sanitized !== '')
      return truncateSingleLine(sanitized, PREVIEW_MAX_LENGTH)
  }

  if (input !== null) {
    for (const key of ['path', 'pattern', 'query', 'paths', 'url', 'skill']) {
      const value = input[key]
      if (typeof value === 'string' && value.trim() !== '') {
        return truncateSingleLine(
          sanitizePreview(firstLine(value)),
          PREVIEW_MAX_LENGTH,
        )
      }
      if (Array.isArray(value) && value.length > 0) {
        const paths = value.filter((v): v is string => typeof v === 'string')
        if (paths.length > 0) {
          return truncateSingleLine(paths.join(', '), PREVIEW_MAX_LENGTH)
        }
      }
    }
    const thought = asString(input.thought)
    if (thought !== null && thought.trim() !== '') {
      return truncateSingleLine(firstLine(thought), PREVIEW_MAX_LENGTH)
    }
  }

  return null
}

/**
 * Pretty JSON of a `set_output` call's actual payload (the single-`data`
 * wrapper unwrapped), so the expanded card shows the output the agent
 * published instead of the transport envelope around it (W4-2).
 */
export function setOutputPayloadJson(inputJson: string | null): string | null {
  const input = parseInput(inputJson)
  if (input === null) return null
  const json = JSON.stringify(setOutputPayload(input), null, 2)
  return json ?? null
}
