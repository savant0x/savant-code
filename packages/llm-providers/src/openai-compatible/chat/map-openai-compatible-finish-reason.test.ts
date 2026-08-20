/**
 * Tests for mapOpenAICompatibleFinishReason — the provider-agnostic finish
 * reason mapper for the OpenAI-compatible chat language model.
 */
import { describe, expect, it } from 'bun:test'

import { mapOpenAICompatibleFinishReason } from './map-openai-compatible-finish-reason'

describe('mapOpenAICompatibleFinishReason', () => {
  it('maps "stop" to "stop"', () => {
    expect(mapOpenAICompatibleFinishReason('stop')).toBe('stop')
  })

  it('maps "length" to "length"', () => {
    expect(mapOpenAICompatibleFinishReason('length')).toBe('length')
  })

  it('maps "content_filter" to "content-filter"', () => {
    expect(mapOpenAICompatibleFinishReason('content_filter')).toBe(
      'content-filter',
    )
  })

  it('maps "function_call" to "tool-calls"', () => {
    expect(mapOpenAICompatibleFinishReason('function_call')).toBe('tool-calls')
  })

  it('maps "tool_calls" to "tool-calls"', () => {
    expect(mapOpenAICompatibleFinishReason('tool_calls')).toBe('tool-calls')
  })

  it('maps null to "unknown"', () => {
    expect(mapOpenAICompatibleFinishReason(null)).toBe('unknown')
  })

  it('maps undefined to "unknown"', () => {
    expect(mapOpenAICompatibleFinishReason(undefined)).toBe('unknown')
  })

  it('maps unrecognized strings to "unknown"', () => {
    expect(mapOpenAICompatibleFinishReason('gibberish')).toBe('unknown')
    expect(mapOpenAICompatibleFinishReason('')).toBe('unknown')
  })
})
