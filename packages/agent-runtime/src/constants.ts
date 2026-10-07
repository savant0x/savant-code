/**
 * Set to `true` to log the full LLM request (system prompt, tools, messages)
 * to `debug/cache-debug/` on each user prompt. Use with:
 *   bun scripts/compare-cache-debug.ts
 * to diff sequential requests and find what's breaking prompt caching.
 */
export const CACHE_DEBUG_FULL_LOGGING = false

/**
 * FID-2026-1006-005 step 5 (Phase 1a) rollback flag. When true, the
 * model-facing tool payload is emitted in canonical name order at its single
 * assembly seam (`tools/canonical-tool-set.ts`), so an assembly that inserts
 * the same tools in a different order emits identical prefix bytes and cannot
 * fracture the provider's prompt cache.
 *
 * Set to `false` to roll back to the historical insertion-ordered tool set.
 * This changes the bytes sent to the provider (and `toolsHash` once, when
 * flipped), so flip it only with an operator ruling.
 */
export const CANONICAL_TOOL_PAYLOAD = true

// When true, reasoning chunks emitted by the model are appended to the
// assistant message history so they replay on the next turn. Consecutive
// reasoning chunks are consolidated into a single message.
export const INCLUDE_REASONING_IN_MESSAGE_HISTORY = true
