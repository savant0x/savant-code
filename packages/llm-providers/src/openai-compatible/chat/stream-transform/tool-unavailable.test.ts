// FID-2026-1012-002: the provider transform must answer two questions
// separately. `isCompleteKnownToolCallArguments` asks "is this call
// executable?" and still fails closed for an undeclared name; the failure
// CLASS must distinguish an undeclared name (unsatisfiable by any retry) from a
// mid-JSON cut (recoverable by splitting the payload). The pre-change code
// reported both as `native-incomplete`, so a tool-restricted agent was told to
// shrink an argument object that was never the problem, and the runtime spent
// its three-strike budget before killing the run.
import { describe, expect, it } from 'bun:test'

import { flushStream } from './flush-handler'
import { createChatStreamTransformerState } from './state'
import { getRequiredToolKeys } from './tool-arguments'

import type { LanguageModelV2StreamPart } from '@ai-sdk/provider'

/** The tools declared on this request (the Thinker's allowlist). */
const DECLARED_TOOLS = ['sequentialthinking', 'end_turn']

function requiredKeysForDeclaredTools() {
  return getRequiredToolKeys(
    DECLARED_TOOLS.map((name) => ({
      type: 'function' as const,
      name,
      inputSchema: { type: 'object', properties: {}, required: [] },
    })) as never,
  )
}

function flushOneToolCall(params: {
  toolName: string
  arguments: string
  finishReason?: string
}): LanguageModelV2StreamPart[] {
  const state = createChatStreamTransformerState()
  state.toolCalls[0] = {
    id: 'call-1',
    type: 'function',
    function: { name: params.toolName, arguments: params.arguments },
    hasFinished: false,
  }
  if (params.finishReason !== undefined) {
    state.finishReason = params.finishReason as typeof state.finishReason
  }

  const parts: LanguageModelV2StreamPart[] = []
  const controller = {
    enqueue: (part: LanguageModelV2StreamPart) => {
      parts.push(part)
    },
  } as unknown as TransformStreamDefaultController<LanguageModelV2StreamPart>

  flushStream({
    controller,
    state,
    providerOptionsName: 'savant_code',
    requiredToolKeys: requiredKeysForDeclaredTools(),
  })

  return parts
}

function errorTypes(parts: LanguageModelV2StreamPart[]): string[] {
  return parts
    .filter(
      (part): part is { type: 'error'; error: { type?: string } } =>
        part.type === 'error',
    )
    .map((part) => part.error.type ?? '')
}

describe('openai-compatible flush: unavailable tool vs incomplete arguments (FID-2026-1012-002)', () => {
  it('classifies an undeclared tool name as tool-unavailable, even with complete arguments', () => {
    const parts = flushOneToolCall({
      toolName: 'read_files',
      // Perfectly well-formed arguments: the pre-change code still reported
      // this as "incomplete", which is the misdiagnosis this pin removes.
      arguments: '{"paths":["agents/thinker/thinker.ts"]}',
    })

    expect(errorTypes(parts)).toEqual(['tool-unavailable'])
    expect(parts.some((part) => part.type === 'tool-call')).toBe(false)
    const error = parts.find((part) => part.type === 'error')
    expect(error).toMatchObject({ error: { toolName: 'read_files' } })
    // No finish reason is carried for the name-only class: no payload advice
    // applies to it.
    expect(
      (error as { error: { finishReason?: string } }).error.finishReason,
    ).toBeUndefined()
  })

  it('still emits an executable tool-call for a declared tool with complete arguments', () => {
    const parts = flushOneToolCall({
      toolName: 'sequentialthinking',
      arguments: '{"thought":"converged"}',
    })

    const toolCall = parts.find((part) => part.type === 'tool-call')
    expect(toolCall).toMatchObject({
      toolName: 'sequentialthinking',
      input: '{"thought":"converged"}',
    })
    expect(errorTypes(parts)).toEqual([])
  })

  it('keeps the truncation class and its finish reason for a declared tool with cut arguments', () => {
    const parts = flushOneToolCall({
      toolName: 'sequentialthinking',
      arguments: '{"thought":"unterminated',
      finishReason: 'length',
    })

    expect(errorTypes(parts)).toEqual(['native-incomplete'])
    const error = parts.find((part) => part.type === 'error')
    // FID-2026-0909-008: the provider's finish reason must survive, because it
    // is what tells the runtime a split-payload recovery is the right advice.
    expect(
      (error as { error: { finishReason?: string } }).error.finishReason,
    ).toBe('length')
  })
})
