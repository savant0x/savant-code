/**
 * FID-2026-0806-003 Phase 1 — serialization regression guard.
 *
 * The context-pruner's handleSteps is serialized via .toString() and re-eval'd
 * (FID-2026-0802-005 L5 pattern). The pure-function unit tests bypass that
 * path, so a regression like a non-exported helper or a module-level constant
 * (e.g. a regex at module scope) breaks production silently while unit tests
 * stay green. This test drives the REAL factory end-to-end.
 */
import { describe, expect, test } from 'bun:test'

import { createContextPrunerHandleSteps } from '../context-pruner/handle-steps'

import type { AgentState } from '../types/agent-definition'
import type { Logger } from '../types/util-types'

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

function buildAgentState(): AgentState {
  const now = Date.now()
  return {
    agentId: 'context-pruner',
    messageHistory: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Original request: build the auth module' },
        ],
        sentAt: now,
      },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Inspected src/auth.ts and src/tokens.ts' },
          {
            type: 'tool-call',
            toolCallId: 'tc1',
            toolName: 'read_files',
            input: { paths: ['src/auth.ts', 'src/tokens.ts'] },
          },
        ],
        sentAt: now + 1,
      },
      {
        role: 'tool',
        toolName: 'read_files',
        toolCallId: 'tc1',
        content: [{ type: 'json', value: { ok: true } }],
        sentAt: now + 2,
      },
    ],
    systemPrompt: '',
    toolDefinitions: {},
    contextTokenCount: 10_000,
  }
}

function runPruner(agentState: AgentState): {
  text: string
  messageCount: number
} {
  const handleSteps = createContextPrunerHandleSteps()
  expect(typeof handleSteps).toBe('function')

  const gen = handleSteps({
    agentState,
    params: { maxContextLength: 5_000 },
    logger: noopLogger,
  })
  const step = gen.next()
  const toolCall = step.value as unknown as {
    toolName?: string
    input?: { messages?: Array<unknown> }
  }

  expect(toolCall?.toolName).toBe('set_messages')
  const messages = toolCall?.input?.messages
  const summaryMsg = messages?.[0] as
    { content?: Array<{ type?: string; text?: string }> } | undefined
  const text = Array.isArray(summaryMsg?.content)
    ? summaryMsg.content
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('\n')
    : ''
  return { text, messageCount: messages?.length ?? 0 }
}

describe('context-pruner serialized handleSteps (P1 via toString/eval)', () => {
  test('serialized generator emits the structured-state block end-to-end', () => {
    const { text, messageCount } = runPruner(buildAgentState())

    expect(messageCount).toBeGreaterThan(0)
    expect(text).toContain('<structured_state>')
    expect(text).toContain('</structured_state>')
    expect(text).toContain('<conversation_summary>')
    expect(text).toContain('## Standing facts & constraints')
    expect(text).toContain('## Goal')
    expect(text).toContain('## Preserved state')
    expect(text).toContain('## Open TODOs (reference-only)')
  })

  test('pinned first user turn and preserved-state JSON survive the eval', () => {
    const { text } = runPruner(buildAgentState())

    expect(text).toContain('[pinned first user turn — verbatim]')
    expect(text).toContain('Original request: build the auth module')
    // Preserved-state JSON is single-line and re-parseable from the block.
    const jsonMatch = text.match(/## Preserved state\n(\{.*\})/)
    expect(jsonMatch).not.toBeNull()
    const parsed = JSON.parse(jsonMatch![1])
    expect(parsed.readFiles).toEqual(['src/auth.ts', 'src/tokens.ts'])
  })

  test('all embedded P1 helpers resolve inside the eval scope (no ReferenceError)', () => {
    // Regression for the FID_PATTERN / non-exported-helper bug: module-level
    // constants and unexported functions silently break inside the eval'd
    // scope. Driving a full prune with a rich history exercises every helper.
    const state = buildAgentState()
    state.messageHistory.push({
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Check https://example.com/docs and FID-2026-0806-003',
        },
        {
          type: 'tool-call',
          toolCallId: 'tc2',
          toolName: 'write_todos',
          input: {
            todos: [{ task: 'Implement token service', completed: false }],
          },
        },
      ],
      sentAt: Date.now() + 3,
    })
    const { text } = runPruner(state)

    expect(text).toContain('- https://example.com/docs')
    expect(text).toContain('- FID-2026-0806-003')
    expect(text).toContain('- [ ] Implement token service')
  })
})
