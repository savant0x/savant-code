// FID-2026-0819-005 Loop 273: pure mock-behavior helpers and the mock
// prompt fns extracted to e2e-mocks/mock-behavior.ts and
// e2e-mocks/mock-prompt-fns.ts. This module keeps the mock credentials,
// the mock agent-template builder, and the spy installer that wires the
// mocks over the real database/LLM modules.
import { models } from '@savant-code/common/old-constants'
import { jsonValueSchema } from '@savant-code/common/types/json'
import { spyOn } from 'bun:test'
import z from 'zod/v4'

import {
  promptAiSdkMock,
  promptAiSdkStreamMock,
  promptAiSdkStructuredMock,
} from './e2e-mocks/mock-prompt-fns'
import { SavantCodeClient } from '../../src/client'
import * as databaseModule from '../../src/impl/database'
import * as llmModule from '../../src/impl/llm'

export {
  promptAiSdkMock,
  promptAiSdkStreamMock,
  promptAiSdkStructuredMock,
} from './e2e-mocks/mock-prompt-fns'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'

export const E2E_MOCK_API_KEY = 'savant-code-e2e-mock'

const MOCK_USER = {
  id: 'e2e-user',
  email: 'e2e-user@savant-code.test',
  discord_id: null,
  referral_code: null,
  stripe_customer_id: null,
  banned: false,
  created_at: new Date('2024-01-01T00:00:00Z'),
} as const

function buildMockAgentTemplate(params: {
  publisherId: string
  agentId: string
  version?: string
}): AgentTemplate {
  const { publisherId, agentId, version } = params
  const id = `${publisherId}/${agentId}@${version ?? 'latest'}`

  return {
    id,
    displayName: `${agentId} (mock)`,
    model: models.openrouter_claude_sonnet_4_5,
    mcpServers: {},
    toolNames: [],
    spawnableAgents: [],
    systemPrompt: '',
    instructionsPrompt: 'You are a helpful assistant.',
    stepPrompt: '',
    inputSchema: {
      prompt: z.string().optional(),
      params: z.record(z.string(), jsonValueSchema).optional(),
    },
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    outputMode: 'last_message',
  }
}

let mocksApplied = false

export function setupE2eMocks(): void {
  if (mocksApplied) {
    return
  }
  mocksApplied = true

  spyOn(databaseModule, 'getUserInfoFromApiKey').mockImplementation(
    async ({ fields }) =>
      Object.fromEntries(
        fields.map((field) => [field, MOCK_USER[field]]),
      ) as unknown as Awaited<
        ReturnType<typeof databaseModule.getUserInfoFromApiKey>
      >,
  )
  spyOn(databaseModule, 'fetchAgentFromDatabase').mockImplementation(
    async ({ parsedAgentId }) => buildMockAgentTemplate(parsedAgentId),
  )
  spyOn(databaseModule, 'startAgentRun').mockImplementation(
    async () => `mock-run-${Math.random().toString(36).slice(2, 10)}`,
  )
  spyOn(databaseModule, 'finishAgentRun').mockImplementation(async () => {})
  spyOn(databaseModule, 'addAgentStep').mockImplementation(
    async () => `mock-step-${Math.random().toString(36).slice(2, 10)}`,
  )

  spyOn(llmModule, 'promptAiSdkStream').mockImplementation(
    promptAiSdkStreamMock,
  )
  spyOn(llmModule, 'promptAiSdk').mockImplementation(promptAiSdkMock)
  spyOn(llmModule, 'promptAiSdkStructured').mockImplementation(
    promptAiSdkStructuredMock as typeof llmModule.promptAiSdkStructured,
  )

  spyOn(SavantCodeClient.prototype, 'checkConnection').mockResolvedValue(true)
}
