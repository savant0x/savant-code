// AIHubMix provider lane (FID-2026-1013-004). The public rich catalog is
// keyless, but inference uses the registry credential through the generic
// OpenAI-compatible factory and strips exactly one internal prefix.

import { describe, expect, test } from 'bun:test'

import { setupModelProviderTestHarness } from './model-provider-free-mode-test-setup'

describe('model-provider AIHubMix lane (FID-2026-1013-004)', () => {
  const { importFresh } = setupModelProviderTestHarness()

  test('requires the AIHubMix API key', async () => {
    const { getModelForRequest } = await importFresh()

    await expect(
      getModelForRequest({ model: 'aihubmix/coding-glm-5.3-flash-free' }),
    ).rejects.toThrow(
      'AIHubMix API key not set. Set AIHUBMIX_API_KEY environment variable.',
    )
  })

  test('routes one-prefix-normalized models with bearer authorization and the APP-Code', async () => {
    process.env.AIHUBMIX_API_KEY = 'aihubmix-test-key'
    let observedUrl = ''
    let observedAuthorization = ''
    let observedAppCode = ''
    let observedBody = ''
    const transport = async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      observedUrl = String(input)
      observedAuthorization =
        new Headers(init?.headers).get('authorization') ?? ''
      observedAppCode = new Headers(init?.headers).get('APP-Code') ?? ''
      observedBody = String(init?.body)
      return Response.json({
        id: 'aihubmix-test',
        object: 'chat.completion',
        created: 1,
        model: 'coding-glm-5.3-flash-free',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'ok' },
            finish_reason: 'stop',
          },
        ],
      })
    }
    globalThis.fetch = Object.assign(transport, {
      preconnect: globalThis.fetch.preconnect,
    })

    const { getModelForRequest } = await importFresh()
    const result = await getModelForRequest({
      model: 'aihubmix/coding-glm-5.3-flash-free',
    })
    if (typeof result.model === 'string')
      throw new Error('Expected a resolved AIHubMix model')
    await result.model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    })

    expect(observedUrl).toBe('https://aihubmix.com/v1/chat/completions')
    expect(observedAuthorization).toBe('Bearer aihubmix-test-key')
    // The registry-declared carrier code reaches the wire (FID-2026-1013-004).
    expect(observedAppCode).toBe('MFSO2605')
    expect(observedBody).toContain('"model":"coding-glm-5.3-flash-free"')
  })
})
