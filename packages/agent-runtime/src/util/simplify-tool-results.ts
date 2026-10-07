import { getErrorObject } from '@savant-code/common/util/error'
import { cloneDeep } from 'lodash'

import { buildOmissionMarker, retentionProof } from './omission-marker'

import type { OmissionMarker } from './omission-marker'
import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'

// ===========================================================================
// P2c — generalized deterministic tool-output truncation (FID-2026-0806-003)
//
// Unbounded tool payloads (grep/glob/search/db/URL results) are a primary
// vector for token exhaustion. This cheap no-LLM pre-pass truncates verbose
// tool outputs to deterministic byte/line limits BEFORE they reach the summary
// or next LLM call (research Layer 3: 50 000 B API/db, 2 000-line grep,
// 500-char preview + pointer).
//
// ===========================================================================
// FID-2026-1007-004 step 3 — the pointer is now a locator, or there is no drop.
//
// Every destructive branch in this module used to tell the model that the bytes
// were available somewhere it could not reach: `truncateToolOutputValue` named a
// cache-debug snapshot that is disabled by default, and the other three branches
// named nothing at all. One marker shape replaces all of it
// (`./omission-marker`), and one rule governs it: a transform may discard
// model-facing bytes ONLY on the strength of a retention handle the tool-result
// boundary proved it wrote. The handle arrives through
// `evidence/retention-registry.ts` (the boundary is async and runs first; these
// transforms are sync and run later, in the same process). No handle ⇒ the
// payload is returned UNTOUCHED, because a refusal is not a loss.
//
// `fullOutput` is deleted. It was a fixed string naming two possibilities,
// neither of them a location, and no consumer read it (measured repo-wide).
//
// One deliberate asymmetry: the OBJECT branch attaches its marker without a
// handle, because it preserves every field — attaching a marker there discards
// nothing. Every branch that REPLACES bytes with a marker requires the handle.
// ===========================================================================

export const TOOL_OUTPUT_LIMITS = {
  /** Hard byte cap for API/database-style results. */
  maxBytes: 50_000,
  /** Hard line cap for search/grep-style results. */
  maxLines: 2_000,
  /** Preview length kept after truncation (plus a locator to the full data). */
  previewChars: 500,
} as const

/** Tool names whose results are routinely large enough to need the pre-pass. */
export const VERBOSE_TOOL_NAMES: ReadonlySet<string> = new Set([
  'code_search',
  'glob',
  'list_directory',
  'find_files',
  'read_subtree',
  'read_url',
  'web_search',
  'gravity_index',
  'read_docs',
  'run_readonly_command',
])

export type ToolOutputLimits = {
  maxBytes: number
  maxLines: number
  previewChars: number
}

// The marker's shape and the proof lookup live in `./omission-marker` (ceiling
// split); re-exported so this module keeps its public surface.
export { buildOmissionMarker, retentionProof } from './omission-marker'
export type { OmissionMarker, OmissionRetention } from './omission-marker'

/**
 * Truncates a tool-result JSON value to the deterministic limits. Returns the
 * original value when it already fits; when it does not, returns a trimmed value
 * with a single `omitted` marker describing what was taken AND where it went.
 * Never throws — a non-serializable value is passed through untouched.
 *
 * `toolCallId` is the identity the retention verdict is keyed by. Without a
 * verdict for it the value is returned UNCHANGED (by reference), because bytes
 * nobody stored must not be discarded.
 *
 * Line counting: JSON.stringify escapes real newlines as `\\n` (backslash-n),
 * so the serialized form's `\\n` sequences are what represent output lines
 * (grep/glob-style string payloads). An over-line value is cut at that
 * boundary; the `omitted.preview` keeps the first `previewChars` chars.
 */
export function truncateToolOutputValue(
  value: JSONValue,
  limits: Partial<ToolOutputLimits> = {},
  toolCallId?: string,
): JSONValue {
  const maxBytes = limits.maxBytes ?? TOOL_OUTPUT_LIMITS.maxBytes
  const maxLines = limits.maxLines ?? TOOL_OUTPUT_LIMITS.maxLines
  const previewChars = limits.previewChars ?? TOOL_OUTPUT_LIMITS.previewChars

  let json: string
  try {
    json = JSON.stringify(value)
  } catch {
    return value
  }
  if (json === undefined) return value

  // Escaped newlines (`\\n` in the serialized form) represent real output
  // lines. If neither cap is exceeded, pass the value through by reference.
  const lineCount = json.split('\\n').length
  if (json.length <= maxBytes && lineCount <= maxLines) {
    return value
  }

  const originalChars = json.length
  const limitReason =
    originalChars > maxBytes
      ? `output exceeded ${maxBytes} bytes`
      : `output exceeded ${maxLines} lines`
  const retained = retentionProof(toolCallId)

  // Objects keep their own fields, so attaching the marker takes nothing away
  // and needs no handle. `omittedChars` is therefore 0 here, and the marker says
  // so rather than reporting a cap it did not apply.
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const keptJson = JSON.stringify(value) ?? ''
    return {
      ...(value as Record<string, JSONValue>),
      omitted: buildOmissionMarker({
        limitReason,
        originalChars,
        keptChars: keptJson.length,
        preview:
          keptJson.length > previewChars
            ? keptJson.slice(0, previewChars)
            : keptJson,
        retained,
      }),
    }
  }

  // Every branch below REPLACES the payload with the marker. That is a drop.
  if (!retained.ok) return value

  let kept: JSONValue
  if (typeof value === 'string') {
    kept = value.slice(0, previewChars)
  } else if (Array.isArray(value)) {
    kept = value.slice(0, maxLines)
  } else {
    kept = value
  }
  const keptJson = JSON.stringify(kept) ?? ''

  return {
    ...(Array.isArray(value) ? { keptItems: value.slice(0, maxLines) } : {}),
    omitted: buildOmissionMarker({
      limitReason,
      originalChars,
      keptChars: keptJson.length,
      preview:
        keptJson.length > previewChars
          ? keptJson.slice(0, previewChars)
          : keptJson,
      retained,
    }),
  }
}

