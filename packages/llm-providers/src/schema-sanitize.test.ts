// Outbound schema sanitizer — per-wire-shape fixtures + passthrough contract.
// FID-2026-0905-004. The cyclic fixture mirrors the real `set_output`
// serialization (`__schema0` self-cycles via additionalProperties/items).

import { describe, expect, test } from 'bun:test'

import {
  createSanitizingFetch,
  inlineLocalSchemaRefs,
  sanitizeOutboundBody,
} from './schema-sanitize'

import type { JSONValue } from '@savant-code/common/types/json'

/** Genuinely recursive schema, as `ai` emits for free-form-JSON params. */
function cyclicSchema(): JSONValue {
  return {
    type: 'object',
    properties: {
      output: { $ref: '#/$defs/__schema0' },
    },
    $defs: {
      __schema0: {
        anyOf: [
          { type: 'string' },
          { type: 'number' },
          { type: 'boolean' },
          { type: 'null' },
          {
            type: 'object',
            additionalProperties: { $ref: '#/$defs/__schema0' },
          },
          { type: 'array', items: { $ref: '#/$defs/__schema0' } },
        ],
      },
    },
  }
}

function hasRef(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasRef)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.$ref === 'string') return true
    if ('$defs' in record || 'definitions' in record) return true
    return Object.values(record).some(hasRef)
  }
  return false
}

describe('inlineLocalSchemaRefs', () => {
  test('cuts genuine cycles and drops $defs (chat-path parity)', () => {
    const out = inlineLocalSchemaRefs(
      cyclicSchema() as Parameters<typeof inlineLocalSchemaRefs>[0],
    )
    expect(hasRef(out)).toBe(false)
  })

  test('leaves acyclic schemas structurally intact', () => {
    const schema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    }
    expect(
      inlineLocalSchemaRefs(
        schema as Parameters<typeof inlineLocalSchemaRefs>[0],
      ),
    ).toEqual(schema)
  })
})

describe('sanitizeOutboundBody', () => {
  test('cuts OpenAI function.parameters cycles', () => {
    const out = sanitizeOutboundBody({
      model: 'gpt-5.5',
      tools: [
        {
          type: 'function',
          function: { name: 'set_output', parameters: cyclicSchema() },
        },
      ],
    })
    expect(hasRef(out)).toBe(false)
  })

  test('cuts Anthropic input_schema cycles', () => {
    const out = sanitizeOutboundBody({
      model: 'claude-sonnet-4-6',
      tools: [
        {
          name: 'set_output',
          input_schema: cyclicSchema(),
        },
      ],
    })
    expect(hasRef(out)).toBe(false)
  })

  test('cuts Google functionDeclarations parameters cycles', () => {
    const out = sanitizeOutboundBody({
      contents: [],
      tools: [
        {
          functionDeclarations: [
            { name: 'set_output', parameters: cyclicSchema() },
          ],
        },
      ],
    })
    expect(hasRef(out)).toBe(false)
  })

  test('returns bodies without tools by reference (zero behavior change)', () => {
    const body = { model: 'x', input: 'hi' }
    expect(
      sanitizeOutboundBody(body as Parameters<typeof sanitizeOutboundBody>[0]),
    ).toBe(body)
  })

  test('passes tools without schemas through', () => {
    const body = { tools: [{ type: 'function', function: { name: 'x' } }] }
    const out = sanitizeOutboundBody(
      body as Parameters<typeof sanitizeOutboundBody>[0],
    )
    expect(hasRef(out)).toBe(false)
  })
})

describe('createSanitizingFetch', () => {
  test('sanitizes string JSON bodies and forwards the rest untouched', async () => {
    const seen: Array<{ input: unknown; body: unknown }> = []
    const inner = (async (input: unknown, init?: { body?: unknown }) => {
      seen.push({ input, body: init?.body })
      return new Response('{}')
    }) as Parameters<typeof createSanitizingFetch>[0]

    const fetch = createSanitizingFetch(inner)
    const cyclic = JSON.stringify({
      model: 'gpt-5.5',
      tools: [
        {
          type: 'function',
          function: { name: 'set_output', parameters: cyclicSchema() },
        },
      ],
    })
    await fetch(
      'https://example.test/v1/responses' as never,
      {
        body: cyclic,
      } as never,
    )
    expect(seen).toHaveLength(1)
    expect(hasRef(JSON.parse(seen[0].body as string))).toBe(false)

    // Non-JSON bodies pass through byte-identical.
    await fetch(
      'https://example.test/x' as never,
      {
        body: 'not-json{{{',
      } as never,
    )
    expect(seen[1].body).toBe('not-json{{{')

    // Missing body passes through.
    await fetch('https://example.test/y' as never, {} as never)
    expect(seen[2].body).toBeUndefined()
  })
})
