export const SAVANT_FREE_GEMINI_THINKER_AGENT_ID = 'thinker-with-files-gemini'

/** Agent id the savant-free WEB CHAT uses for its gemini-thinker child (see
 *  agents/thinker/thinker-gemini.ts, spawned from agents/base-chat.ts). Distinct
 *  from the CLI's SAVANT_FREE_GEMINI_THINKER_AGENT_ID. */
export const SAVANT_FREE_CHAT_GEMINI_THINKER_AGENT_ID = 'thinker-gemini'

/** The ONLY agents permitted to call the premium Gemini Pro model. Gemini Pro is
 *  not a user-pickable model — its only legitimate callers are these two thinker
 *  subagents (CLI + chat). The chat-completions endpoint rejects any other agent
 *  that requests Gemini Pro on an unbilled path. */
export const SAVANT_FREE_GEMINI_PRO_AGENT_IDS: ReadonlySet<string> = new Set([
  SAVANT_FREE_GEMINI_THINKER_AGENT_ID,
  SAVANT_FREE_CHAT_GEMINI_THINKER_AGENT_ID,
])

export const SAVANT_FREE_GEMINI_THINKER_SYSTEM_INSTRUCTION =
  "Spawn the thinker-with-files-gemini agent to think through problems worth reasoning about -- it's very smart. Reach for it on non-trivial bugs, uncertain approaches, and tricky decisions, not just the hardest tasks. Skip it for routine, clearly-scoped edits. Pass the relevant filePaths since it has no conversation history."

export const SAVANT_FREE_GEMINI_THINKER_INSTRUCTIONS_PROMPT =
  '- For problems worth thinking through -- non-trivial bugs, uncertain approaches, or tricky decisions -- spawn the thinker-with-files-gemini agent after gathering context, not just for the hardest tasks. Skip it for routine, clearly-scoped edits. Pass the relevant filePaths.'

export const SAVANT_FREE_GEMINI_THINKER_STEP_PROMPT =
  'For non-trivial problems or decisions, spawn the thinker-with-files-gemini agent to think it through. Skip it for routine edits. Pass the relevant filePaths.'

export const SAVANT_FREE_GEMINI_THINKER_PROMPT_LINES = [
  SAVANT_FREE_GEMINI_THINKER_SYSTEM_INSTRUCTION,
  SAVANT_FREE_GEMINI_THINKER_INSTRUCTIONS_PROMPT,
  SAVANT_FREE_GEMINI_THINKER_STEP_PROMPT,
] as const
