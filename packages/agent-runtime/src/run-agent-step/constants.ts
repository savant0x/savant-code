export const NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES = 3

/** FID-2026-0819-004: run_terminal_command gets extra retries because flash-class
 *  models need more attempts to learn from steering. Other tools stay at 3. */
export const NATIVE_TOOL_CALL_TERMINAL_RECOVERY_MAX_STRIKES = 5

export const NATIVE_TOOL_CALL_RECOVERY_EXHAUSTED_MESSAGE =
  'Native tool-call recovery failed repeatedly; ending the agent run without executing the incomplete tool call.'

/** FID-2026-0819-004: tool-specific steering messages. Each tool gets guidance
 *  that matches its natural failure mode — not a generic "split into smaller
 *  calls" that doesn't help. Messages escalate on successive strikes via
 *  `getSteeringMessage(toolName, strikeNumber)` in stream-parser.ts. */
export const NATIVE_TOOL_CALL_STEERING_MESSAGES: Record<
  string,
  { hint: string; explicit: string; example: string }
> = {
  run_terminal_command: {
    hint: ' If the command is too long, run ONE command per tool call instead of chaining multiple commands.',
    explicit:
      ' Your run_terminal_command arguments were rejected because the command string is too large. Run ONE command per call — do not chain commands with &&, ;, or newlines.',
    example:
      ' Run each command in a separate tool call. Example: first call with "prettier --write file1.ts", then a second call with "prettier --write file2.ts".',
  },
  write_file: {
    hint: ' If the file content is large, write in chunks using str_replace instead of a full overwrite.',
    explicit:
      ' Your write_file arguments were rejected because the content is too large. Use str_replace to edit sections, or split into multiple write_file calls for separate files.',
    example:
      ' Write the first section with write_file, then use str_replace to append remaining sections.',
  },
  str_replace: {
    hint: ' If the replacement is large, split it into smaller str_replace calls.',
    explicit:
      ' Your str_replace arguments were rejected. Split the replacement into smaller chunks — edit one section at a time.',
    example:
      ' Apply the first change with str_replace, then apply the next change in a separate call.',
  },
  apply_patch: {
    hint: ' If the patch is large, split it into smaller apply_patch calls.',
    explicit:
      ' Your apply_patch arguments were rejected because the patch is too large. Split into smaller hunks — one logical change per call.',
    example:
      ' Apply the first hunk with apply_patch, then apply the next hunk in a separate call.',
  },
  read_files: {
    hint: ' If reading many files, read fewer files at a time.',
    explicit:
      ' Your read_files arguments were rejected because the file list is too large. Read 1-3 files per call instead.',
    example:
      ' Read the first file with read_files, then read the next file in a separate call.',
  },
}

/** FID-2026-0816-012: appended to the exhausted-failure error so the parent
 *  agent has an actionable re-spawn strategy instead of an opaque stack trace. */
export const NATIVE_TOOL_CALL_RE_SPAWN_GUIDANCE =
  ' Re-spawn with the work split into smaller steps (write in chunks, append with str_replace), or re-run with the payload divided across multiple tool calls.'

export function buildNativeToolCallExhaustedMessage(
  toolName: string | undefined,
): string {
  const tool = toolName ? ` (tool: ${toolName})` : ''
  return `${NATIVE_TOOL_CALL_RECOVERY_EXHAUSTED_MESSAGE}${tool}${NATIVE_TOOL_CALL_RE_SPAWN_GUIDANCE}`
}

/**
 * FID-2026-0819-004: return the appropriate steering message for a tool at
 * a given strike number. Strike 1 = hint, strike 2 = explicit, 3+ = example.
 * Falls back to the generic message for unknown tools.
 */
export function getSteeringMessage(
  toolName: string | undefined,
  strikeNumber: number,
): string {
  if (toolName === undefined) return ''
  const messages = NATIVE_TOOL_CALL_STEERING_MESSAGES[toolName]
  if (messages === undefined) {
    // Generic fallback for tools not in the map
    if (strikeNumber <= 1) {
      return ' If the tool call arguments are large, split the work into multiple smaller tool calls.'
    }
    if (strikeNumber === 2) {
      return " Your tool call arguments were rejected. Split the work into smaller calls — keep each call's arguments compact."
    }
    return ' Your tool call arguments keep being rejected. Run ONE small tool call with minimal arguments, then build up from there.'
  }
  if (strikeNumber <= 1) return messages.hint
  if (strikeNumber === 2) return messages.explicit
  return messages.example
}

export const STEP_WARNING_MESSAGE = [
  "I've made quite a few responses in a row.",
  "Let me pause here to make sure we're still on the right track.",
  "Please let me know if you'd like me to continue or if you'd like to guide me in a different direction.",
].join(' ')
