import { mock } from 'bun:test'

import {
  mockFileContext,
  testCiEnv,
  testClientEnv,
  testFetch,
  testLogger,
} from './agent-runtime-primitives'
import { promptSuccess } from '../../util/error'

import type { TestAgentRuntimeParams } from './agent-runtime'

// FID-2026-0819-005 Loop 154: the deprecated whole-runtime impl constant and
// the deps factory, extracted verbatim from agent-runtime.ts. Re-exported
// from agent-runtime.ts — the public surface is unchanged.

/** @deprecated Use createTestAgentRuntimeParams() */
export const TEST_AGENT_RUNTIME_IMPL = Object.freeze({
  clientEnv: testClientEnv,
  ciEnv: testCiEnv,
  trackEvent: () => {},
  logger: testLogger,
  fetch: testFetch,
  getUserInfoFromApiKey: async <T extends string>({
    fields,
  }: {
    apiKey: string
    fields: readonly T[]
  }) => {
    const user = {
      id: 'test-user-id',
      email: 'test@example.com',
      discord_id: 'test-discord-id',
      stripe_customer_id: null,
      banned: false,
      created_at: new Date('2024-01-01T00:00:00Z'),
    } as const
    return Object.fromEntries(
      fields.map((field) => [field, user[field as keyof typeof user]]),
    ) as {
      [K in T]: (typeof user)[K & keyof typeof user]
    }
  },
  fetchAgentFromDatabase: async () => null,
  startAgentRun: async () => 'test-agent-run-id',
  finishAgentRun: async () => {},
  addAgentStep: async () => 'test-agent-step-id',
  consumeCreditsWithFallback: async () => {
    throw new Error(
      'consumeCreditsWithFallback not implemented in test runtime',
    )
  },
  promptAiSdkStream: async function* () {
    throw new Error('promptAiSdkStream not implemented in test runtime')
  },
  promptAiSdk: async function () {
    throw new Error('promptAiSdk not implemented in test runtime')
  },
  promptAiSdkStructured: async function () {
    throw new Error('promptAiSdkStructured not implemented in test runtime')
  },
  databaseAgentCache: new Map(),
  handleStepsLogChunk: () => {
    throw new Error('handleStepsLogChunk not implemented in test runtime')
  },
  requestToolCall: () => {
    throw new Error('requestToolCall not implemented in test runtime')
  },
  requestMcpToolData: () => {
    throw new Error('requestMcpToolData not implemented in test runtime')
  },
  requestFiles: () => {
    throw new Error('requestFiles not implemented in test runtime')
  },
  requestOptionalFile: () => {
    throw new Error('requestOptionalFile not implemented in test runtime')
  },
  sendSubagentChunk: () => {
    throw new Error('sendSubagentChunk not implemented in test runtime')
  },
  sendAction: () => {
    throw new Error('sendAction not implemented in test runtime')
  },
  apiKey: 'test-api-key',
})

export function createTestAgentRuntimeDeps(): Omit<
  TestAgentRuntimeParams,
  'agentTemplate' | 'localAgentTemplates'
> {
  return {
    sendAction: mock(() => {}),
    requestFiles: mock(async () => ({})),
    requestToolCall: mock(async () => ({
      success: true,
      result: 'mock result',
    })),
    onResponseChunk: mock(() => {}),
    fileContext: mockFileContext,
    promptAiSdkStream: mock(async function* () {
      yield { type: 'text' as const, text: 'Mock response\n\n' }
      yield {
        type: 'tool-call' as const,
        toolName: 'end_turn',
        toolCallId: 'mock-id',
        input: {},
      }
      return promptSuccess('mock-message-id')
    }),
    promptAiSdk: mock(async () => promptSuccess('Mock response')),
    promptAiSdkStructured: mock(async () => promptSuccess({})),
    requestMcpToolData: mock(async () => ({})),
    startAgentRun: mock(async () => 'test-run-id'),
    finishAgentRun: mock(async () => {}),
    addAgentStep: mock(async () => 'test-step-id'),
    logger: testLogger,
    trackEvent: mock(() => {}),
    clientEnv: testClientEnv,
    ciEnv: testCiEnv,
    apiKey: 'test-api-key',
    fetch: testFetch,
    fetchAgentFromDatabase: mock(async () => null),
    databaseAgentCache: new Map<string, null>(),
    consumeCreditsWithFallback: mock(async () => {}),
    getUserInfoFromApiKey: mock(async () => ({
      id: 'test-user-id',
      email: 'test@example.com',
    })),
    handleStepsLogChunk: mock(() => {}),
    requestOptionalFile: mock(async () => null),
    sendSubagentChunk: mock(() => {}),
  }
}
