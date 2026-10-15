// Messages test family — fail-fast conversion validation and the
// with/withoutCacheControl provider-option helpers. Decomposed from the
// FID-2026-0819-005 Loop 320 monolith; siblings cover conversion basics,
// aggregation, cache-control placement, and edge cases.

import { describe, expect, it } from 'bun:test'

import {
  withCacheControl,
  withoutCacheControl,
  convertCbToModelMessages,
  mediaToolResult,
} from '../messages'

import type { JSONValue } from '../../types/json'
import type { Message } from '../../types/messages/savant-code-message'

describe('convertCbToModelMessages — fail-fast validation (FID-2026-0820-013)', () => {
  // Passes Savant conversion (user array content is cloned through) but
  // fails the AI SDK's modelMessageSchema: file parts require mediaType.
  const invalidFilePartUserMessage = {
    role: 'user',
    content: [{ type: 'file', data: 'abc' }],
  } as unknown as Message

  it('throws the actionable schema error on the NON-cache-control path', () => {
    // Regression: this path previously returned before validation, so the
    // invalid shape reached the AI SDK as an opaque AI_InvalidPromptError.
    expect(() =>
      convertCbToModelMessages({
        messages: [invalidFilePartUserMessage],
        includeCacheControl: false,
      }),
    ).toThrow(/failed schema validation/)
    expect(() =>
      convertCbToModelMessages({
        messages: [invalidFilePartUserMessage],
        includeCacheControl: false,
      }),
    ).toThrow(/Role: user/)
  })

  it('throws the same actionable schema error on the cache-control path', () => {
    expect(() =>
      convertCbToModelMessages({
        messages: [invalidFilePartUserMessage],
        includeCacheControl: true,
      }),
    ).toThrow(/failed schema validation/)
  })

  it('still converts valid media tool results to file parts with mediaType', () => {
    const result = convertCbToModelMessages({
      messages: [
        {
          role: 'tool',
          toolCallId: 'call-1',
          content: mediaToolResult({ data: 'aGk=', mediaType: 'image/png' }),
        } as unknown as Message,
      ],
      includeCacheControl: false,
    })
    const convertedUser = result.find((m) => m.role === 'user')
    expect(convertedUser).toBeDefined()
    const firstPart = (
      convertedUser as { content: { type: string; mediaType?: string }[] }
    ).content[0]
    expect(firstPart.type).toBe('file')
    expect(firstPart.mediaType).toBe('image/png')
  })
})

// Test helper types for provider options with cache control
type CacheControlValue = { type: string }
type ProviderWithCacheControl = Record<string, JSONValue> & {
  cache_control?: CacheControlValue
}

describe('withCacheControl', () => {
  it('should add cache control to object without providerOptions', () => {
    const obj = {} as Parameters<typeof withCacheControl>[0]
    const result = withCacheControl(obj)

    expect(result.providerOptions).toBeDefined()
    const resultOptions = result.providerOptions as Record<
      string,
      ProviderWithCacheControl
    >
    expect(resultOptions.anthropic?.cache_control).toEqual({
      type: 'ephemeral',
    })
    expect(resultOptions.openrouter?.cache_control).toEqual({
      type: 'ephemeral',
    })
    expect(resultOptions.openaiCompatible?.cache_control).toEqual({
      type: 'ephemeral',
    })
  })

  it('should add cache control to existing providerOptions', () => {
    const obj = {
      providerOptions: {
        anthropic: { someOtherOption: 'value' },
      },
    } as Parameters<typeof withCacheControl>[0]
    const result = withCacheControl(obj)

    const resultAnthropicOptions = result.providerOptions
      ?.anthropic as ProviderWithCacheControl
    expect(resultAnthropicOptions.cache_control).toEqual({
      type: 'ephemeral',
    })
    expect(resultAnthropicOptions.someOtherOption).toBe('value')
  })

  it('should not mutate original object', () => {
    const original = {} as Parameters<typeof withCacheControl>[0]
    const result = withCacheControl(original)

    expect(original.providerOptions).toBeUndefined()
    expect(result.providerOptions).toBeDefined()
  })

  it('should handle all three providers', () => {
    const obj = {} as Parameters<typeof withCacheControl>[0]
    const result = withCacheControl(obj)

    const resultOptions = result.providerOptions as Record<
      string,
      ProviderWithCacheControl
    >
    expect(resultOptions.anthropic?.cache_control?.type).toBe('ephemeral')
    expect(resultOptions.openrouter?.cache_control?.type).toBe('ephemeral')
    expect(resultOptions.openaiCompatible?.cache_control?.type).toBe(
      'ephemeral',
    )
  })
})

describe('withoutCacheControl', () => {
  it('should remove cache control from all providers', () => {
    const obj = {
      id: 'test',
      providerOptions: {
        anthropic: { cache_control: { type: 'ephemeral' } },
        openrouter: { cache_control: { type: 'ephemeral' } },
        openaiCompatible: { cache_control: { type: 'ephemeral' } },
      },
    }
    const result = withoutCacheControl(obj)

    expect(result.providerOptions).toBeUndefined()
  })

  it('should preserve other provider options', () => {
    const obj = {
      id: 'test',
      providerOptions: {
        anthropic: {
          cache_control: { type: 'ephemeral' },
          otherOption: 'value',
        },
      },
    }
    const result = withoutCacheControl(obj)

    expect(result.providerOptions?.anthropic?.cache_control).toBeUndefined()
    expect(result.providerOptions?.anthropic?.otherOption).toBe('value')
  })

  it('should not mutate original object', () => {
    const original = {
      id: 'test',
      providerOptions: {
        anthropic: { cache_control: { type: 'ephemeral' } },
      },
    }
    const result = withoutCacheControl(original)

    expect(original.providerOptions?.anthropic?.cache_control).toBeDefined()
    expect(result.providerOptions?.anthropic?.cache_control).toBeUndefined()
  })

  it('should handle object with no cache control', () => {
    const obj = {} as Parameters<typeof withoutCacheControl>[0]
    const result = withoutCacheControl(obj)

    expect(result.providerOptions).toBeUndefined()
  })

  it('should clean up empty provider objects', () => {
    const obj = {
      id: 'test',
      providerOptions: {
        anthropic: { cache_control: { type: 'ephemeral' } },
      },
    }
    const result = withoutCacheControl(obj)

    expect(result.providerOptions).toBeUndefined()
  })
})
