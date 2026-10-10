import { getInitialSessionState } from '@savant-code/common/types/session-state'
import {
  assistantMessage,
  userMessage,
} from '@savant-code/common/util/messages'
import { describe, expect, test } from 'bun:test'

import { mockFileContext, mockResearcherAgent } from './test-utils'
import { extractVerdictText } from '../provenance/verdict'
import { createGroundingStager } from '../tools/stream-parser/grounding-stager'
import { getAgentOutput } from '../util/agent-output'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'

describe('FID-2026-1010-002: raw audit verdict transport', () => {
  test('real stager fragments yield the complete raw selected turn without sanitization or native reasoning', () => {
    const state = getInitialSessionState(mockFileContext).mainAgentState
    state.parentId = 'orchestrator'
    const messages: Message[] = []
    const streamed: string[] = []
    const stager = createGroundingStager({
      agentState: state,
      fullResponse: '',
      assistantMessages: messages,
      onResponseChunk: (chunk) => {
        if (typeof chunk === 'string') streamed.push(chunk)
      },
      ancestorRunIds: ['parent'],
      runId: 'audit',
    })
    const raw =
      '<think>Audit notes</think>\nFAIL art/icons/cyberpunk/logo-sidebar-s.svg:15 — ▄▀ ξ 🙂\n\nNEEDS-REVIEW render'
    for (const text of raw.split('')) stager.emitGroundedText(text)
    stager.flushGroundingOutput()
    state.messageHistory = [
      assistantMessage('Previous verdict'),
      userMessage('Review new evidence'),
      assistantMessage({ type: 'reasoning', text: 'Native thoughts' }),
      ...messages,
    ]
    const snapshot = JSON.stringify(state.messageHistory)
    expect(streamed.join('')).toBe(raw)
    expect(messages.length).toBeGreaterThan(1)
    const output = getAgentOutput(state, mockResearcherAgent)
    expect(output.type).toBe('lastMessage')
    if (output.type !== 'lastMessage')
      throw new Error('Missing last assistant turn')
    const text = output.value
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.content)
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('')
    expect(text).toBe(raw)
    expect(extractVerdictText(state)).toBe(raw)
    expect(JSON.stringify(state.messageHistory)).toBe(snapshot)
  })

  test('multiple text parts, prior retry boundaries and excluded output tags use the existing selection policy', () => {
    const state = getInitialSessionState(mockFileContext).mainAgentState
    state.messageHistory = [
      assistantMessage('Old FAIL'),
      { ...userMessage('Tool failed'), tags: ['TOOL_CALL_ERROR'] },
      assistantMessage([
        { type: 'text', text: 'FAIL logo-' },
        { type: 'reasoning', text: 'Native notes' },
        { type: 'text', text: 'sidebar-s.svg:15' },
      ]),
      { ...assistantMessage('Do not include'), tags: ['ECHO_COMPLIANCE'] },
      assistantMessage(' — wrong rect'),
    ]
    expect(extractVerdictText(state)).toBe(
      'FAIL logo-sidebar-s.svg:15 — wrong rect',
    )
    state.messageHistory = [userMessage('No verdict yet')]
    expect(extractVerdictText(state)).toBe('')
  })
})
