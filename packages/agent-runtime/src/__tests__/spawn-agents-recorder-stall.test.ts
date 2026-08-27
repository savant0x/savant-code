import {
  createTestAgentRuntimeParams,
  testFileContext,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { assistantMessage } from '@savant-code/common/util/messages'
import {
  spyOn,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test'

import * as agentRegistry from '../templates/agent-registry'
import * as spawnAgentUtils from '../tools/handlers/tool/spawn-agent-utils'
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'

import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { AgentState } from '@savant-code/common/types/session-state'

const mockFileContext = testFileContext

const readOnlyRecorderHistory = (): Message[] => [
  {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'read-1',
        toolName: 'read_files',
        input: { paths: ['dev/fids/FID-test.md'] },
      },
    ],
  },
  {
    role: 'tool',
    toolCallId: 'read-1',
    toolName: 'read_files',
    content: [{ type: 'json', value: { file: 'dev/fids/FID-test.md' } }],
  },
]

const wroteRecorderHistory = (): Message[] => [
  ...readOnlyRecorderHistory(),
  {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: 'write-1',
        toolName: 'write_file',
        input: { path: 'dev/fids/FID-test.md', content: '# FID\n' },
      },
    ],
  },
  {
    role: 'tool',
    toolCallId: 'write-1',
    toolName: 'write_file',
    content: [
      {
        type: 'json',
        value: {
          file: 'dev/fids/FID-test.md',
          message: 'Overwrote file successfully.',
        },
      },
    ],
  },
]

interface SpawnAttempt {
  history: Message[]
  creditsUsed?: number
}

describe('spawn_agents — Recorder corrective retry ladder (FID-2026-0823-012)', () => {
  let params: any

  beforeEach(() => {
    const recorderTemplate = {
      id: 'recorder',
      displayName: 'Savant the Recorder',
      model: 'gpt-4o-mini',
      toolNames: ['write_file', 'read_files', 'set_output'],
      spawnableAgents: ['recorder'],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test instructions',
      stepPrompt: 'Test step prompt',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      outputMode: 'last_message' as const,
      mcpServers: {},
      inputSchema: {},
    }

    const baseParams = createTestAgentRuntimeParams()
    params = {
      ...baseParams,
      agentTemplate: recorderTemplate,
      agentState: getInitialAgentState(),
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      localAgentTemplates: { recorder: recorderTemplate },
      previousToolCallFinished: Promise.resolve(),
      repoId: undefined,
      repoUrl: undefined,
      signal: new AbortController().signal,
      system: 'Test system prompt',
      toolCall: {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: { agents: [] },
      },
      userId: 'test-user',
      userInputId: 'test-input',
      writeToClient: () => {},
    }

    spyOn(agentRegistry, 'getAgentTemplate').mockResolvedValue(recorderTemplate)
    spyOn(spawnAgentUtils, 'getMatchingSpawn').mockReturnValue('recorder')
  })

  afterEach(() => {
    mock.restore()
  })

  const childResult = (attempt: SpawnAttempt) => ({
    agentState: {
      ...getInitialAgentState(),
      agentId: `recorder-child-${Math.random().toString(36).slice(2, 8)}`,
      agentType: 'recorder',
      messageHistory: attempt.history,
      creditsUsed: attempt.creditsUsed ?? 0,
    },
    output: {
      type: 'lastMessage' as const,
      value: [assistantMessage('Done.')],
    },
  })

  const runSpawn = async (attempts: SpawnAttempt[]) => {
    const parentAgentState: AgentState = {
      ...getInitialAgentState(),
      agentId: 'parent-agent',
      agentType: 'savant',
    }

    const execSpy = spyOn(spawnAgentUtils, 'executeSubagent')
    for (const attempt of attempts) {
      execSpy.mockResolvedValueOnce(childResult(attempt))
    }

    const result = await handleSpawnAgents({
      ...params,
      agentState: parentAgentState,
      toolCall: {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: { agents: [{ agent_type: 'recorder', prompt: 'Update FID' }] },
      },
    })

    const reports = (result.output[0] as { type: 'json'; value: JSONValue })
      .value
    return { reports, execSpy, parentAgentState }
  }

  it('relays an errorMessage after the retry ladder is exhausted', async () => {
    const { reports, execSpy } = await runSpawn([
      { history: readOnlyRecorderHistory() },
      { history: readOnlyRecorderHistory() },
    ])
    expect(execSpy).toHaveBeenCalledTimes(2)
    const reportsArray = reports as Array<Record<string, unknown>>
    const value = reportsArray[0]?.value as Record<string, unknown>
    expect(value.errorMessage).toContain('Recorder stalled')
    expect(value.errorMessage).toContain('read without write')
  })

  it('retries once with a failure-naming suffix and relays success', async () => {
    const { reports, execSpy } = await runSpawn([
      { history: readOnlyRecorderHistory() },
      { history: wroteRecorderHistory() },
    ])
    expect(execSpy).toHaveBeenCalledTimes(2)

    const secondArgs = execSpy.mock.calls[1]?.[0] as
      | { prompt?: string }
      | undefined
    expect(secondArgs?.prompt?.startsWith('Update FID\n')).toBe(true)
    expect(secondArgs?.prompt).toContain('CORRECTIVE RETRY')
    expect(secondArgs?.prompt).toContain(
      'your previous run FAILED: Recorder stalled: read without write',
    )
    expect(secondArgs?.prompt).toContain('write_file IN THE VERY NEXT STEP')

    const reportsArray = reports as Array<Record<string, unknown>>
    expect(reportsArray[0]?.value).toMatchObject({
      type: 'lastMessage',
      value: expect.arrayContaining([
        expect.objectContaining({ role: 'assistant' }),
      ]),
    })
  })

  it('does not retry when the first attempt already wrote', async () => {
    const { reports, execSpy } = await runSpawn([
      { history: wroteRecorderHistory() },
    ])
    expect(execSpy).toHaveBeenCalledTimes(1)
    const reportsArray = reports as Array<Record<string, unknown>>
    expect(reportsArray[0]?.value).toMatchObject({ type: 'lastMessage' })
  })

  it('merges the stalled attempt credits into parent aggregation', async () => {
    const { parentAgentState } = await runSpawn([
      { history: readOnlyRecorderHistory(), creditsUsed: 3 },
      { history: wroteRecorderHistory(), creditsUsed: 5 },
    ])
    expect(parentAgentState.creditsUsed).toBe(8)
  })
})