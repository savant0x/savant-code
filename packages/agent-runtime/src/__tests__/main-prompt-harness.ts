import * as analytics from '@savant-code/common/analytics'
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import {
  createTestAgentRuntimeParams,
  emptyMcpServers,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import { promptSuccess } from '@savant-code/common/util/error'
import { mock, spyOn } from 'bun:test'

import * as processFileBlockModule from '../process-file-block'

import type { mainPrompt } from '../main-prompt'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type {
  RequestFilesFn,
  RequestOptionalFileFn,
  RequestToolCallFn,
} from '@savant-code/common/types/contracts/client'
import type {
  PromptAiSdkStreamFn,
  StreamChunk,
} from '@savant-code/common/types/contracts/llm'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { ProjectFileContext } from '@savant-code/common/util/file'

// FID-2026-0819-005 Loop 290: shared harness extracted verbatim from
// main-prompt.test.ts so the suite can split under the 300-line ceiling.
// Bodies are verbatim moves; the only new text is the function wrapper and
// the parameterization of mockAgentStream (which previously mutated a
// module-level variable).

export type MainPromptBaseParams = Omit<
  Parameters<typeof mainPrompt>[0],
  'action'
>

export const makeMockAgentStream =
  (params: MainPromptBaseParams) => (chunks: StreamChunk[]) => {
    const stream: PromptAiSdkStreamFn = async function* () {
      for (const chunk of chunks) {
        yield chunk
      }
      return promptSuccess('mock-message-id')
    }
    params.promptAiSdkStream = stream
  }

export const setupMainPromptTest = (): {
  mainPromptBaseParams: MainPromptBaseParams
  mockLocalAgentTemplates: Record<string, AgentTemplate>
} => {
  // Setup common mock agent templates
  const mockLocalAgentTemplates: Record<string, AgentTemplate> = {
    savant: {
      id: 'savant',
      displayName: 'Savant',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'gpt-4o-mini',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: emptyMcpServers,
      toolNames: [
        'glob',
        'list_directory',
        'read_files',
        'read_subtree',
        'write_file',
        'end_turn',
      ],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    } satisfies AgentTemplate,
    scout: {
      id: 'scout',
      displayName: 'Savant the Scout',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'gpt-4o-mini',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: emptyMcpServers,
      toolNames: ['glob', 'list_directory', 'read_files', 'read_subtree'],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    } satisfies AgentTemplate,
    thinker: {
      id: 'thinker',
      displayName: 'Savant the Thinker',
      outputMode: 'last_message',
      inputSchema: {},
      spawnerPrompt: '',
      model: 'gpt-4o',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      mcpServers: emptyMcpServers,
      toolNames: ['sequentialthinking'],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
    } satisfies AgentTemplate,
  }
  const mainPromptBaseParams: MainPromptBaseParams = {
    ...createTestAgentRuntimeParams(),
    repoId: undefined,
    repoUrl: undefined,
    userId: TEST_USER_ID,
    clientSessionId: 'test-session',
    onResponseChunk: () => {},
    localAgentTemplates: mockLocalAgentTemplates,
    signal: new AbortController().signal,
    // Mock fetch to return a token count response
    fetch: Object.assign(
      async () =>
        ({
          ok: true,
          text: async () => JSON.stringify({ inputTokens: 1000 }),
        }) as Response,
      { preconnect: async () => {} },
    ),
  }
  // Mock analytics
  spyOn(analytics, 'trackEvent').mockImplementation(() => {})
  // Mock processFileBlock
  spyOn(processFileBlockModule, 'processFileBlock').mockImplementation(
    async (params) => {
      return promptSuccess({
        tool: 'write_file' as const,
        path: params.path,
        content: params.newContent,
        patch: undefined,
        messages: [],
      })
    },
  )
  // Mock LLM APIs
  makeMockAgentStream(mainPromptBaseParams)([
    { type: 'text', text: 'Test response' },
  ])
  // Mock websocket actions
  mainPromptBaseParams.requestFiles = async ({
    filePaths,
  }: ParamsOf<RequestFilesFn>) => {
    const results: Record<string, string | null> = {}
    filePaths.forEach((p) => {
      if (p === 'test.txt') {
        results[p] = 'mock content for test.txt'
      } else {
        results[p] = null
      }
    })
    return results
  }
  mainPromptBaseParams.requestOptionalFile = async ({
    filePath,
  }: ParamsOf<RequestOptionalFileFn>) => {
    if (filePath === 'test.txt') {
      return 'mock content for test.txt'
    }
    return null
  }
  mainPromptBaseParams.requestToolCall = mock(
    async ({
      toolName,
      input,
    }: ParamsOf<RequestToolCallFn>): ReturnType<RequestToolCallFn> => ({
      output: [
        {
          type: 'json',
          value: `Tool call success: ${{ toolName, input }}`,
        },
      ],
    }),
  )
  return { mainPromptBaseParams, mockLocalAgentTemplates }
}

export const mockFileContext: ProjectFileContext = {
  projectRoot: '/test',
  cwd: '/test',
  fileTree: [],
  fileTokenScores: {},
  knowledgeFiles: {},
  gitChanges: {
    status: '',
    diff: '',
    diffCached: '',
    lastCommitMessages: '',
  },
  changesSinceLastChat: {},
  shellConfigFiles: {},
  agentTemplates: {},
  customToolDefinitions: {},
  systemInfo: {
    platform: 'test',
    shell: 'test',
    nodeVersion: 'test',
    arch: 'test',
    homedir: '/home/test',
    cpus: 1,
    chromeAvailable: false,
  },
}
