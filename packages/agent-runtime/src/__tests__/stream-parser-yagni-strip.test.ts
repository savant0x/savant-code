import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { describe, expect, it } from 'bun:test'

import { mockFileContext } from './test-utils'
import { processStream } from '../tools/stream-parser'

import type { AgentTemplate } from '../templates/types'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { StreamChunk } from '@savant-code/common/types/contracts/llm'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { PromptResult } from '@savant-code/common/util/error'

/**
 * FID-2026-0822-004: <yagni_check> scaffolding is stripped at the ingestion
 * boundary (emitCommittedText). The block must never reach the persisted
 * message history or the live display chunks, while `fullResponse` (returned
 * to the caller for the gate's assistant-text channel) keeps the RAW text so
 * the YAGNI gate can still parse the block at beforeToolCall time.
 */
describe('stream parser yagni ingestion strip (FID-2026-0822-004)', () => {
  const agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps = {
    ...TEST_AGENT_RUNTIME_IMPL,
    sendAction: () => {},
  }

  const testAgentTemplate: AgentTemplate = {
    id: 'test-agent',
    displayName: 'Test Agent',
    spawnerPrompt: 'Test agent',
    model: 'claude-3-5-sonnet-20241022',
    inputSchema: {},
    outputMode: 'structured_output',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: emptyMcpServers,
    toolNames: ['read_files', 'end_turn'],
    spawnableAgents: [],
    systemPrompt: 'Test system prompt',
    instructionsPrompt: 'Test instructions',
    stepPrompt: 'Test step prompt',
  }

  const YAGNI_BLOCK = `<yagni_check>
{"isSpeculative":false,"reusedEntities":["buildArray"]}
</yagni_check>`

  async function runStream(
    stream: AsyncGenerator<StreamChunk, PromptResult<string | null>>,
    onResponseChunk: (chunk: string | PrintModeEvent) => void = () => {},
  ): Promise<{ history: Message[]; fullResponse: string }> {
    const abortController = new AbortController()
    const sessionState = getInitialSessionState(mockFileContext)
    const agentState = sessionState.mainAgentState

    const result = await processStream({
      ...agentRuntimeImpl,
      agentContext: {},
      agentState,
      agentStepId: 'test-step-id',
      agentTemplate: testAgentTemplate,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      fullResponse: '',
      localAgentTemplates: { 'test-agent': testAgentTemplate },
      messages: [],
      prompt: 'test prompt',
      repoId: undefined,
      repoUrl: undefined,
      runId: 'test-run-id',
      signal: abortController.signal,
      stream,
      system: 'test system',
      tools: {},
      userId: 'test-user',
      userInputId: 'test-input-id',
      onCostCalculated: async () => {},
      onResponseChunk,
    })

    return {
      history: agentState.messageHistory,
      fullResponse: result.fullResponse,
    }
  }

  function getCommittedText(history: Message[]): string {
    return history
      .filter((m) => m.role === 'assistant')
      .map((m) =>
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .filter((c) => c.type === 'text')
                .map((c) => ('text' in c ? c.text : ''))
                .join('')
            : '',
      )
      .join('')
  }

  it('strips a yagni block from history and display, keeps it in fullResponse', async () => {
    const displayChunks: string[] = []

    async function* mockStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield { type: 'text' as const, text: `${YAGNI_BLOCK}\n` }
      yield { type: 'text' as const, text: 'Here is my implementation.' }
      return { aborted: false, value: 'msg-id' }
    }

    const { history, fullResponse } = await runStream(mockStream(), (chunk) => {
      if (typeof chunk === 'string') displayChunks.push(chunk)
    })

    const committed = getCommittedText(history)
    expect(committed).toContain('Here is my implementation.')
    expect(committed).not.toContain('yagni_check')
    expect(displayChunks.join('')).not.toContain('yagni_check')
    // RAW text is kept for the gate's assistant-text channel.
    expect(fullResponse).toContain('yagni_check')
    expect(fullResponse).toContain('Here is my implementation.')
  })

  it('strips a block split across multiple stream chunks', async () => {
    const displayChunks: string[] = []

    async function* mockStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield { type: 'text' as const, text: '<yagni_check>{"isSpec' }
      yield { type: 'text' as const, text: 'ulative":false}</yagni_check>\n' }
      yield { type: 'text' as const, text: 'Done.' }
      return { aborted: false, value: 'msg-id' }
    }

    const { history, fullResponse } = await runStream(mockStream(), (chunk) => {
      if (typeof chunk === 'string') displayChunks.push(chunk)
    })

    const committed = getCommittedText(history)
    expect(committed).toContain('Done.')
    expect(committed).not.toContain('yagni_check')
    expect(committed).not.toContain('ulative')
    expect(displayChunks.join('')).not.toContain('yagni_check')
    expect(fullResponse).toContain('yagni_check')
  })

  it('preserves plain text with no yagni blocks untouched', async () => {
    async function* mockStream(): AsyncGenerator<
      StreamChunk,
      PromptResult<string | null>
    > {
      yield { type: 'text' as const, text: 'Plain narration.' }
      return { aborted: false, value: 'msg-id' }
    }

    const { history, fullResponse } = await runStream(mockStream())
    expect(getCommittedText(history)).toBe('Plain narration.')
    expect(fullResponse).toBe('Plain narration.')
  })
})
