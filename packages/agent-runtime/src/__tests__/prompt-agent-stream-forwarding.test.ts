// FID-2026-0909-008 Step 4 pin: the agent stream call site forwards the
// resolved output budget to the SDK stream instead of pinning
// `maxOutputTokens: undefined` — the unset budget was the generator of the
// native tool-call truncation class this FID closes.

import { promptSuccess } from '@savant-code/common/util/error'
import { describe, expect, test } from 'bun:test'

import { getAgentStreamFromTemplate } from '../prompt-agent-stream'

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
    apiKey: 'test-key',
    clientSessionId: 'test-session',
    fingerprintId: 'test-fingerprint',
    localAgentTemplates: {},
    logger: {} as never as Logger,
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
    expect(params.maxRetries).toBe(3)
    expect(params.tools).toEqual({})
    expect(params.runId).toBe('test-run')
  })
})
