/**
 * FID-2026-1006-005 step 4 — the cache-control seam has ONE spelling and ONE
 * provider set. `withCacheControl` writes snake_case `cache_control` over
 * anthropic|openrouter|openaiCompatible, and both clearers act on exactly that
 * marker.
 *
 * RED before the fix: the trim path deleted camelCase `cacheControl` over
 * anthropic|openrouter|savant-code — a spelling nothing in this repository
 * writes and a set that omits the provider the writer tags — so a written marker
 * survived the trim and the deletion was dead against the real marker.
 */
import {
  assistantMessage,
  withCacheControl,
  withoutCacheControl,
} from '@savant-code/common/util/messages'
import { describe, expect, test } from 'bun:test'

import { getMessagesSubset } from '../../util/messages'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'

const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const markerOf = (message: Message) =>
  message.providerOptions?.anthropic?.cache_control

describe('cache-control seam (writer <-> trim path)', () => {
  test('the trim path removes the marker the writer writes', () => {
    const written = withCacheControl(assistantMessage('hello'))
    expect(markerOf(written)).toEqual({ type: 'ephemeral' })

    const subset = getMessagesSubset({
      messages: [written],
      otherTokens: 0,
      logger,
    })

    expect(subset).toHaveLength(1)
    expect(markerOf(subset[0])).toBeUndefined()
  })

  test('the clone-path clearer acts on the same marker', () => {
    const written = withCacheControl(assistantMessage('hello'))

    expect(markerOf(withoutCacheControl(written))).toBeUndefined()
  })
})
