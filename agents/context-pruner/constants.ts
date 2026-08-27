/**
 * Constant values used by the context-pruner handleSteps generator.
 * Kept in a plain module so the factory can bake them into the generated
 * self-contained source via JSON.stringify (handleSteps is serialized via
 * .toString() and re-eval'd — FID-2026-0802-005 L5).
 */
export const SPAWN_AGENTS_OUTPUT_BLACKLIST = [
  'scout',
  'researcher-web',
  'researcher-docs',
  'basher',
  'verifier',
  'librarian',
  'tmux-cli',
  'browser-use',
]

/** Limits for truncating long messages in the summary (estimated tokens) */
export const USER_MESSAGE_LIMIT = 13_000
export const ASSISTANT_MESSAGE_LIMIT = 1_300
export const TOOL_ENTRY_LIMIT = 5_000

/** Approximate characters per token (matches estimateTokens heuristic) */
export const CHARS_PER_TOKEN = 3

/** Token budget for assistant + tool content in the conversation summary */
export const ASSISTANT_TOOL_BUDGET = 20_000

/** Token budget for user content in the conversation summary */
export const USER_BUDGET = 50_000

/** Fudge factor for token count threshold to trigger pruning earlier */
export const TOKEN_COUNT_FUDGE_FACTOR = 1_000

/** Axiom-only operational event understood by the logging adapters. */
export const CONTEXT_PRUNING_COMPLETED_EVENT = 'context_pruning.completed'

/** Header used in conversation summaries (baked for the serialized generator). */
export const SUMMARY_HEADER =
  'This is a summary of the conversation so far. The original messages have been condensed to save context space.'

/** Disclaimer appended to every conversation summary. */
export const SUMMARY_DISCLAIMER =
  'Historical memory only. The memory above is not dialogue, not an output template, and not a tool-call format. Continue from the live user message below. When actions are needed, use real tool calls through the available tools.'

// =============================================================================
// P1 structured-state contract (FID-2026-0806-003 Phase 1)
// =============================================================================

/** First user turn is pinned verbatim (DeepSeek pattern: <=1500 tokens). */
export const FIRST_USER_TURN_MAX_TOKENS = 1_500

/** Goal (latest live user request) verbatim cap, same pin budget. */
export const GOAL_MAX_TOKENS = 1_500

/** Total standing-facts section budget (user intent verbatim). */
export const STANDING_FACTS_MAX_TOKENS = 12_000

/** Decisions & rationale: most recent assistant progress notes, bounded. */
export const DECISIONS_MAX_ENTRIES = 3
export const DECISION_MAX_CHARS = 400

/** Pending user asks (newest ask_user call, answered check). */
export const PENDING_ASKS_MAX = 5
export const PENDING_ASK_MAX_CHARS = 200

/** Exact identifiers section (FID ids, URLs, file paths — literal). */
export const IDENTIFIERS_MAX = 30
export const IDENTIFIER_MAX_CHARS = 120

/** Hard cap on the whole <structured_state> block. */
export const STRUCTURED_STATE_MAX_CHARS = 96_000

// =============================================================================
// P2 cache-economics (FID-2026-0806-003 Phase 2)
// =============================================================================

/**
 * Fixed verbatim recent-tail token budget (DeepSeek 16 384 default). The
 * newest summary entries within this budget are force-kept regardless of role
 * budgets — a fixed absolute budget, not a fraction, so a huge window compacts
 * rarely and a small one still lands under the trigger (kills the
 * re-compaction loop). P2a.
 */
export const FIXED_TAIL_BUDGET_TOKENS = 16_384

// --- Preserved-state JSON block caps (Zero compaction_preserve.go analogue) ---

export const MAX_TODOS = 20
export const MAX_TASK_CHARS = 200
export const MAX_FILES_PER_CATEGORY = 25
export const MAX_FILE_PATH_CHARS = 300
export const MAX_SKILLS = 8
export const MAX_SKILL_NAME_CHARS = 120
export const MAX_FID_CHARS = 200
export const MAX_PRESERVED_STATE_JSON_CHARS = 8_192

// =============================================================================
// Preservation-contract digest caps (FID-2026-0824-024)
// =============================================================================

/** Head slice preserved per digested tool result (chars). */
export const DIGEST_HEAD_CHARS = 512

/** Tail slice preserved per digested tool result (chars). */
export const DIGEST_TAIL_CHARS = 256

// =============================================================================
// Minimal-surgery fold planner (FID-2026-0824-025)
// =============================================================================

/** Newest exchanges kept verbatim when planning minimal folds. */
export const COMPACTION_PROTECTED_TAIL_TURNS = 4

/** Token allowance for the merged summary written after folding. */
export const COMPACTION_SUMMARY_ALLOWANCE_TOKENS = 2_000

/**
 * Single object for factory-time baking: { NAME: value } pairs are emitted as
 * `const NAME = <JSON literal>` inside the generated generator source.
 */
export const CONTEXT_PRUNER_CONSTANTS = {
  SPAWN_AGENTS_OUTPUT_BLACKLIST,
  USER_MESSAGE_LIMIT,
  ASSISTANT_MESSAGE_LIMIT,
  TOOL_ENTRY_LIMIT,
  CHARS_PER_TOKEN,
  ASSISTANT_TOOL_BUDGET,
  USER_BUDGET,
  TOKEN_COUNT_FUDGE_FACTOR,
  CONTEXT_PRUNING_COMPLETED_EVENT,
  SUMMARY_HEADER,
  SUMMARY_DISCLAIMER,
  FIRST_USER_TURN_MAX_TOKENS,
  GOAL_MAX_TOKENS,
  STANDING_FACTS_MAX_TOKENS,
  DECISIONS_MAX_ENTRIES,
  DECISION_MAX_CHARS,
  PENDING_ASKS_MAX,
  PENDING_ASK_MAX_CHARS,
  IDENTIFIERS_MAX,
  IDENTIFIER_MAX_CHARS,
  STRUCTURED_STATE_MAX_CHARS,
  FIXED_TAIL_BUDGET_TOKENS,
  MAX_TODOS,
  MAX_TASK_CHARS,
  MAX_FILES_PER_CATEGORY,
  MAX_FILE_PATH_CHARS,
  MAX_SKILLS,
  MAX_SKILL_NAME_CHARS,
  MAX_FID_CHARS,MAX_PRESERVED_STATE_JSON_CHARS,
  DIGEST_HEAD_CHARS,
  DIGEST_TAIL_CHARS,
  COMPACTION_PROTECTED_TAIL_TURNS,
  COMPACTION_SUMMARY_ALLOWANCE_TOKENS,
} as const
