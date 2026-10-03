import { captureModelRoute } from '@savant-code/common/providers/model-route'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import { expect, test } from 'bun:test'

import { promptFlashWithFallbacks } from '../llm-api/gemini-with-fallbacks'
import { getAgentStreamFromTemplate } from '../prompt-agent-stream'
import { handleNParameterStep } from '../run-agent-step/n-parameter'
import { applySemanticSummaryUpgrade } from '../tools/handlers/tool/semantic-summary-upgrade'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { PromptAiSdkFn } from '@savant-code/common/types/contracts/llm'

const logger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {},
}
const base = {
  clientSessionId: 's',
  fingerprintId: 'f',
  userInputId: 'u',
  runId: 'r',
  userId: undefined,
  signal: new AbortController().signal,
  logger,
  trackEvent: () => {},
  sendAction: async () => {},
}
test('stream, n-response and summary callers preserve a captured serving route', async () => {
  const route = captureModelRoute('openrouter')
  const template = {
    model: 'openai/gpt-5',
    modelRoute: route,
    spawnableAgents: [],
    providerOptions: { data_collection: 'deny' },
  } as unknown as AgentTemplate
  const stream = getAgentStreamFromTemplate({
    ...base,
    localAgentTemplates: {},
    template,
    tools: {},
    messages: [],
    promptAiSdkStream: async function* (params) {
      expect(params.modelRoute).toEqual(route)
      expect(params.agentProviderOptions?.data_collection).toBe('deny')
      return promptSuccess('ok')
    },
  })
  await stream.next()
  const prompt: PromptAiSdkFn = async (params) => {
    expect(params.modelRoute).toEqual(route)
    return promptSuccess('["one"]')
  }
  const state = getInitialAgentState()
  const n = await handleNParameterStep({
    runParams: {
      ...base,
      agentTemplate: template,
      promptAiSdk: prompt,
    } as never,
    agentState: state,
    n: 1,
    cacheDebugCorrelation: undefined,
    onCostCalculated: async () => {},
  })
  expect(n.nResponses).toEqual(['one'])
  const summary = await applySemanticSummaryUpgrade({
    ...base,
    model: template.model,
    modelRoute: route,
    deterministicExcerpt: 'original',
    promptAiSdk: prompt,
  })
  expect(summary.excerpt).toBe('original')
})
test('a helper fallback replaces its route and clears foreign request budgets', async () => {
  const requests: Parameters<PromptAiSdkFn>[0][] = []
  await promptFlashWithFallbacks({
    ...base,
    model: 'primary',
    modelRoute: captureModelRoute('nvidia'),
    contextWindow: 999,
    maxOutputTokens: 333,
    messages: [],
    promptAiSdk: async (params) => {
      requests.push(params)
      if (requests.length === 1) throw new Error('unavailable')
      return promptSuccess('ok')
    },
  })
  expect(requests[1].modelRoute?.providerId).toBe('openrouter')
  expect(requests[1].contextWindow).toBeUndefined()
  expect(requests[1].maxOutputTokens).toBeUndefined()
})
