import { clientToolCallSchema } from '@savant-code/common/tools/list'
import { describe, expect, test } from 'bun:test'

import { handleToolCall } from '../run/tool-call'

import type { ServerAction } from '@savant-code/common/actions'

// FID-2026-0930-003: the connector meta-tool names are part of the tool
// vocabulary (parseable via clientToolCallSchema), but the SDK has no local
// executor — every connector_* call takes the honest-error branch beside the
// composio precedent instead of failing opaque.

function connectorAction(toolName: string, input: Record<string, unknown>) {
  return {
    type: 'tool-call-request',
    userInputId: 'test-user-input',
    requestId: 'test-request',
    toolName,
    input,
  } as unknown as ServerAction<'tool-call-request'>
}

describe('connector tools in SDK mode', () => {
  test('connector_invoke parses as a client tool call and answers honestly', async () => {
    const input = {
      provider: 'firecrawl',
      endpoint: 'firecrawl#scrape',
      input: { body: { url: 'https://example.com' } },
    }
    // the name is part of the published vocabulary…
    expect(
      clientToolCallSchema.safeParse({ toolName: 'connector_invoke', input })
        .success,
    ).toBe(true)
    // …but the SDK executor does not exist: honest error, no network.
    const fetchBefore = globalThis.fetch
    let networkTouched = false
    globalThis.fetch = (async () => {
      networkTouched = true
      throw new Error('network must not be touched')
    }) as unknown as typeof fetch
    try {
      const { output } = await handleToolCall({
        action: connectorAction('connector_invoke', input),
        overrides: {},
        customToolDefinitions: {},
        cwd: '.',
        fs: {} as Parameters<typeof handleToolCall>[0]['fs'],
      })
      expect(output[0]?.type).toBe('json')
      const value = (output[0] as { value: { errorMessage?: string } }).value
      expect(value.errorMessage).toContain(
        'Connector tools are not available in SDK mode',
      )
      expect(networkTouched).toBe(false)
    } finally {
      globalThis.fetch = fetchBefore
    }
  })

  test('every connector name takes the same honest branch (no silent partial service)', async () => {
    const inputs: Record<string, Record<string, unknown>> = {
      connector_search: {},
      connector_describe: { provider: 'exa', endpoint: 'exa#search' },
      connector_invoke: {
        provider: 'exa',
        endpoint: 'exa#search',
        input: {},
      },
      connector_credentials: { provider: 'exa' },
    }
    for (const [toolName, input] of Object.entries(inputs)) {
      const { output } = await handleToolCall({
        action: connectorAction(toolName, input),
        overrides: {},
        customToolDefinitions: {},
        cwd: '.',
        fs: {} as Parameters<typeof handleToolCall>[0]['fs'],
      })
      const value = (output[0] as { value: { errorMessage?: string } }).value
      expect(value.errorMessage).toContain(
        'Connector tools are not available in SDK mode',
      )
    }
  })
})
