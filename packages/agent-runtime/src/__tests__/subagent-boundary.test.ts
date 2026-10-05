// FID-2026-1005-001 — runtime boundary probe for the spawn_agents batch
// report seam. Split from subagent-streaming.test.ts to respect the 300-line
// quality ceiling; the streaming lifecycle legs remain in the sibling file.
import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { assistantMessage } from '@savant-code/common/util/messages'
import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'

import * as runAgentStep from '../run-agent-step'
import { mockFileContext } from './test-utils'
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'

import type { AgentTemplate } from '../templates/types'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'

describe('Subagent Batch Boundary (FID-2026-1005-001)', () => {
  const mockSendSubagentChunk = mock(() => {})
  const mockWriteToClient = mock(() => {})

  let mockAgentTemplate: AgentTemplate
  let handleSpawnAgentsBaseParams: ParamsExcluding<
    typeof handleSpawnAgents,
    'agentState' | 'agentTemplate' | 'localAgentTemplates' | 'toolCall'
  >

  beforeEach(() => {
    mockAgentTemplate = {
      id: 'thinker',
      displayName: 'Thinker',
      outputMode: 'last_message',
      inputSchema: {
        prompt: {
          safeParse: () => ({ success: true }),
        } as unknown as AgentTemplate['inputSchema']['prompt'],
      },
      spawnerPrompt: '',
      model: '',
      includeMessageHistory: true,
      inheritParentSystemPrompt: false,
      toolNames: [],
      spawnableAgents: [],
      systemPrompt: '',
      instructionsPrompt: '',
      stepPrompt: '',
      mcpServers: emptyMcpServers,
    }

    handleSpawnAgentsBaseParams = {
      ...TEST_AGENT_RUNTIME_IMPL,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      previousToolCallFinished: Promise.resolve(),
      repoId: undefined,
      repoUrl: undefined,
      sendSubagentChunk: mockSendSubagentChunk,
      signal: new AbortController().signal,
      system: 'Test system prompt',
      tools: {},
      userId: TEST_USER_ID,
      userInputId: 'test-input',
      writeToClient: mockWriteToClient,
    }
  })

  afterAll(() => {
    mock.restore()
  })

  // The batch-relay boundary probe. A long, marker-delimited last_message
  // result must reach the handler's tool output with byte-identical selected
  // text: no slice at the report seam, no loss at jsonToolResult, no
  // conflation of the selected turn with the private history. If this leg
  // ever fails, the loss is in the runtime relay; the CLI display tests pin
  // the rendering half independently.
  it('relays a long marker-delimited last_message result byte-identically through the batch report', async () => {
    const PREFIX = 'FID-1005-001-BOUNDARY-PREFIX:: '
    const BODY =
      'A long adversarial verdict that spans many sentences to defeat any ' +
      'accidental preview-window slicing. '.repeat(12)
    const SUFFIX = ' ::FID-1005-001-BOUNDARY-SUFFIX'
    const finalText = PREFIX + BODY + SUFFIX

    spyOn(runAgentStep, 'loopAgentSteps').mockImplementation(
      async (options) => {
        if (options.onResponseChunk) {
          options.onResponseChunk(finalText.slice(0, 40))
        }
        return {
          agentState: {
            ...options.agentState,
            messageHistory: [
              assistantMessage('internal scratch turn that must not leak'),
              assistantMessage(finalText),
            ],
          },
          output: {
            type: 'lastMessage',
            value: [assistantMessage(finalText)],
          },
        }
      },
    )

    const sessionState = getInitialSessionState(mockFileContext)
    const parentTemplate = {
      id: 'base',
      spawnableAgents: ['thinker'],
    } as unknown as AgentTemplate
    const toolCall: SavantCodeToolCall<'spawn_agents'> = {
      toolName: 'spawn_agents' as const,
      toolCallId: 'boundary-tool-call',
      input: { agents: [{ agent_type: 'thinker', prompt: 'Deliver a verdict' }] },
    }

    const { output } = await handleSpawnAgents({
      ...handleSpawnAgentsBaseParams,
      agentState: sessionState.mainAgentState,
      agentTemplate: parentTemplate,
      localAgentTemplates: { [mockAgentTemplate.id]: mockAgentTemplate },
      toolCall,
    })

    const firstOutput = output[0]
    expect(firstOutput?.type).toBe('json')
    const report = (firstOutput as { type: 'json'; value: unknown }).value
    expect(Array.isArray(report)).toBe(true)
    const childReport = (
      report as Array<{ agentType: string; value: unknown }>
    )[0]
    expect(childReport.agentType).toBe('thinker')

    // Byte equality at the batch boundary — the selected output text the
    // parent receives equals the child's selected final turn exactly.
    const value = childReport.value as {
      type: string
      value: Array<{
        role: string
        content: Array<{ type: string; text?: string }>
      }>
    }
    expect(value.type).toBe('lastMessage')
    const selectedText = value.value
      .filter((m) => m.role === 'assistant')
      .flatMap((m) => m.content)
      .filter((p) => p.type === 'text')
      .map((p) => p.text ?? '')
      .join('')
    expect(selectedText).toBe(finalText)
    expect(selectedText.startsWith(PREFIX)).toBe(true)
    expect(selectedText.endsWith(SUFFIX)).toBe(true)
    // The selected turn is the last contiguous assistant turn — the private
    // scratch turn must not ride along in the selected payload.
    expect(selectedText).not.toContain('internal scratch turn')
  })
})
