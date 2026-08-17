export const NATIVE_TOOL_CALL_RECOVERY_MAX_STRIKES = 3

export const NATIVE_TOOL_CALL_RECOVERY_EXHAUSTED_MESSAGE =
  'Native tool-call recovery failed repeatedly; ending the agent run without executing the incomplete tool call.'

/** FID-2026-0816-012: appended to the TOOL_CALL_ERROR retry prompt when the
 *  incomplete native call targets a large-payload tool. Steers the model to
 *  split the work instead of re-emitting the same oversized arguments object
 *  (which is what re-truncates on flash-class models). Never embeds truncated
 *  argument fragments (Law 12). */
export const NATIVE_TOOL_CALL_STEERING_MESSAGE =
  " If the tool call arguments are large, split the work into multiple smaller tool calls (for example, write a smaller initial file, then append the rest with str_replace); keep each tool call's arguments compact."

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

export const STEP_WARNING_MESSAGE = [
  "I've made quite a few responses in a row.",
  "Let me pause here to make sure we're still on the right track.",
  "Please let me know if you'd like me to continue or if you'd like to guide me in a different direction.",
].join(' ')
