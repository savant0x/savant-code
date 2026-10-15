/**
 * Tests for prepareTools — converts AI SDK tool definitions to OpenAI format,
 * inlines local JSON $ref pointers, and maps toolChoice options.
 */
import { describe, expect, it } from 'bun:test'

import { prepareTools } from './openai-compatible-prepare-tools'

import type {
  LanguageModelV2FunctionTool,
  LanguageModelV2ProviderDefinedTool,
} from '@ai-sdk/provider'
import type { JSONValue } from '@savant-code/common/types/json'

const sampleTool: LanguageModelV2FunctionTool = {
  type: 'function',
  name: 'get_weather',
  description: 'Get current weather',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string' },
    },
    required: ['city'],
  },
}

describe('prepareTools', () => {
  it('converts a standard function tool to OpenAI format', () => {
    const result = prepareTools({
      tools: [sampleTool],
    })
    expect(result.tools).toHaveLength(1)
    expect(result.tools![0]).toEqual({
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather',
        parameters: sampleTool.inputSchema as JSONValue,
      },
    })
    expect(result.toolWarnings).toHaveLength(0)
  })

  it('returns undefined tools when given an empty array', () => {
    const result = prepareTools({ tools: [] })
    expect(result.tools).toBeUndefined()
    expect(result.toolChoice).toBeUndefined()
  })

  it('returns undefined tools when tools is undefined', () => {
    const result = prepareTools({ tools: undefined })
    expect(result.tools).toBeUndefined()
  })

  it('warns on provider-defined tools and excludes them', () => {
    const providerTool: LanguageModelV2ProviderDefinedTool = {
      type: 'provider-defined',
      id: 'custom.provider',
      name: 'special',
      args: {},
    }
    const result = prepareTools({
      tools: [sampleTool, providerTool],
    })
    expect(result.tools).toHaveLength(1)
    expect(result.toolWarnings).toHaveLength(1)
    expect(result.toolWarnings[0].type).toBe('unsupported-tool')
  })

  it('maps toolChoice "auto" to "auto"', () => {
    const result = prepareTools({
      tools: [sampleTool],
      toolChoice: { type: 'auto' },
    })
    expect(result.toolChoice).toBe('auto')
  })

  it('maps toolChoice "required" to "required"', () => {
    const result = prepareTools({
      tools: [sampleTool],
      toolChoice: { type: 'required' },
    })
    expect(result.toolChoice).toBe('required')
  })

  it('maps toolChoice "tool" to a function-specific choice', () => {
    const result = prepareTools({
      tools: [sampleTool],
      toolChoice: { type: 'tool', toolName: 'get_weather' },
    })
    expect(result.toolChoice).toEqual({
      type: 'function',
      function: { name: 'get_weather' },
    })
  })

  it('inlines local JSON $ref pointers in tool schemas', () => {
    const toolWithRef: LanguageModelV2FunctionTool = {
      type: 'function',
      name: 'complex_tool',
      description: 'A tool with refs',
      inputSchema: {
        type: 'object',
        properties: {
          nested: { $ref: '#/$defs/InnerType' },
        },
        $defs: {
          InnerType: {
            type: 'object',
            properties: {
              value: { type: 'number' },
            },
          },
        },
      },
    }
    const result = prepareTools({ tools: [toolWithRef] })
    const params = result.tools![0].function.parameters as {
      properties: { nested: { $ref?: string; properties?: unknown } }
    }
    // The $ref should be resolved — no $ref key in the output
    expect(params.properties.nested.$ref).toBeUndefined()
    expect(params.properties.nested.properties).toBeDefined()
  })
})