/**
 * Generic pre-pass for the verbose tool set. Returns the message content with
 * every JSON part's value truncated to the deterministic limits. When the
 * truncation is a no-op the original content is returned by reference.
 */
export function simplifyVerboseToolResults(params: {
  messageContent: ToolResultOutput[]
  toolCallId?: string
}): ToolResultOutput[] {
  const { messageContent, toolCallId } = params
  const truncated: ToolResultOutput[] = messageContent.map((part) => {
    if (part.type !== 'json' || part.value === undefined) return part
    const value = truncateToolOutputValue(part.value, {}, toolCallId)
    if (value === part.value) return part
    return { type: 'json' as const, value }
  })
  const changed = truncated.some((part, i) => part !== messageContent[i])
  return changed ? truncated : messageContent
}

/**
 * Replace read-file contents with an omission marker. Every dropped byte is
 * replaced, so a retention handle is required; without one the content is
 * returned as it arrived.
 */
export function simplifyReadFileResults(params: {
  messageContent: SavantCodeToolOutput<'read_files'>
  toolCallId?: string
}): SavantCodeToolOutput<'read_files'> {
  const { messageContent, toolCallId } = params
  const target = cloneDeep(messageContent[0]).value
  const droppable = target.some(
    (file) => 'content' in file && typeof file.content === 'string',
  )
  if (!droppable) return messageContent

  const retained = retentionProof(toolCallId)
  if (!retained.ok) return messageContent

  const value = target.map((file) => {
    const content = 'content' in file ? file.content : undefined
    if (typeof content !== 'string') return file
    const omitted = buildOmissionMarker({
      limitReason: `${content.length} chars of file content omitted for length`,
      originalChars: content.length,
      keptChars: 0,
      preview: content.slice(0, TOOL_OUTPUT_LIMITS.previewChars),
      retained,
    })
    const entry: typeof file & { omitted: OmissionMarker } = {
      path: file.path,
      contentOmittedForLength: true,
      omitted,
    }
    return entry
  })
  return [{ type: 'json', value }]
}

/**
 * Replace terminal stdout/stderr with an omission marker. The kept fields are
 * `command`/`message`/`exitCode`, so the dropped bytes are replaced rather than
 * summarised — a retention handle is required, and without one the result is
 * returned as it arrived (including the failure path, which used to replace an
 * unprocessable result with `{ command: '', stdoutOmittedForLength: true }` and
 * lose the command outright).
 */
export function simplifyTerminalCommandResults(params: {
  messageContent: SavantCodeToolOutput<'run_terminal_command'>
  logger: Logger
  toolCallId?: string
}): SavantCodeToolOutput<'run_terminal_command'> {
  const { messageContent, logger, toolCallId } = params
  try {
    const clone = cloneDeep(messageContent)
    const content = clone[0]?.value
    if (
      typeof content !== 'object' ||
      content === null ||
      Array.isArray(content)
    ) {
      return messageContent
    }
    if ('processId' in content || 'errorMessage' in content) {
      return messageContent
    }
    const { command, message, exitCode } = content
    const dropped = [
      'stdout' in content ? content.stdout : undefined,
      'stderr' in content ? content.stderr : undefined,
    ]
      .filter((value): value is string => typeof value === 'string')
      .join('')
    if (dropped.length === 0) return messageContent

    const retained = retentionProof(toolCallId)
    if (!retained.ok) return messageContent

    const value: typeof content & { omitted: OmissionMarker } = {
      command,
      ...(message && { message }),
      stdoutOmittedForLength: true,
      ...(exitCode !== undefined && { exitCode }),
      omitted: buildOmissionMarker({
        limitReason: `${dropped.length} chars of stdout/stderr omitted for length`,
        originalChars: dropped.length,
        keptChars: 0,
        preview: dropped.slice(0, TOOL_OUTPUT_LIMITS.previewChars),
        retained,
      }),
    }
    return [{ type: 'json', value }]
  } catch (error) {
    logger.error(
      { error: getErrorObject(error), messageContent },
      'Error simplifying terminal command results',
    )
    // Never invent a result: a failure to simplify must not simplify.
    return messageContent
  }
}
