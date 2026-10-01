import { describe, expect, test } from 'bun:test'

import { CONNECTOR_TOOL_NAMES } from '../../constants/connectors'
import { toolNames } from '../constants'
import {
  clientToolCallSchema,
  clientToolNames,
  toolParams,
} from '../list'
import { toolSafetyRegistry } from '../safety-registry'

/**
 * Connector meta-tool surface pins (FID-2026-0930-003): the four names are
 * registered across every tool-vocabulary seam — the union, the params map,
 * the client tool-call schema, and the safety registry. The registry's own
 * module-load completeness check (safety-registry.ts) is the structural
 * Law-4 half of this suite; the assertions here pin the expected metadata.
 */

describe('connector meta-tool registration', () => {
  test('all four names are in the toolNames union', () => {
    for (const name of CONNECTOR_TOOL_NAMES) {
      expect(toolNames.includes(name)).toBe(true)
    }
  })

  test('all four names have toolParams entries', () => {
    for (const name of CONNECTOR_TOOL_NAMES) {
      expect(toolParams[name]).toBeDefined()
    }
  })

  test('all four names are parseable client tool calls', () => {
    for (const name of CONNECTOR_TOOL_NAMES) {
      expect(clientToolNames.includes(name)).toBe(true)
    }
    const parsed = clientToolCallSchema.safeParse({
      toolName: 'connector_search',
      input: {},
    })
    expect(parsed.success).toBe(true)
  })

  test('safety metadata follows the composio precedent per tool', () => {
    // Catalog reads: network/allow — no egress, but the family is
    // network-classed per the composio search/schemas precedent.
    expect(toolSafetyRegistry.connector_search).toEqual({
      effect: 'network',
      permission: 'allow',
      reason: expect.any(String),
    })
    expect(toolSafetyRegistry.connector_describe).toEqual({
      effect: 'network',
      permission: 'allow',
      reason: expect.any(String),
    })
    // The only vendor-egress entry: prompt-gated.
    expect(toolSafetyRegistry.connector_invoke).toEqual({
      effect: 'network',
      permission: 'prompt',
      reason: expect.any(String),
    })
    // Env key NAMES only — read/allow.
    expect(toolSafetyRegistry.connector_credentials).toEqual({
      effect: 'read',
      permission: 'allow',
      reason: expect.any(String),
    })
  })

  test('connector_invoke input requires provider, endpoint and input', () => {
    const schema = toolParams.connector_invoke.inputSchema
    expect(schema.safeParse({}).success).toBe(false)
    expect(
      schema.safeParse({ provider: 'firecrawl', endpoint: 'firecrawl#scrape' })
        .success,
    ).toBe(false)
    const ok = schema.safeParse({
      provider: 'firecrawl',
      endpoint: 'firecrawl#scrape',
      input: { body: { url: 'https://example.com' } },
    })
    expect(ok.success).toBe(true)
    // mode defaults to live — the safe surface
    expect(ok.success && ok.data.mode).toBe('live')
  })

  test('connector_search accepts an empty filter (providers listing)', () => {
    const schema = toolParams.connector_search.inputSchema
    expect(schema.safeParse({}).success).toBe(true)
    expect(
      schema.safeParse({ provider: 'firecrawl', category: 'web-search' })
        .success,
    ).toBe(true)
  })

  test('connector_describe requires provider and endpoint', () => {
    const schema = toolParams.connector_describe.inputSchema
    expect(schema.safeParse({}).success).toBe(false)
    expect(
      schema.safeParse({ provider: 'firecrawl', endpoint: 'firecrawl#map' })
        .success,
    ).toBe(true)
  })

  test('connector_credentials takes exactly one provider id', () => {
    const schema = toolParams.connector_credentials.inputSchema
    expect(schema.safeParse({}).success).toBe(false)
    expect(schema.safeParse({ provider: 'exa' }).success).toBe(true)
  })
})
