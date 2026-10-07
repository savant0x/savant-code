// FID-2026-0909-008 Step 4 pin: the agent stream call site forwards the
// resolved output budget to the SDK stream instead of pinning
// `maxOutputTokens: undefined` — the unset budget was the generator of the
// native tool-call truncation class this FID closes.

import { advertisedModelVisible } from '@savant-code/common/providers/availability-state'
import { promptSuccess } from '@savant-code/common/util/error'
import { describe, expect, test } from 'bun:test'

import { getAgentStreamFromTemplate } from '../prompt-agent-stream'
import { DEFAULT_RETRY_POLICY } from '../provider-boundary/retry-policy'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { PromptAiSdkStreamFn } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { ToolSet } from 'ai'

const template: AgentTemplate = {
  id: 'savant',
  displayName: 'Savant',
  spawnerPrompt: '',
  model: 'z-ai/glm-5.3-free',
  inputSchema: {},
  outputMode: 'last_message',
  includeMessageHistory: false,
  inheritParentSystemPrompt: false,
  mcpServers: {},
  toolNames: [],
  spawnableAgents: [],
  systemPrompt: '',
  instructionsPrompt: '',
  stepPrompt: '',
}

/** Capturing stand-in for the SDK stream entry point: records the exact
 * params object the call site assembled, then completes like the harness
 * mock does. The generator body only runs on first next(). */
function makeCapturingStream(): {
  stream: PromptAiSdkStreamFn
  captured: Array<ParamsOf<PromptAiSdkStreamFn>>
} {
  const captured: Array<ParamsOf<PromptAiSdkStreamFn>> = []
  const stream: PromptAiSdkStreamFn = async function* (params) {
    captured.push(params)
    return promptSuccess('mock-message-id')
  }
  return { stream, captured }
}

function makeBaseParams(stream: PromptAiSdkStreamFn) {
  return {
    clientSessionId: 'test-session',
    fingerprintId: 'test-fingerprint',
    localAgentTemplates: {},
    // The seam now records stream-recovery accounting through the logger
    // (FID-2026-1005-007), so the stub carries the used methods.
    logger: { info: () => {}, warn: () => {} } as never as Logger,
    messages: [] as Message[],
    runId: 'test-run',
    signal: new AbortController().signal,
    template,
    tools: {} as ToolSet,
    userId: undefined,
    userInputId: 'test-input',
    sendAction: (() => {}) as never,
    trackEvent: (() => {}) as never,
    promptAiSdkStream: stream,
  }
}

describe('getAgentStreamFromTemplate output-budget forwarding (FID-2026-0909-008 Step 4)', () => {
  test('forwards the resolved output budget to the SDK stream', async () => {
    const { stream, captured } = makeCapturingStream()
    const generator = getAgentStreamFromTemplate({
      ...makeBaseParams(stream),
      maxOutputTokens: 65536,
    })

    await generator.next()

    // Pre-fix RED leg: the call site pinned `maxOutputTokens: undefined`,
    // so a resolved budget never reached the request body.
    expect(captured[0]?.maxOutputTokens).toBe(65536)
  })

  test('omits the budget when unresolved — undefined, never an invented value', async () => {
    const { stream, captured } = makeCapturingStream()
    const generator = getAgentStreamFromTemplate(makeBaseParams(stream))

    await generator.next()

    // Unknown model → the resolver yields undefined → the request omits
    // max_tokens and the provider default governs (with the Steps 1–3
    // length-finish detection + split steering as the recovery net).
    expect(captured[0]?.maxOutputTokens).toBeUndefined()
  })

  test('stream param assembly is otherwise unchanged', async () => {
    const { stream, captured } = makeCapturingStream()
    const generator = getAgentStreamFromTemplate(makeBaseParams(stream))

    await generator.next()

    const params = captured[0]
    expect(params.model).toBe('z-ai/glm-5.3-free')
    // FID-2026-1005-006: the classified boundary owns retries, so the
    // client's blind retry is disabled (was a uniform `maxRetries: 3`).
    expect(params.maxRetries).toBe(0)
    expect(params.tools).toEqual({})
    expect(params.runId).toBe('test-run')
  })

  test('a malformed retryPolicy fails at call time, loudly (FID-2026-1005-006)', () => {
    const { stream } = makeCapturingStream()
    // The measured session-killer shape: timing keys nested under backoff.
    expect(() =>
      getAgentStreamFromTemplate({
        ...makeBaseParams(stream),
        retryPolicy: { maxAttempts: 3, backoff: { baseDelayMs: 500 } },
      }),
    ).toThrow(/retryPolicy\.backoff/)
  })

  test('production stream calls still reach the provider after the breaker opens', async () => {
    let calls = 0
    const stream: PromptAiSdkStreamFn = async function* () {
      calls++
      throw { status: 503 }
    }
    const base = {
      ...makeBaseParams(stream),
      clientSessionId: 'breaker-integration-session',
      retryPolicy: { ...DEFAULT_RETRY_POLICY, maxAttempts: 1 },
    }
    for (let turn = 0; turn < 3; turn++) {
      await expect(
        getAgentStreamFromTemplate({
          ...base,
          runId: `failure-${turn}`,
        }).next(),
      ).rejects.toThrow()
    }
    await expect(
      getAgentStreamFromTemplate({ ...base, runId: 'user-retry' }).next(),
    ).rejects.toThrow(/provider call failed \(transient\/server\)/)
    expect(calls).toBe(4)
  })

  test('an explicit model refusal hides it and a later success restores it', async () => {
    const providerId = 'chatanywhere'
    const modelId = 'availability-test/model-unique'
    const routed = {
      ...makeBaseParams(async function* () {
        throw {
          status: 404,
          responseBody: JSON.stringify({ error: { code: 'model_not_found' } }),
        }
      }),
      template: {
        ...template,
        model: modelId,
        modelRoute: { providerId, authMode: 'provider' as const },
      },
    }
    await expect(getAgentStreamFromTemplate(routed).next()).rejects.toThrow()
    expect(advertisedModelVisible(providerId, modelId)).toBe(false)
    const success = {
      ...routed,
      promptAiSdkStream: async function* () {
        return promptSuccess('restored')
      },
    }
    await getAgentStreamFromTemplate(success).next()
    expect(advertisedModelVisible(providerId, modelId)).toBe(true)
  })
})
