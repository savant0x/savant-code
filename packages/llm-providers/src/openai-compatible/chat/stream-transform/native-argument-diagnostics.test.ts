import { describe, expect, test } from 'bun:test'

import { flushStream } from './flush-handler'
import { createChatStreamTransformerState } from './state'

import type { LanguageModelV2StreamPart } from '@ai-sdk/provider'

function flush(
  args: string,
  finishReason: 'tool-calls' | 'length' = 'tool-calls',
) {
  const state = createChatStreamTransformerState()
  state.finishReason = finishReason
  state.toolCalls.push({
    id: 'rejected-spawn',
    type: 'function',
    hasFinished: false,
    function: { name: 'spawn_agents', arguments: args },
  })
  const parts: LanguageModelV2StreamPart[] = []
  flushStream({
    state,
    providerOptionsName: 'test',
    requiredToolKeys: new Map([['spawn_agents', ['agents']]]),
    controller: {
      desiredSize: 1,
      enqueue(part) {
        if (part !== undefined) parts.push(part)
      },
      error(error: unknown) {
        throw error
      },
      terminate() {},
    },
  })
  return parts
}

describe('native argument failure diagnosis at the production flush boundary', () => {
  test('names the required field instead of asking for unspecified corrections', () => {
    const parts = flush('{"payload":"private-model-value"}')
    expect(parts.find((part) => part.type === 'error')).toMatchObject({
      error: {
        type: 'native-incomplete',
        schemaIssue: 'agents — missing_required_property',
        finishReason: 'tool-calls',
      },
    })
    expect(parts.some((part) => part.type === 'tool-call')).toBe(false)
    expect(JSON.stringify(parts)).not.toContain('private-model-value')
  })

  test('distinguishes invalid JSON from a parsed value of the wrong shape', () => {
    expect(JSON.stringify(flush('{"agents":'))).toContain('invalid_json')
    expect(JSON.stringify(flush('[]'))).toContain('invalid_type')
    expect(JSON.stringify(flush('{"agents":', 'length'))).toContain(
      '"finishReason":"length"',
    )
  })

  test('valid complete arguments still execute unchanged', () => {
    const args = '{"agents":[{"agent_type":"researcher"}]}'
    const parts = flush(args)
    expect(parts.some((part) => part.type === 'error')).toBe(false)
    expect(parts.find((part) => part.type === 'tool-call')).toMatchObject({
      input: args,
    })
  })
})
