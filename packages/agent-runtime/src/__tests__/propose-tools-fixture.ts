import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import { spyOn } from 'bun:test'

import { generateSimpleDiff } from './simple-diff'
import { mockFileContext } from './test-utils'
import * as toolExecutor from '../tools/tool-executor'

import type { runProgrammaticStep } from '../run-programmatic-step'
import type { AgentTemplate } from '../templates/types'
import type { executeToolCall } from '../tools/tool-executor'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsOf } from '@savant-code/common/types/function-params'
import type { ToolMessage } from '@savant-code/common/types/messages/savant-code-message'
import type { AgentState } from '@savant-code/common/types/session-state'

export const logger: Logger = {
  debug: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
}

export type ProposeToolsFixture = {
  mockFiles: Record<string, string>
  agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps
  executeToolCallSpy: ReturnType<
    typeof spyOn<typeof toolExecutor, 'executeToolCall'>
  >
  mockTemplate: AgentTemplate
  mockAgentState: AgentState
  mockParams: ParamsOf<typeof runProgrammaticStep>
}

/**
 * Builds a fresh propose_* tool test fixture. Called from each part's
 * beforeEach so every test gets isolated mocks, spies, and file state.
 */
export function createProposeToolsFixture(): ProposeToolsFixture {
  // Mock file system - maps file paths to their contents
  const mockFiles: Record<string, string> = {}

  // Reset mock file system
  mockFiles['src/utils.ts'] =
    `export function add(a: number, b: number): number {\n  return a + b;\n}\n\nexport function subtract(a: number, b: number): number {\n  return a - b;\n}\n`
  mockFiles['src/index.ts'] =
    `import { add } from './utils';\nconsole.log(add(1, 2));\n`

  const agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps = {
    ...TEST_AGENT_RUNTIME_IMPL,
    addAgentStep: async () => 'test-agent-step-id',
    sendAction: () => {},
  }

  // Mock executeToolCall to handle propose_* tools
  const executeToolCallSpy = spyOn(
    toolExecutor,
    'executeToolCall',
  ).mockImplementation(async (options: ParamsOf<typeof executeToolCall>) => {
    const { toolName, input, toolResults, agentState } = options

    if (toolName === 'propose_str_replace') {
      const { path, replacements } = input as {
        path: string
        replacements: Array<{
          oldString: string
          newString: string
          allowMultiple: boolean
        }>
      }

      // Get current content (from proposed state or mock files)
      let content = mockFiles[path] ?? null

      if (content === null) {
        const errorResult: ToolMessage = {
          role: 'tool',
          toolName: 'propose_str_replace',
          toolCallId: `${toolName}-call-id`,
          content: [
            {
              type: 'json',
              value: { file: path, errorMessage: `File not found: ${path}` },
            },
          ],
        }
        toolResults.push(errorResult)
        agentState.messageHistory.push(errorResult)
        return
      }

      // Apply replacements
      const errors: string[] = []
      for (const replacement of replacements) {
        if (!content.includes(replacement.oldString)) {
          errors.push(
            `String not found: "${replacement.oldString.slice(0, 50)}..."`,
          )
          continue
        }
        if (replacement.allowMultiple) {
          content = content.replaceAll(
            replacement.oldString,
            replacement.newString,
          )
        } else {
          content = content.replace(
            replacement.oldString,
            replacement.newString,
          )
        }
      }

      if (errors.length > 0) {
        const errorResult: ToolMessage = {
          role: 'tool',
          toolName: 'propose_str_replace',
          toolCallId: `${toolName}-call-id`,
          content: [
            {
              type: 'json',
              value: { file: path, errorMessage: errors.join('; ') },
            },
          ],
        }
        toolResults.push(errorResult)
        agentState.messageHistory.push(errorResult)
        return
      }

      // Generate unified diff
      const originalContent = mockFiles[path]!
      const diff = generateSimpleDiff(path, originalContent, content)

      // Store proposed content for future calls
      mockFiles[path] = content

      const successResult: ToolMessage = {
        role: 'tool',
        toolName: 'propose_str_replace',
        toolCallId: `${toolName}-call-id`,
        content: [
          {
            type: 'json',
            value: {
              file: path,
              message: 'Proposed string replacements',
              unifiedDiff: diff,
            },
          },
        ],
      }
      toolResults.push(successResult)
      agentState.messageHistory.push(successResult)
    } else if (toolName === 'propose_write_file') {
      const { path, content: newContent } = input as {
        path: string
        instructions: string
        content: string
      }

      const originalContent = mockFiles[path] ?? ''
      const isNewFile = !(path in mockFiles)

      // Generate unified diff
      const diff = generateSimpleDiff(path, originalContent, newContent)

      // Store proposed content
      mockFiles[path] = newContent

      const successResult: ToolMessage = {
        role: 'tool',
        toolName: 'propose_write_file',
        toolCallId: `${toolName}-call-id`,
        content: [
          {
            type: 'json',
            value: {
              file: path,
              message: isNewFile
                ? `Proposed new file ${path}`
                : `Proposed changes to ${path}`,
              unifiedDiff: diff,
            },
          },
        ],
      }
      toolResults.push(successResult)
      agentState.messageHistory.push(successResult)
    } else if (toolName === 'set_output') {
      agentState.output = input
      const result: ToolMessage = {
        role: 'tool',
        toolName: 'set_output',
        toolCallId: `${toolName}-call-id`,
        content: [{ type: 'json', value: 'Output set successfully' }],
      }
      toolResults.push(result)
      agentState.messageHistory.push(result)
    } else if (toolName === 'end_turn') {
      // No-op for end_turn
    }
  })

  // Mock crypto.randomUUID
  spyOn(crypto, 'randomUUID').mockImplementation(
    () =>
      'mock-uuid-0000-0000-0000-000000000000' as `${string}-${string}-${string}-${string}-${string}`,
  )

  // Create mock template for implementor agent
  const mockTemplate = {
    id: 'test-implementor',
    displayName: 'Test Implementor',
    spawnerPrompt: 'Testing propose tools',
    model: 'claude-3-5-sonnet-20241022',
    inputSchema: {},
    outputMode: 'structured_output',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: emptyMcpServers,
    toolNames: [
      'propose_str_replace',
      'propose_write_file',
      'set_output',
      'end_turn',
    ],
    spawnableAgents: [],
    systemPrompt: 'You are a code implementor that proposes changes.',
    instructionsPrompt:
      'Implement the requested changes using propose_str_replace or propose_write_file.',
    stepPrompt: '',
    handleSteps: undefined,
  } as AgentTemplate

  // Create mock agent state
  const sessionState = getInitialSessionState(mockFileContext)
  const mockAgentState = {
    ...sessionState.mainAgentState,
    agentId: 'test-implementor-id',
    runId: 'test-run-id' as `${string}-${string}-${string}-${string}-${string}`,
    messageHistory: [
      userMessage('Add a multiply function to src/utils.ts'),
      assistantMessage('I will implement the changes.'),
    ],
    output: undefined,
    directCreditsUsed: 0,
    childRunIds: [],
  }

  // Create mock params
  const mockParams: ParamsOf<typeof runProgrammaticStep> = {
    ...agentRuntimeImpl,
    runId: 'test-run-id',
    ancestorRunIds: [],
    repoId: undefined,
    repoUrl: undefined,
    agentState: mockAgentState,
    template: mockTemplate,
    prompt: 'Add a multiply function to src/utils.ts',
    toolCallParams: {},
    userId: TEST_USER_ID,
    userInputId: 'test-user-input',
    clientSessionId: 'test-session',
    fingerprintId: 'test-fingerprint',
    onResponseChunk: () => {},
    onCostCalculated: async () => {},
    fileContext: mockFileContext,
    localAgentTemplates: {},
    system: 'Test system prompt',
    stepsComplete: false,
    stepNumber: 1,
    tools: {},
    logger,
    signal: new AbortController().signal,
  }

  return {
    mockFiles,
    agentRuntimeImpl,
    executeToolCallSpy,
    mockTemplate,
    mockAgentState,
    mockParams,
  }
}

// FID-2026-0819-005 Loop 189: generateSimpleDiff extracted verbatim to ./simple-diff.ts.
export { generateSimpleDiff } from './simple-diff'
