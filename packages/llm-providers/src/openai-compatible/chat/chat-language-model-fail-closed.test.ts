// openai-compatible chat-language-model test family — doStream fail-closed
// guarantees + multi-tool interleave. Sibling of the Loop 354 decomposition
// (shared fixtures in ./chat-language-model-stream-harness).
import { describe, it, expect } from 'bun:test'

import {
  collectStreamParts,
  createStreamingModel,
  EMPTY_OBJECT_TOOL,
  finishChunk,
  FULL_ARGS,
  toolCallsFrom,
  toolDeltaChunk,
} from './chat-language-model-stream-harness'

import type { LanguageModelV2StreamPart } from '@ai-sdk/provider'

describe('doStream tool-call accumulation', () => {
  it('D. string-literal args fail closed at flush', async () => {
    const stringLiteral = JSON.stringify(FULL_ARGS)
    const model = createStreamingModel([
      toolDeltaChunk(0, stringLiteral),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    const errors = parts.filter((part) => part.type === 'error')
    const inputEnds = parts.filter(
      (part) => part.type === 'tool-input-end' && part.id === 'call_0',
    )

    expect(calls).toHaveLength(0)
    expect(inputEnds).toHaveLength(1)
    expect(errors).toHaveLength(1)
  })

  it('E. truncated at flush fails closed without exposing raw arguments', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '{"thought":"unterminated'),
      finishChunk('stop'),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    const errors = parts.filter((part) => part.type === 'error')
    const inputEnds = parts.filter(
      (part) => part.type === 'tool-input-end' && part.id === 'call_0',
    )

    expect(calls).toHaveLength(0)
    expect(inputEnds).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(JSON.stringify(errors[0])).not.toContain('unterminated')
  })

  it('E2. terminal empty arguments fail closed without an executable call', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, ''),
      finishChunk('stop'),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)
    const errors = parts.filter((part) => part.type === 'error')
    const inputEnds = parts.filter(
      (part) => part.type === 'tool-input-end' && part.id === 'call_0',
    )

    expect(calls).toHaveLength(0)
    expect(inputEnds).toHaveLength(1)
    expect(errors).toHaveLength(1)
  })

  it('E3. terminal whitespace arguments fail closed without an executable call', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '   '),
      finishChunk('stop'),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)
    const errors = parts.filter((part) => part.type === 'error')
    const inputEnds = parts.filter(
      (part) => part.type === 'tool-input-end' && part.id === 'call_0',
    )

    expect(calls).toHaveLength(0)
    expect(inputEnds).toHaveLength(1)
    expect(errors).toHaveLength(1)
  })

  it('H. terminal empty object fails closed for required fields', async () => {
    const model = createStreamingModel([toolDeltaChunk(0, '{}'), finishChunk()])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)
    const errors = parts.filter(
      (part): part is Extract<LanguageModelV2StreamPart, { type: 'error' }> =>
        part.type === 'error',
    )
    const inputEnds = parts.filter(
      (part) => part.type === 'tool-input-end' && part.id === 'call_0',
    )

    expect(calls).toHaveLength(0)
    expect(inputEnds).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0]?.error).toEqual({
      type: 'native-incomplete',
      toolName: 'sequentialthinking',
    })
    expect(JSON.stringify(errors[0])).not.toContain('{}')
  })

  it('I. terminal empty object is valid for a zero-required-field tool', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, '{}', 'empty_tool'),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model, [EMPTY_OBJECT_TOOL])
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(1)
    expect(calls[0].toolName).toBe('empty_tool')
    expect(calls[0].input).toBe('{}')
  })

  it('J. undeclared tool calls fail closed without an executable call', async () => {
    const model = createStreamingModel([
      toolDeltaChunk(0, FULL_ARGS, 'undeclared_tool'),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)
    const errors = parts.filter((part) => part.type === 'error')

    expect(calls).toHaveLength(0)
    expect(errors).toHaveLength(1)
  })

  it('G. multi-tool-call interleave completes both independently', async () => {
    const argsB =
      '{"thought":"b","thoughtNumber":2,"totalThoughts":4,"nextThoughtNeeded":true}'
    const model = createStreamingModel([
      toolDeltaChunk(0, '{"thought":'),
      toolDeltaChunk(1, '{"thought":'),
      toolDeltaChunk(
        0,
        '"a","thoughtNumber":1,"totalThoughts":3,"nextThoughtNeeded":true}',
      ),
      toolDeltaChunk(
        1,
        '"b","thoughtNumber":2,"totalThoughts":4,"nextThoughtNeeded":true}',
      ),
      finishChunk(),
    ])
    const parts = await collectStreamParts(model)
    const calls = toolCallsFrom(parts)

    expect(calls).toHaveLength(2)
    expect(calls[0].toolCallId).toBe('call_0')
    expect(calls[0].input).toBe(FULL_ARGS)
    expect(calls[1].toolCallId).toBe('call_1')
    expect(calls[1].input).toBe(argsB)
  })
})
