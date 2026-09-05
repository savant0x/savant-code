/**
 * Test fixtures for agent runtime testing.
 *
 * Provides pre-built test fixtures and factory functions for
 * testing agent runtime components without needing to set up
 * all the dependencies manually.
 *
 * @example
 * ```typescript
 * import {
 *   createTestAgentRuntimeParams,
 *   createTestAgentRuntimeDeps,
 *   mockFileContext,
 * } from '@savant-code/common/testing/fixtures/agent-runtime'
 *
 * const params = createTestAgentRuntimeParams()
 * const { agentTemplate, localAgentTemplates } = params
 * ```
 */

import { mock } from 'bun:test'

import {
  emptyMcpServers,
  mockFileContext,
  testCiEnv,
  testClientEnv,
  testFetch,
  testLogger,
} from './agent-runtime-primitives'
import { promptSuccess } from '../../util/error'

// FID-2026-0819-005 Loop 154: the deprecated whole-runtime impl constant and
// the deps factory live in ./agent-runtime-deps and are re-exported here —
// the public surface is unchanged. The shared primitives live in
// ./agent-runtime-primitives (extracted to break an init-order cycle) and
// are re-exported from here as well.
export {
  TEST_AGENT_RUNTIME_IMPL,
  createTestAgentRuntimeDeps,
} from './agent-runtime-deps'
export {
  emptyMcpServers,
  mockFileContext,
  testCiEnv,
  testClientEnv,
  testFetch,
  testFileContext,
  testLogger,
} from './agent-runtime-primitives'

import type { AgentTemplate } from '../../types/agent-template'
import type { ProjectFileContext } from '../../util/file'

export interface TestAgentRuntimeParams {
  agentTemplate: AgentTemplate
  localAgentTemplates: Record<string, AgentTemplate>
  sendAction: ReturnType<typeof mock>
  requestFiles: ReturnType<typeof mock>
  requestToolCall: ReturnType<typeof mock>
  onResponseChunk: ReturnType<typeof mock>
  fileContext: ProjectFileContext
  promptAiSdkStream: ReturnType<typeof mock>
  promptAiSdk: ReturnType<typeof mock>
  promptAiSdkStructured: ReturnType<typeof mock>
  requestMcpToolData: ReturnType<typeof mock>
  startAgentRun: ReturnType<typeof mock>
  finishAgentRun: ReturnType<typeof mock>
  addAgentStep: ReturnType<typeof mock>
  logger: typeof testLogger
  trackEvent: ReturnType<typeof mock>
  clientEnv: typeof testClientEnv
  ciEnv: typeof testCiEnv
  apiKey: string
  fetch: typeof testFetch
  fetchAgentFromDatabase: ReturnType<typeof mock>
  databaseAgentCache: Map<string, null>
  consumeCreditsWithFallback: ReturnType<typeof mock>
  getUserInfoFromApiKey: ReturnType<typeof mock>
  handleStepsLogChunk: ReturnType<typeof mock>
  requestOptionalFile: ReturnType<typeof mock>
  sendSubagentChunk: ReturnType<typeof mock>
}

export function createTestAgentRuntimeParams(
  overrides: Partial<TestAgentRuntimeParams> = {},
): TestAgentRuntimeParams {
  const defaultTemplate: TestAgentRuntimeParams['agentTemplate'] = {
    id: 'test-agent',
    displayName: 'Test Agent',
    model: 'claude-3-5-sonnet-20241022',
    inputSchema: {},
    outputMode: 'last_message',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: emptyMcpServers,
    toolNames: ['read_files', 'write_file', 'end_turn'],
    spawnableAgents: [],
    systemPrompt: 'You are a test agent.',
    instructionsPrompt: 'Help the user with testing.',
    stepPrompt: '',
  }

  const agentTemplate = overrides.agentTemplate ?? defaultTemplate

  return {
    agentTemplate,
    localAgentTemplates: overrides.localAgentTemplates ?? {
      'test-agent': agentTemplate,
    },
    sendAction: overrides.sendAction ?? mock(() => {}),
    requestFiles: overrides.requestFiles ?? mock(async () => ({})),
    requestToolCall:
      overrides.requestToolCall ??
      mock(async () => ({ success: true, result: 'mock result' })),
    onResponseChunk: overrides.onResponseChunk ?? mock(() => {}),
    fileContext: overrides.fileContext ?? mockFileContext,
    promptAiSdkStream:
      overrides.promptAiSdkStream ??
      mock(async function* () {
        yield { type: 'text' as const, text: 'Mock response\n\n' }
        yield {
          type: 'tool-call' as const,
          toolName: 'end_turn',
          toolCallId: 'mock-id',
          input: {},
        }
        return promptSuccess('mock-message-id')
      }),
    promptAiSdk:
      overrides.promptAiSdk ?? mock(async () => promptSuccess('Mock response')),
    promptAiSdkStructured:
      overrides.promptAiSdkStructured ?? mock(async () => promptSuccess({})),
    requestMcpToolData: overrides.requestMcpToolData ?? mock(async () => ({})),
    startAgentRun: overrides.startAgentRun ?? mock(async () => 'test-run-id'),
    finishAgentRun: overrides.finishAgentRun ?? mock(async () => {}),
    addAgentStep: overrides.addAgentStep ?? mock(async () => 'test-step-id'),
    logger: overrides.logger ?? testLogger,
    trackEvent: overrides.trackEvent ?? mock(() => {}),
    clientEnv: overrides.clientEnv ?? testClientEnv,
    ciEnv: overrides.ciEnv ?? testCiEnv,
    apiKey: overrides.apiKey ?? 'test-api-key',
    fetch: overrides.fetch ?? testFetch,
    fetchAgentFromDatabase:
      overrides.fetchAgentFromDatabase ?? mock(async () => null),
    databaseAgentCache: overrides.databaseAgentCache ?? new Map<string, null>(),
    consumeCreditsWithFallback:
      overrides.consumeCreditsWithFallback ?? mock(async () => {}),
    getUserInfoFromApiKey:
      overrides.getUserInfoFromApiKey ??
      mock(async () => ({
        id: 'test-user-id',
        email: 'test@example.com',
      })),
    handleStepsLogChunk: overrides.handleStepsLogChunk ?? mock(() => {}),
    requestOptionalFile:
      overrides.requestOptionalFile ?? mock(async () => null),
    sendSubagentChunk: overrides.sendSubagentChunk ?? mock(() => {}),
    ...overrides,
  }
}
