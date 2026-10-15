// FID-2026-1012-017 Loop 6: one native-failure steering message per (tool,
// class) per stream.
//
// RED-first pins for the measured defect: one response emitted 20 invalid
// tool-call parts (17 of them the same `suggest_followups` call) in 5.7 seconds
// on 2026-10-13T05:08Z, and every part pushed its own TOOL_CALL_ERROR message
// into the step's history. The class, the tool name and the strike ladder are
// unchanged by the dedupe — only the repetition of the steering is.
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { describe, expect, it } from 'bun:test'

import { handleStreamErrorChunk } from '../error-chunk'
import {
  createNativeFailureDeduper,
  nativeFailureKey,
} from '../native-failure-capture'

import type { AgentTemplate } from '../../../templates/types'
import type { StreamErrorChunk } from '@savant-code/common/types/contracts/llm'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

const template: AgentTemplate = {
  id: 'test-agent',
  displayName: 'Test Agent',
  spawnerPrompt: 'Test agent',
  model: 'claude-3-5-sonnet-20241022',
  inputSchema: {},
  outputMode: 'structured_output',
  includeMessageHistory: true,
  inheritParentSystemPrompt: false,
  mcpServers: emptyMcpServers,
  toolNames: ['suggest_followups', 'read_files'],
  spawnableAgents: [],
  systemPrompt: 'Test system prompt',
  instructionsPrompt: 'Test instructions',
  stepPrompt: 'Test step prompt',
}

function nativeIncomplete(toolName: string): StreamErrorChunk {
  return {
    type: 'error',
    message: `Incomplete arguments for tool ${toolName}: the provider rejected the call's arguments.`,
    errorClass: 'native-incomplete',
    toolName,
  }
}

function handle(
  chunk: StreamErrorChunk,
  isDuplicate?: boolean,
): {
  errorMessages: Message[]
  outcome: ReturnType<typeof handleStreamErrorChunk>
} {
  const errorMessages: Message[] = []
  const outcome = handleStreamErrorChunk({
    chunk,
    errorMessages,
    loggerWarn: () => {},
    agentTemplate: template,
    runId: 'run-1',
    ...(isDuplicate === undefined ? {} : { isDuplicate }),
  })
  return { errorMessages, outcome }
}

describe('native-failure report identity (FID-2026-1012-017 Loop 6)', () => {
  it('names a report by tool plus class, and nothing else', () => {
    expect(nativeFailureKey(nativeIncomplete('suggest_followups'))).toBe(
      'suggest_followups|native-incomplete',
    )
    expect(
      nativeFailureKey({
        type: 'error',
        message: 'Tool x is not available to this agent.',
        errorClass: 'tool-unavailable',
        toolName: 'suggest_followups',
      }),
    ).toBe('suggest_followups|tool-unavailable')
    // A plain error chunk carries no class, so it is never a repeat report.
    expect(
      nativeFailureKey({ type: 'error', message: 'transport failed' }),
    ).toBeUndefined()
  })

  it('reports the first sighting and every repeat of the same call-out', () => {
    const isDuplicate = createNativeFailureDeduper()
    expect(isDuplicate(nativeIncomplete('suggest_followups'))).toBe(false)
    expect(isDuplicate(nativeIncomplete('suggest_followups'))).toBe(true)
    expect(isDuplicate(nativeIncomplete('suggest_followups'))).toBe(true)
    // A different tool in the same response is a different failure.
    expect(isDuplicate(nativeIncomplete('read_files'))).toBe(false)
  })

  it('keeps two classes for one tool apart, and never collapses unclassed chunks', () => {
    const isDuplicate = createNativeFailureDeduper()
    expect(isDuplicate(nativeIncomplete('suggest_followups'))).toBe(false)
    expect(
      isDuplicate({
        type: 'error',
        message: 'Tool suggest_followups is not available to this agent.',
        errorClass: 'tool-unavailable',
        toolName: 'suggest_followups',
      }),
    ).toBe(false)
    const plain: StreamErrorChunk = { type: 'error', message: 'transport' }
    expect(isDuplicate(plain)).toBe(false)
    expect(isDuplicate(plain)).toBe(false)
  })
})

describe('duplicate invalid parts steer once (FID-2026-1012-017 Loop 6)', () => {
  it('pushes the steering message for the first part', () => {
    const { errorMessages, outcome } = handle(
      nativeIncomplete('suggest_followups'),
    )
    expect(errorMessages).toHaveLength(1)
    expect(outcome.hasNativeIncompleteToolCall).toBe(true)
    expect(outcome.lastIncompleteToolName).toBe('suggest_followups')
  })

  it('does not push a second message for a repeated part of the same call-out', () => {
    const { errorMessages, outcome } = handle(
      nativeIncomplete('suggest_followups'),
      true,
    )
    expect(errorMessages).toHaveLength(0)
    // The report itself is unchanged: the step is still a native-incomplete
    // step, so the strike ladder and the exhaustion message behave as before.
    expect(outcome.hasNativeIncompleteToolCall).toBe(true)
    expect(outcome.lastIncompleteToolName).toBe('suggest_followups')
    // And so is the capture — the ledger keeps one row per part; shrinking its
    // volume is a capture-policy decision that belongs to the capture lane.
    expect(outcome.captureChunk).toBeDefined()
  })
})
