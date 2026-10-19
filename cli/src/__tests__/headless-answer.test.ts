import { createGroundingStager } from '@savant-code/agent-runtime/tools/stream-parser/grounding-stager'
import { getLastAssistantTurnMessages } from '@savant-code/agent-runtime/util/agent-output'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import { describe, expect, test } from 'bun:test'

import { extractFinalAnswer } from '../headless-answer'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { AgentOutput } from '@savant-code/common/types/session-state'
import type { RunState } from '@savant-code/sdk'

function runWith(output: AgentOutput): RunState {
  return { output, traceSessionId: 'fanout-answer-test' }
}

describe('FID-2026-1019-002: complete headless assistant turns', () => {
  test('returns the complete real stager output instead of its final punctuation', () => {
    const state = getInitialAgentState()
    state.parentId = 'parent'
    const messages: Message[] = []
    const stager = createGroundingStager({
      agentState: state,
      fullResponse: '',
      assistantMessages: messages,
      onResponseChunk: () => {},
      ancestorRunIds: [],
      runId: 'fragmented-answer',
    })
    for (const chunk of [
      'FANOUT-A passed; ',
      'FANOUT-B passed; ',
      'FANOUT-C passed',
      '.',
    ]) {
      stager.emitGroundedText(chunk)
    }
    stager.flushGroundingOutput()
    expect(messages.length).toBeGreaterThan(1)
    expect(
      extractFinalAnswer(runWith({ type: 'lastMessage', value: messages })),
    ).toBe('FANOUT-A passed; FANOUT-B passed; FANOUT-C passed.')
  })

  test('allMessages excludes prior tool turns, native reasoning and internal text', () => {
    const messages: Message[] = [
      userMessage('Investigate'),
      assistantMessage('Before the tool'),
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'read',
        content: [{ type: 'json', value: 'source' }],
      },
      assistantMessage({ type: 'reasoning', text: 'Private reasoning' }),
      assistantMessage('All three '),
      { ...assistantMessage('Internal'), tags: ['ECHO_COMPLIANCE'] },
      assistantMessage('reports returned.'),
    ]
    expect(
      extractFinalAnswer(runWith({ type: 'allMessages', value: messages })),
    ).toBe('All three reports returned.')
    expect(getLastAssistantTurnMessages(messages)).toHaveLength(3)
  })

  test('preserves a later user boundary and structured summaries', () => {
    expect(
      extractFinalAnswer(
        runWith({
          type: 'allMessages',
          value: [
            assistantMessage('Old'),
            userMessage('New'),
            assistantMessage('New '),
            assistantMessage('answer'),
          ],
        }),
      ),
    ).toBe('New answer')
    expect(
      extractFinalAnswer(
        runWith({
          type: 'structuredOutput',
          value: { summary: 'Complete summary' },
        }),
      ),
    ).toBe('Complete summary')
  })
})
