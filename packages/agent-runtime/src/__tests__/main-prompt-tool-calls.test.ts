import path from 'path'

import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import {
  makeMockAgentStream,
  mockFileContext,
  setupMainPromptTest,
  type MainPromptBaseParams,
} from './main-prompt-harness'
import { mainPrompt } from '../main-prompt'
import { createToolCallChunk } from './test-utils'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { StreamChunk } from '@savant-code/common/types/contracts/llm'

describe('mainPrompt', () => {
  let mainPromptBaseParams: MainPromptBaseParams

  const mockAgentStream = (chunks: StreamChunk[]) => {
    makeMockAgentStream(mainPromptBaseParams)(chunks)
  }

  beforeEach(() => {
    mainPromptBaseParams = setupMainPromptTest().mainPromptBaseParams
  })
  afterEach(() => {
    // Clear all mocks after each test
    mock.restore()
  })
  it('should handle write_file tool call', async () => {
    // Mock LLM to return a write_file tool call using native tool call chunks
    mockAgentStream([
      createToolCallChunk('write_file', {
        path: 'new-file.txt',
        instructions: 'Added Hello World',
        content: 'Hello, world!',
      }),
      createToolCallChunk('end_turn', {}),
    ])
    // Get reference to the spy so we can check if it was called
    const requestToolCallSpy = mainPromptBaseParams.requestToolCall
    const sessionState = getInitialSessionState(mockFileContext)
    sessionState.mainAgentState.fsmPhase = 'green'
    const action = {
      type: 'prompt' as const,
      prompt: 'Write hello world to new-file.txt',
      sessionState,
      fingerprintId: 'test',
      promptId: 'test',
      toolResults: [],
    }
    await mainPrompt({
      ...mainPromptBaseParams,
      action,
      localAgentTemplates: {
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
        },
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
        },
      },
    })
    // Assert that requestToolCall was called exactly once
    expect(requestToolCallSpy).toHaveBeenCalledTimes(1)
    // Verify the write_file call was made with the correct arguments
    expect(requestToolCallSpy).toHaveBeenCalledWith({
      userInputId: expect.any(String), // userInputId
      toolName: 'write_file',
      input: expect.objectContaining({
        type: 'file',
        path: path.resolve(mockFileContext.projectRoot, 'new-file.txt'),
        content: 'Hello, world!',
      }),
    })
  })
})
