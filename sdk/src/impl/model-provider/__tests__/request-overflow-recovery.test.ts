import { ModelRequestLimitsStore } from '@savant-code/common/util/model-request-limits'
import { describe, expect, mock, test } from 'bun:test'

import { withRequestTokenBudget } from '../request-budget'
import { countRequestInputTokens } from '../request-token-count'

import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider'

/**
 * FID-2026-1009-003 L2: the context-overflow seam. When a request's input
 * estimate leaves no output headroom, the budget layer must not hard-fail:
 * it invokes the host seam (if wired), trims the oldest non-system turns of
 * THIS prompt, and retries exactly once. A prompt that cannot fit even
 * trimmed rethrows the original error — the seam and the trim had their
 * chance first.
 */

const generated: Awaited<ReturnType<LanguageModelV2['doGenerate']>> = {
  content: [{ type: 'text', text: 'ok' }],
  finishReason: 'stop',
  usage: { inputTokens: 10, outputTokens: 1, totalTokens: 11 },
  warnings: [],
}

function fixture(contextWindow: number) {
  const store = new ModelRequestLimitsStore()
  store.replaceCatalog([
    {
      id: 'gateway/flash',
      contextLength: contextWindow,
      maxCompletionTokens: 1900,
    },
  ])
  const doGenerate = mock(
    async (_params: LanguageModelV2CallOptions) => generated,
  )
  const doStream = mock(async (_params: LanguageModelV2CallOptions) => ({
    stream: new ReadableStream<LanguageModelV2StreamPart>({
      start(controller) {
        controller.close()
      },
    }),
  }))
  const raw: LanguageModelV2 = {
    specificationVersion: 'v2',
    provider: 'gateway',
    modelId: 'flash',
    supportedUrls: {},
    doGenerate,
    doStream,
  }
  const options = {
    catalogId: 'gateway/flash',
    routeId: 'endpoint-a',
    limitsStore: store,
  }
  return { raw, options, doGenerate, doStream }
}

// Overflows a 2000-token window only because of its middle turn: dropping
// the oldest non-system message brings it back under the budget, so the
// seam + trim + retry-once path has something to recover. The system
// message and the final (current) turn are never dropped.
const overflowingPrompt: LanguageModelV2CallOptions['prompt'] = [
  { role: 'system', content: 'system rules' },
  { role: 'user', content: [{ type: 'text', text: 'x '.repeat(5000) }] },
  { role: 'user', content: [{ type: 'text', text: 'current question' }] },
]

describe('context-overflow recovery seam (FID-2026-1009-003 L2)', () => {
  test('a wired seam is invoked with the overflow facts, then the oldest turns are trimmed and the request retries once', async () => {
    const { raw, options, doGenerate } = fixture(2000)
    const seam: Array<{ inputTokens: number; contextWindow: number }> = []
    const model = withRequestTokenBudget(raw, {
      ...options,
      onContextOverflow: (info) => {
        seam.push(info)
      },
    })
    const params: LanguageModelV2CallOptions = {
      prompt: overflowingPrompt,
      maxOutputTokens: 1900,
    }
    const fullInput = countRequestInputTokens(params)
    expect(fullInput).toBeGreaterThan(2000 - 20)

    await model.doGenerate(params)

    // Seam fired exactly once, with the true estimate and resolved window.
    expect(seam).toHaveLength(1)
    expect(seam[0].contextWindow).toBe(2000)
    expect(seam[0].inputTokens).toBe(fullInput)
    // The retry is a re-budget of the trimmed prompt: exactly one dispatch.
    expect(doGenerate).toHaveBeenCalledTimes(1)
    const sent = doGenerate.mock.calls[0][0]
    expect(sent.prompt).toHaveLength(2)
    expect(sent.prompt[0].role).toBe('system')
    expect(sent.prompt[1].content).toEqual([
      { type: 'text', text: 'current question' },
    ])
  })

  test('without a wired seam the trim recovery still retries once (the documented fallback)', async () => {
    const { raw, options, doGenerate } = fixture(2000)
    const model = withRequestTokenBudget(raw, options)

    await model.doGenerate({ prompt: overflowingPrompt, maxOutputTokens: 1900 })

    expect(doGenerate).toHaveBeenCalledTimes(1)
    expect(doGenerate.mock.calls[0][0].prompt).toHaveLength(2)
  })

  test('a throwing seam is swallowed and never blocks the trim recovery', async () => {
    const { raw, options, doGenerate } = fixture(2000)
    const model = withRequestTokenBudget(raw, {
      ...options,
      onContextOverflow: () => {
        throw new Error('seam exploded')
      },
    })

    await model.doGenerate({ prompt: overflowingPrompt, maxOutputTokens: 1900 })

    expect(doGenerate).toHaveBeenCalledTimes(1)
    expect(doGenerate.mock.calls[0][0].prompt).toHaveLength(2)
  })

  test('the stream path recovers identically', async () => {
    const { raw, options, doStream } = fixture(2000)
    const model = withRequestTokenBudget(raw, options)

    await model.doStream({ prompt: overflowingPrompt, maxOutputTokens: 1900 })

    expect(doStream).toHaveBeenCalledTimes(1)
    expect(doStream.mock.calls[0][0].prompt).toHaveLength(2)
  })

  test('a request that fits never invokes the seam and dispatches the prompt unchanged', async () => {
    const { raw, options, doGenerate } = fixture(2000)
    let seamCalls = 0
    const model = withRequestTokenBudget(raw, {
      ...options,
      onContextOverflow: () => {
        seamCalls += 1
      },
    })
    const params: LanguageModelV2CallOptions = {
      prompt: [
        { role: 'system', content: 'system rules' },
        {
          role: 'user',
          content: [{ type: 'text', text: 'current question' }],
        },
      ],
      maxOutputTokens: 1900,
    }

    await model.doGenerate(params)

    expect(seamCalls).toBe(0)
    expect(doGenerate).toHaveBeenCalledTimes(1)
    expect(doGenerate.mock.calls[0][0].prompt).toBe(params.prompt)
  })

  test('an untrimmable overflow invokes the seam once and then rethrows the original error', async () => {
    const { raw, options, doGenerate } = fixture(50)
    let seamCalls = 0
    const model = withRequestTokenBudget(raw, {
      ...options,
      onContextOverflow: () => {
        seamCalls += 1
      },
    })
    const oversized: LanguageModelV2CallOptions = {
      prompt: [{ role: 'system', content: 'x '.repeat(500) }],
      maxOutputTokens: 1900,
    }

    await expect(model.doGenerate(oversized)).rejects.toMatchObject({
      code: 'context_length_exceeded',
    })
    expect(seamCalls).toBe(1)
    expect(doGenerate).not.toHaveBeenCalled()
  })
})
