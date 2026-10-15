import { promises as fs } from 'node:fs'

import { expect, spyOn, test } from 'bun:test'

import { buildAgentRuntimeImpl } from '../run/agent-runtime-impl'
import { readUrl } from '../tools/read-url'

function buildRuntime() {
  return buildAgentRuntimeImpl({
    fs,
    overrideTools: {},
    customToolDefinitions: [],
    onError: () => {},
    onResponseChunk: async () => {},
    onSubagentResponseChunk: async () => {},
    handlePromptResponseAction: () => {},
  })
}

test('the SDK dispatcher isolates caches while preserving repeats in each run', async () => {
  let calls = 0
  const fixtureFetch = async () => {
    calls += 1
    return calls === 1
      ? new Response('missing', { status: 404, statusText: 'Not Found' })
      : new Response('available now', {
          headers: { 'content-type': 'text/plain' },
        })
  }
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(fixtureFetch, { preconnect: globalThis.fetch.preconnect }),
  )
  try {
    const firstRun = buildRuntime()
    const secondRun = buildRuntime()
    const request = {
      userInputId: 'cache-boundary-fixture',
      toolName: 'read_url',
      // Public literal avoids DNS; all network IO is intercepted by the spy.
      input: { url: 'https://93.184.216.34/run-cache-fixture' },
    }
    const first = await firstRun.requestToolCall(request)
    expect(JSON.stringify(first)).toContain(
      'Failed to fetch URL: 404 Not Found',
    )
    const repeated = await firstRun.requestToolCall(request)
    expect(JSON.stringify(repeated)).toContain('already attempted in this run')
    expect(calls).toBe(1)

    const fresh = await secondRun.requestToolCall(request)
    expect(JSON.stringify(fresh)).toContain('available now')
    expect(JSON.stringify(fresh)).not.toContain('errorMessage')
    expect(calls).toBe(2)

    const lateRepeat = await firstRun.requestToolCall(request)
    expect(JSON.stringify(lateRepeat)).toContain(
      'already attempted in this run',
    )
    expect(calls).toBe(2)
  } finally {
    fetchSpy.mockRestore()
  }
})

test('direct readers do not share negative outcomes without an explicit cache', async () => {
  let calls = 0
  const fetch = async () => {
    calls += 1
    return calls === 1
      ? new Response('missing', { status: 404, statusText: 'Not Found' })
      : new Response('recovered', {
          headers: { 'content-type': 'text/plain' },
        })
  }
  const url = 'https://example.com/direct-cache-boundary-fixture'
  await readUrl({ url, fetch })
  const recovered = await readUrl({ url, fetch })
  expect(calls).toBe(2)
  expect(JSON.stringify(recovered)).toContain('recovered')
  expect(JSON.stringify(recovered)).not.toContain('errorMessage')
})
