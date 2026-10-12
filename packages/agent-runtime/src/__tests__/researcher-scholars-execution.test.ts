import { describe, expect, mock, test } from 'bun:test'

import {
  createBaseParams,
  makeAgentTemplate,
  type ChunkRecord,
} from './tool-executor-gate-order-fixtures'
import { getMCPToolData } from '../mcp'
import { applyNativeStrikeHandling } from '../run-agent-step/loop/native-strikes'
import { getToolSet } from '../tools/prompts'
import { handleStreamErrorChunk } from '../tools/stream-parser/error-chunk'
import { executeCustomToolCall } from '../tools/tool-executor/custom'

import type { ExecuteToolCallParams } from '../tools/tool-executor/types'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

type McpRequest = Parameters<
  ExecuteToolCallParams<string>['requestToolCall']
>[0]

const NAME = 'scholars-search__search_papers'

async function setup() {
  const chunks: ChunkRecord[] = []
  const template = makeAgentTemplate([
    'web_search',
    'read_url',
    'deep_research',
  ])
  template.id = 'researcher-web'
  template.mcpServers = {
    'scholars-search': {
      type: 'http',
      url: 'https://papers.test/mcp',
      params: {},
      headers: {},
    },
  }
  const defs = await getMCPToolData({
    toolNames: template.toolNames,
    mcpServers: template.mcpServers,
    requestMcpToolData: async () => [
      {
        name: 'search_papers',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
    ],
  })
  const tools = await getToolSet({
    toolNames: template.toolNames,
    additionalToolDefinitions: async () => defs,
    agentTools: {},
    skills: {},
  })
  const params = {
    ...createBaseParams('/test/project', chunks, template),
    toolName: NAME,
    input: { query: 'graph neural networks' },
    autoInsertEndStepParam: true,
    customToolDefinitions: defs,
    tools,
    requestToolCall: mock(async (_request: McpRequest) => ({ output: [] })),
  }
  params.fileContext.permissionMode = 'unsafe'
  return { params, chunks, defs }
}

describe('scholars-search actual execution', () => {
  test('repairs encoded arrays and numbers before the real executor dispatch', async () => {
    const { params } = await setup()
    const defs = await getMCPToolData({
      toolNames: params.agentTemplate.toolNames,
      mcpServers: params.agentTemplate.mcpServers,
      requestMcpToolData: async () => [
        {
          name: 'search_papers',
          inputSchema: {
            type: 'object',
            properties: {
              ids: { type: 'array', items: { type: 'string' }, maxItems: 20 },
              limit: { type: 'integer', minimum: 1, maximum: 100 },
            },
            required: ['ids'],
          },
        },
      ],
    })
    await executeCustomToolCall({
      ...params,
      customToolDefinitions: defs,
      input: { ids: '["W4390591490"]', limit: '10' },
    })
    expect(params.requestToolCall).toHaveBeenCalledTimes(1)
    expect(params.requestToolCall.mock.calls[0]?.[0].input).toEqual({
      ids: ['W4390591490'],
      limit: 10,
    })
  })
  test('dispatches an offered tool from the agent-owned remote server', async () => {
    const { params, chunks, defs } = await setup()
    expect(defs[NAME].effect).toBe('network')
    expect(defs[NAME].permission).toBe('prompt')
    await executeCustomToolCall(params)
    expect(params.requestToolCall).toHaveBeenCalledTimes(1)
    expect(params.requestToolCall.mock.calls[0]?.[0]).toMatchObject({
      toolName: 'search_papers',
      mcpConfig: { type: 'http', url: 'https://papers.test/mcp' },
    })
    expect(chunks.some((chunk) => chunk.type === 'tool_result')).toBe(true)
  })

  test.each(['unowned', 'not-offered', 'safe'])(
    'does not dispatch a %s tool',
    async (restriction) => {
      const { params } = await setup()
      if (restriction === 'unowned') params.agentTemplate.mcpServers = {}
      if (restriction === 'not-offered') params.tools = {}
      if (restriction === 'safe') params.fileContext.permissionMode = 'safe'
      await executeCustomToolCall(params)
      expect(params.requestToolCall).not.toHaveBeenCalled()
    },
  )

  test('an offered MCP truncation stays on the three-strike payload ladder', async () => {
    const { params } = await setup()
    const messages: Message[] = []
    const available = Object.keys(params.tools)
    handleStreamErrorChunk({
      chunk: {
        type: 'error',
        errorClass: 'native-incomplete',
        toolName: NAME,
        message:
          'Incomplete arguments for tool scholars-search__search_papers.',
      },
      errorMessages: messages,
      loggerWarn: () => {},
      agentTemplate: params.agentTemplate,
      availableToolNames: available,
      runId: 'test',
    })
    expect(JSON.stringify(messages)).not.toContain(
      'not available to this agent',
    )
    expect(
      applyNativeStrikeHandling({
        currentAgentState: params.agentState,
        consecutiveNativeIncompleteSteps: 2,
        lastIncompleteToolName: NAME,
        availableToolNames: available,
      }).exhausted,
    ).toBe(false)
  })
})
