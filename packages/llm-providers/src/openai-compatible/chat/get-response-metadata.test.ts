/**
 * Tests for getResponseMetadata — normalizes provider response metadata
 * (id, model, created) into the AI SDK metadata shape.
 */
import { describe, expect, it } from 'bun:test'

import { getResponseMetadata } from './get-response-metadata'

describe('getResponseMetadata', () => {
  it('maps id, model, and created timestamp', () => {
    const result = getResponseMetadata({
      id: 'chatcmpl-abc123',
      model: 'gpt-4',
      created: 1700000000,
    })
    expect(result.id).toBe('chatcmpl-abc123')
    expect(result.modelId).toBe('gpt-4')
    expect(result.timestamp).toEqual(new Date(1700000000 * 1000))
  })

  it('converts Unix timestamp (seconds) to Date', () => {
    const result = getResponseMetadata({ created: 0 })
    expect(result.timestamp).toEqual(new Date(0))
  })

  it('handles null id and model gracefully', () => {
    const result = getResponseMetadata({ id: null, model: null })
    expect(result.id).toBeUndefined()
    expect(result.modelId).toBeUndefined()
  })

  it('handles undefined fields', () => {
    const result = getResponseMetadata({})
    expect(result.id).toBeUndefined()
    expect(result.modelId).toBeUndefined()
    expect(result.timestamp).toBeUndefined()
  })

  it('handles null created (no timestamp)', () => {
    const result = getResponseMetadata({ created: null })
    expect(result.timestamp).toBeUndefined()
  })
})
