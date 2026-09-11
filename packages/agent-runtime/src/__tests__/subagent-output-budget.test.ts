// FID-2026-0909-008 Step 4 pins: the run's resolved output budget propagates
// to spawned child agent loops — but only when the child actually runs the
// model the budget was resolved for. The truncation class did its worst
// damage in subagent spawns (Forge/Thinker/Recorder kills), so coverage here
// is the point of the subagent seam.

import {
  createTestAgentRuntimeParams,
  testFileContext,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
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

const mockFileContext = testFileContext

describe('Subagent output-budget propagation (FID-2026-0909-008 Step 4)', () => {
  let mockAgentTemplate: any
  let mockLocalAgentTemplates: Record<string, any>
  let params: any

  beforeEach(() => {
    mockAgentTemplate = {
      id: 'test-agent',
      displayName: 'Test Agent',
      model: 'z-ai/glm-5.3-free',
      toolNames: ['write_file'],
      spawnableAgents: ['test-agent'],
      systemPrompt: 'Test system prompt',
      instructionsPrompt: 'Test instructions',
      stepPrompt: 'Test step prompt',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      outputMode: 'last_message',
      inputSchema: {},
    }

    mockLocalAgentTemplates = {
      'test-agent': mockAgentTemplate,
    }

    const baseParams = createTestAgentRuntimeParams()
    params = {
      ...baseParams,
      agentTemplate: mockAgentTemplate,
      agentState: getInitialAgentState(),
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      localAgentTemplates: mockLocalAgentTemplates,
      maxOutputTokens: 65536,
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

    spyOn(agentRegistry, 'getAgentTemplate').mockResolvedValue(
      mockAgentTemplate,
    )
    spyOn(spawnAgentUtils, 'getMatchingSpawn').mockReturnValue('test-agent')
  })

  afterEach(() => {
    mock.restore()
  })

  it('threads the budget to a child that inherits the parent model', async () => {
    // Child resolves to the same template → withParentModel keeps the parent
    // model → the budget rides along to the child loop.
    const executeSpy = spyOn(
      spawnAgentUtils,
      'executeSubagent',
    ).mockResolvedValueOnce({
      agentState: getInitialAgentState(),
      output: { type: 'allMessages', value: [] },
    } as never)

    await handleSpawnAgents({
      ...params,
      agentState: {
        ...getInitialAgentState(),
        agentId: 'parent-agent',
        agentType: 'test-agent',
      },
      toolCall: {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: {
          agents: [{ agent_type: 'test-agent', prompt: 'Task' }],
        },
      },
    })

    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(executeSpy.mock.calls[0][0].maxOutputTokens).toBe(65536)
  })

  it('drops the budget for a child that pins its own model', async () => {
    // A child with inheritParentModel: false keeps its own model — a budget
    // resolved for the parent's model is a foreign cap; the guard must omit
    // it (undefined), never cap the child at a wrong-model limit.
    const pinnedChild = {
      ...mockAgentTemplate,
      id: 'pinned-agent',
      model: 'google/gemini-2.5-pro',
      inheritParentModel: false,
    }
    mockLocalAgentTemplates['pinned-agent'] = pinnedChild
    spyOn(spawnAgentUtils, 'getMatchingSpawn').mockReturnValue('pinned-agent')
    spyOn(agentRegistry, 'getAgentTemplate').mockResolvedValue(pinnedChild)

    const executeSpy = spyOn(
      spawnAgentUtils,
      'executeSubagent',
    ).mockResolvedValueOnce({
      agentState: getInitialAgentState(),
      output: { type: 'allMessages', value: [] },
    } as never)

    await handleSpawnAgents({
      ...params,
      agentState: {
        ...getInitialAgentState(),
        agentId: 'parent-agent',
        agentType: 'test-agent',
      },
      toolCall: {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: {
          agents: [{ agent_type: 'pinned-agent', prompt: 'Task' }],
        },
      },
    })

    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(executeSpy.mock.calls[0][0].maxOutputTokens).toBeUndefined()
  })

  it('threads undefined when the run itself resolved no budget', async () => {
    // No catalog entry for the model → the run carries undefined → the child
    // receives undefined (max_tokens omitted; provider default governs).
    const executeSpy = spyOn(
      spawnAgentUtils,
      'executeSubagent',
    ).mockResolvedValueOnce({
      agentState: getInitialAgentState(),
      output: { type: 'allMessages', value: [] },
    } as never)

    await handleSpawnAgents({
      ...params,
      maxOutputTokens: undefined,
      agentState: {
        ...getInitialAgentState(),
        agentId: 'parent-agent',
        agentType: 'test-agent',
      },
      toolCall: {
        toolName: 'spawn_agents' as const,
        toolCallId: 'test-call',
        input: {
          agents: [{ agent_type: 'test-agent', prompt: 'Task' }],
        },
      },
    })

    expect(executeSpy).toHaveBeenCalledTimes(1)
    expect(executeSpy.mock.calls[0][0].maxOutputTokens).toBeUndefined()
  })
})
