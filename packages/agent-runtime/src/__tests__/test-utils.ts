import { promptSuccess } from '@codebuff/common/util/error'
import { generateCompactId } from '@codebuff/common/util/string'

import type { StreamChunk } from '@codebuff/common/types/contracts/llm'
import type { PromptResult } from '@codebuff/common/util/error'
import type { ProjectFileContext } from '@codebuff/common/util/file'

/**
 * Creates a native tool call stream chunk for testing.
 * This replaces the old getToolCallString() approach which generated XML format.
 */
export function createToolCallChunk<T extends string>(
  toolName: T,
  input: Record<string, unknown>,
  toolCallId?: string,
): StreamChunk {
  return {
    type: 'tool-call',
    toolName,
    toolCallId: toolCallId ?? generateCompactId(),
    input,
  }
}

/**
 * Creates a mock stream that yields native tool call chunks.
 * Use this instead of streams that yield text with XML tool calls.
 */
export function createMockStreamWithToolCalls(
  chunks: (string | { toolName: string; input: Record<string, unknown> })[],
): AsyncGenerator<StreamChunk, PromptResult<string | null>> {
  async function* generator(): AsyncGenerator<
    StreamChunk,
    PromptResult<string | null>
  > {
    for (const chunk of chunks) {
      if (typeof chunk === 'string') {
        yield { type: 'text' as const, text: chunk }
      } else {
        yield createToolCallChunk(chunk.toolName, chunk.input)
      }
    }
    return promptSuccess('mock-message-id')
  }
  return generator()
}

/**
 * Mock researcher agent template for tests that exercise read_docs / web_search.
 * Replaces the old import from agents-graveyard/researcher/researcher.
 */
export const mockResearcherAgent = {
  id: 'researcher',
  model: 'anthropic/claude-opus-4.8',
  displayName: 'Test Researcher',
  toolNames: ['read_docs', 'web_search', 'read_url', 'end_turn'],
  spawnableAgents: [],
  includeMessageHistory: false,
  inheritParentSystemPrompt: false,
  outputMode: 'last_message' as const,
  systemPrompt: 'You are a test researcher agent.',
  instructionsPrompt: 'Provide research on the user prompt.',
  spawnerPrompt: 'Research agent for testing.',
  inputSchema: {
    prompt: { type: 'string', description: 'Research question' },
  },
}

export const mockFileContext: ProjectFileContext = {
  projectRoot: '/test',
  cwd: '/test',
  fileTree: [],
  fileTokenScores: {},
  knowledgeFiles: {},
  userKnowledgeFiles: {},
  agentTemplates: {},
  customToolDefinitions: {},
  gitChanges: {
    status: '',
    diff: '',
    diffCached: '',
    lastCommitMessages: '',
  },
  changesSinceLastChat: {},
  shellConfigFiles: {},
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
