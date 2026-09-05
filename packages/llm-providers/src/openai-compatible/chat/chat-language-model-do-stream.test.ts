// openai-compatible chat-language-model test family — doStream accumulation
// (merge/replacement paths). Sibling of the Loop 354 decomposition (shared
// fixtures in ./chat-language-model-stream-harness).
import { describe, it, expect } from 'bun:test'

import {
  collectStreamParts,
  createStreamingModel,
  finishChunk,
  FULL_ARGS,
  toolCallsFrom,
  toolDeltaChunk,
  toolInputDeltasFrom,
} from './chat-language-model-stream-harness'

// ---------------------------------------------------------------------------
// Integration tests — real doStream path with a mocked SSE fetch
// ---------------------------------------------------------------------------

describe('doStream tool-call accumulation', () => {
  it('A. placeholder-first: {} placeholder then real object → one tool-call with full object', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '{}'),
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].toolName).toBe('sequentialthinking')
    expect(calls[0].input).toBe(FULL_ARGS)
    expect(toolInputDeltasFrom(parts)).toEqual([FULL_ARGS])
  })

  it('B. normal OpenAI fragments merge into one object', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '{"thought":'),
      toolDeltaChunk(0, '"a","thoughtNumber":'),
      toolDeltaChunk(0, '1,"totalThoughts":3,"nextThoughtNeeded":true}'),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
  })

  it('C. one-shot complete object in a single chunk → one tool-call', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
  })

  it('F. non-object parseable (array) does not complete early; real object accumulates', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '[]'),
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
    expect(toolInputDeltasFrom(parts)).toEqual([FULL_ARGS])
  })

  it('F2. null stale fragment is replaced by the real object', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, 'null'),
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
  })

  it('F3. string-literal placeholder is replaced by a real object fragment', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '"{}"'),
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
  })

  it('F4. whitespace empty-object placeholder is replaced by the real object', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '{ }'),
      toolDeltaChunk(0, FULL_ARGS),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].input).toBe(FULL_ARGS)
  })
})
