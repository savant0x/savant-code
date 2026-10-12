import { asSchema } from 'ai'
import { describe, expect, test } from 'bun:test'
import z from 'zod/v4'

import { getMCPToolData } from '../mcp'
import { getToolSet } from '../tools/prompts'
import { parseRawCustomToolCall } from '../tools/tool-call-parse'

import type { JSONValue } from '@savant-code/common/types/json'
import type { jsonSchema } from 'ai'

const schema = {
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 20,
    },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    paper: { type: 'string' },
    year: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
  },
  required: ['ids'],
} satisfies Parameters<typeof jsonSchema>[0]

const invalidInputs: Array<Record<string, JSONValue>> = [
  { ids: '[W4408145721]' },
  { ids: 'W4408145721' },
  { ids: '[]' },
  { ids: '["W4408145721"]', limit: '101' },
  { ids: '["W4408145721"]', limit: '1.5' },
  { ids: JSON.stringify(Array(21).fill('W4408145721')) },
  { limit: '10' },
]

async function definitions() {
  return getMCPToolData({
    toolNames: [],
    mcpServers: {
      papers: {
        type: 'http',
        url: 'https://papers.test',
        params: {},
        headers: {},
      },
    },
    requestMcpToolData: async () => [{ name: 'lookup', inputSchema: schema }],
  })
}

async function parse(input: Record<string, JSONValue>) {
  return parseRawCustomToolCall({
    customToolDefs: await definitions(),
    rawToolCall: { toolName: 'papers__lookup', toolCallId: 'test', input },
  })
}

describe('MCP schema and encoded argument recovery', () => {
  test('model schema preserves nullable unions, required arrays and numeric bounds', async () => {
    const defs = await definitions()
    const tools = await getToolSet({
      toolNames: [],
      additionalToolDefinitions: async () => defs,
      agentTools: {},
      skills: {},
    })
    expect(asSchema(tools.papers__lookup.inputSchema).jsonSchema).toEqual(
      schema,
    )
    expect(
      (await parse({ ids: ['W4408145721'], limit: 10, year: null })).input,
    ).toMatchObject({
      ids: ['W4408145721'],
      limit: 10,
      year: null,
    })
  })

  test('decodes one JSON layer at a type failure and returns typed dispatch values', async () => {
    const result = await parse({
      ids: '["W4408145721"]',
      limit: '10',
      paper: '10',
    })
    expect(result).not.toHaveProperty('error')
    expect(result.input).toMatchObject({
      ids: ['W4408145721'],
      limit: 10,
      paper: '10',
    })
  })

  test.each(invalidInputs)(
    'rejects malformed, missing and out-of-bounds arguments %j',
    async (input) => {
      expect(await parse(input)).toHaveProperty('error')
    },
  )

  test('dispatches schema transformations instead of the pre-validation input', () => {
    const result = parseRawCustomToolCall({
      customToolDefs: {
        trim: { inputSchema: z.object({ paper: z.string().trim() }) },
      },
      rawToolCall: {
        toolName: 'trim',
        toolCallId: 'trim',
        input: { paper: ' W123 ' },
      },
    })
    expect(result.input).toEqual({ paper: 'W123' })
  })

  test.each([null, 10, true, [], '[]'].map((value) => ({ value })))(
    'rejects non-object arguments even for a zero-argument tool: %j',
    ({ value: input }) => {
      const result = parseRawCustomToolCall({
        customToolDefs: { empty: { inputSchema: z.object({}) } },
        rawToolCall: { toolName: 'empty', toolCallId: 'empty', input },
      })
      expect(result).toHaveProperty('error')
    },
  )
})
