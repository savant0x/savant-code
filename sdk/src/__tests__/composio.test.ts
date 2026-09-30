import { COMPOSIO_META_TOOL_NAMES } from '@savant-code/common/constants/composio'
import { clientToolNames, toolParams } from '@savant-code/common/tools/list'
import { describe, expect, mock, test } from 'bun:test'

import { executeComposioToolViaServer } from '../composio'

// FID-2026-0929-005 (gut the backend): the composio relay (POST
// /api/v1/composio/execute with a Bearer apiKey) is deleted. The function
// survives only to return the honest unavailable output — no fetch, no
// apiKey parameter. The old direct-mode/relay/malformed-response suites die
// with the relay they pinned.
describe('Composio SDK tools', () => {
  const originalFetch = globalThis.fetch

  test('returns an honest unavailable output without fetching', async () => {
    const fetchMock = mock(async () => {
      throw new Error('fetch should never be called — the relay is deleted')
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const output = await executeComposioToolViaServer({
        toolName: 'composio_search_tools',
        input: {
          queries: ['find gmail tools'],
          session: { generate_id: true },
        },
      })

      expect(output).toEqual([
        {
          type: 'json',
          value: {
            errorMessage:
              'Composio is unavailable: it executed exclusively via the SavantCode backend, which does not exist.',
          },
        },
      ])
      expect(fetchMock).toHaveBeenCalledTimes(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('registers Composio meta tools as static client tools without discovery fetch', () => {
    const fetchMock = mock(async () => new Response('{}'))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      for (const toolName of COMPOSIO_META_TOOL_NAMES) {
        expect(clientToolNames).toContain(toolName)
        expect(toolParams[toolName].inputSchema).toBeDefined()
      }
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
