/**
 * FID-2026-1006-005 steps 4 and 7 — the cache-control breakpoint has ONE
 * spelling, ONE provider set, and ONE lifetime policy.
 *
 * `withCacheControl` writes snake_case `cache_control` over
 * anthropic|openrouter|openaiCompatible; both clearers act on exactly that
 * marker; and the TTL the run's mode resolves to is what the marker carries.
 *
 * RED before step 4: the trim path deleted camelCase `cacheControl` over
 * anthropic|openrouter|savant-code — a spelling nothing in this repository
 * writes and a set that omits the provider the writer tags — so a written marker
 * survived the trim and the deletion was dead against the real marker.
 */
import {
  assistantMessage,
  convertCbToModelMessages,
  resolveCacheBreakpointTtl,
  withCacheControl,
  withoutCacheControl,
} from '@savant-code/common/util/messages'
import { describe, expect, test } from 'bun:test'

import { getMessagesSubset } from '../../util/messages'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { SavantModelMessage } from '@savant-code/common/util/messages'

const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const markerOf = (message: Message) =>
  message.providerOptions?.anthropic?.cache_control

/**
 * The conversion places its breakpoints on the message OR on its last content
 * part (a string-content system message can only take the message-level one), so
 * the assertion has to look where `convertCbToModelMessages` actually writes.
 */
const convertedMarkerOf = (message: SavantModelMessage) => {
  const onMessage = message.providerOptions?.anthropic?.cache_control
  if (onMessage) return onMessage
  if (typeof message.content === 'string') return undefined
  return message.content
    .map((part) => part.providerOptions?.anthropic?.cache_control)
    .find((marker) => marker !== undefined)
}

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

  test('a TTL-carrying marker is cleared too — one spelling, one clearer', () => {
    const written = withCacheControl(assistantMessage('hello'), '1h')
    expect(markerOf(written)).toEqual({ type: 'ephemeral', ttl: '1h' })

    expect(markerOf(withoutCacheControl(written))).toBeUndefined()
  })
})

describe('cache-breakpoint TTL policy (FID-2026-1006-005 step 7)', () => {
  test('STRICT (FID-bound) resolves to the 1h cache; HYBRID keeps the default', () => {
    expect(resolveCacheBreakpointTtl('strict')).toBe('1h')
    expect(resolveCacheBreakpointTtl('hybrid')).toBeUndefined()
    expect(resolveCacheBreakpointTtl(undefined)).toBeUndefined()
  })

  test('the conversion applies the resolved TTL to its breakpoints', () => {
    const messages = [assistantMessage('hello')]

    const withLongTtl = convertCbToModelMessages({
      messages,
      cacheBreakpointTtl: '1h',
      logger,
    })
    expect(convertedMarkerOf(withLongTtl[0])).toEqual({
      type: 'ephemeral',
      ttl: '1h',
    })

    // No TTL ⇒ the marker keeps today's exact bytes (the provider's own 5m
    // default), so an HYBRID run's request body is unchanged by this step.
    const withoutTtl = convertCbToModelMessages({ messages, logger })
    expect(convertedMarkerOf(withoutTtl[0])).toEqual({ type: 'ephemeral' })
  })
})
