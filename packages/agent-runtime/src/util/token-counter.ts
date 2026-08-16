import { LRUCache } from '@savant-code/common/util/lru-cache'
import { encode } from 'gpt-tokenizer/esm/model/gpt-4o'

import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

const ANTHROPIC_TOKEN_FUDGE_FACTOR = 1.35

/** Flat per-image/file cost. Anthropic bills a large image at ~1600 tokens; we
 *  use that ceiling instead of counting the base64 as text (which JSON.stringify
 *  would do), where a single screenshot is hundreds of thousands of chars. */
const IMAGE_TOKEN_ESTIMATE = 1600

/** Per-message structural overhead (role marker, delimiters) Anthropic adds on
 *  top of the raw content. */
const PER_MESSAGE_TOKEN_OVERHEAD = 8

const TOKEN_COUNT_CACHE = new LRUCache<string, number>(1000)

export function countTokens(text: string): number {
  try {
    const cached = TOKEN_COUNT_CACHE.get(text)
    if (cached !== undefined) {
      return cached
    }
    const count = Math.floor(
      encode(text, { allowedSpecial: 'all' }).length *
        ANTHROPIC_TOKEN_FUDGE_FACTOR,
    )

    if (text.length > 100) {
      // Cache only if the text is long enough to be worth it.
      TOKEN_COUNT_CACHE.set(text, count)
    }
    return count
  } catch (e) {
    // eslint-disable-next-line no-console -- token counter fallback; no logger available in this utility
    console.error('Error counting tokens', e)
    return Math.ceil(text.length / 3)
  }
}

export function countTokensJson(value: JSONValue): number {
  // JSON.stringify(undefined) returns undefined; fall back to '' so countTokens
  // always gets a string.
  return countTokens(JSON.stringify(value) ?? '')
}

const JSON_TOKEN_COUNT_CACHE = new WeakMap<object, number>()

/**
 * Memoize a JSON token count by object identity. `countTokensJson` re-runs
 * `JSON.stringify` on every call; for an invariant object (e.g. the per-loop
 * tool-schema list) that stringify is pure waste after the first step. Keys
 * are WeakMap'd so entries are GC'd with the objects themselves — no explicit
 * eviction needed (same contract as countTokensMessagesCached). Only object
 * values are memoized; primitives fall through to countTokensJson directly.
 */
export function countTokensJsonCached(value: JSONValue): number {
  if (value !== null && typeof value === 'object') {
    const cached = JSON_TOKEN_COUNT_CACHE.get(value)
    if (cached !== undefined) return cached
    const count = countTokensJson(value)
    JSON_TOKEN_COUNT_CACHE.set(value, count)
    return count
  }
  return countTokensJson(value)
}

/**
 * Estimate tokens for a list of messages by counting the content the model
 * actually tokenizes (text, tool inputs, tool results, a flat cost per image)
 * plus a small per-message overhead — not the JSON envelope. Avoids the
 * scaffolding inflation of `countTokensJson(messages)` and, crucially, counting
 * image/file base64 character-for-character. `ANTHROPIC_TOKEN_FUDGE_FACTOR` still
 * applies, so the estimate stays deliberately a touch above the true count.
 */
export function countTokensMessages(messages: Message[]): number {
  let total = 0
  for (const message of messages) {
    total += PER_MESSAGE_TOKEN_OVERHEAD

    // content is typed as an array, but tolerate string / missing content the
    // same way the replaced JSON.stringify did (see getTextContent), so a stray
    // shape can't crash or mis-count the estimate.
    const content = (message as { content?: unknown }).content
    if (typeof content === 'string') {
      total += countTokens(content)
      continue
    }
    if (!Array.isArray(content)) {
      continue
    }

    for (const part of content as Array<Record<string, JSONValue>>) {
      switch (part.type) {
        case 'text':
        case 'reasoning':
          total += countTokens(part.text as string)
          break
        case 'tool-call':
          total +=
            countTokens(part.toolName as string) +
            countTokensJson(part.input as JSONValue)
          break
        case 'json': // tool result payload
          total += countTokensJson(part.value as JSONValue)
          break
        case 'image':
        case 'file':
        case 'media':
          total += IMAGE_TOKEN_ESTIMATE
          break
        default: // unknown shape: JSON fallback so we never under-count
          total += countTokensJson(part as JSONValue)
      }
    }
  }
  return total
}

/**
 * FID-2026-0802-005 H2: per-message token-count cache. Messages are mostly
 * append-only, so keying by object identity lets repeated calls skip
 * re-encoding every message on every agent step (O(n) per step → O(n) total
 * instead of O(n²)). Entries are garbage-collected with the messages
 * themselves (truncation/compaction drops references), so no explicit
 * eviction is needed. Counts are estimates by design (same fudge factor as
 * countTokensMessages), so rare in-place mutations may drift the total
 * slightly — acceptable per the H2 design decision.
 */
const MESSAGE_TOKEN_COUNT_CACHE = new WeakMap<object, number>()

export function countTokensMessagesCached(messages: Message[]): number {
  let total = 0
  for (const message of messages) {
    const cached = MESSAGE_TOKEN_COUNT_CACHE.get(message)
    if (cached !== undefined) {
      total += cached
      continue
    }
    const count = countTokensMessages([message])
    MESSAGE_TOKEN_COUNT_CACHE.set(message, count)
    total += count
  }
  return total
}

export function countTokensForFiles(
  files: Record<string, string | null>,
): Record<string, number> {
  const tokenCounts: Record<string, number> = {}
  for (const [filePath, content] of Object.entries(files)) {
    tokenCounts[filePath] = content ? countTokens(content) : 0
  }
  return tokenCounts
}
