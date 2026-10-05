// Sdk-event-handlers test family — FID-2026-1005-001 final-result
// reconciliation pins (split from sdk-event-handlers-results.test.ts to hold
// the 300-line ceiling). Sibling of the Loop-347 decomposition (shared
// fixtures in ./sdk-event-handlers-test-harness).

import {
  createEventHandler,
  createTestContext,
  describe,
  expect,
  test,
} from './sdk-event-handlers-test-harness'

import type { ToolResultEvent } from './sdk-event-handlers-test-harness'
import type { AgentContentBlock } from '../../types/chat'

/** Seed one running agent block with the given streamed text blocks. */
function seedStreamingAgent(
  ctx: ReturnType<typeof createTestContext>['ctx'],
  opts: {
    agentId?: string
    agentName?: string
    agentType?: string
    initialPrompt?: string
    streamed: Array<{ content: string }>
  },
): void {
  ctx.message.updater.updateAiMessageBlocks(() => [
    {
      type: 'agent',
      agentId: opts.agentId ?? 'tool-1-0',
      agentName: opts.agentName ?? 'Agent',
      agentType: opts.agentType ?? 'adversary',
      content: '',
      status: 'running',
      blocks: opts.streamed.map((s) => ({
        type: 'text' as const,
        content: s.content,
        textType: 'text' as const,
      })),
      initialPrompt: opts.initialPrompt ?? '',
      spawnToolCallId: 'tool-1',
      spawnIndex: 0,
    } as any,
  ])
  ctx.streaming.setStreamingAgents(
    () => new Set([opts.agentId ?? 'tool-1-0']),
  )
}

/** The spawn_agents tool_result event for one lastMessage-mode child. */
function spawnResultEvent(finalText: string): ToolResultEvent {
  return {
    type: 'tool_result',
    toolCallId: 'tool-1',
    toolName: 'spawn_agents',
    output: [
      {
        type: 'json',
        value: [
          {
            agentName: 'child',
            value: {
              type: 'lastMessage',
              value: [
                {
                  role: 'assistant',
                  content: [{ type: 'text', text: finalText }],
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

describe('FID-2026-1005-001: spawn final-result reconciliation', () => {
  test('a partial stream with a longer final result appends the missing suffix', () => {
    // The FID's decisive case: the stream cut mid-verdict, the final result
    // is complete. The displayed text must equal the final result byte for
    // byte — the unique markers prove nothing was sliced.
    const { ctx, getMessages, getStreamingAgents } = createTestContext()
    const PREFIX = 'VERDICT-PREFIX: findings so far'
    const SUFFIX = ' || SUFFIX-MARKER: end of complete verdict'
    seedStreamingAgent(ctx, { streamed: [{ content: PREFIX }] })

    const handleEvent = createEventHandler(ctx)
    handleEvent(spawnResultEvent(PREFIX + SUFFIX))

    const agentBlock = (getMessages()[0].blocks ?? [])[0] as AgentContentBlock
    expect(agentBlock.status).toBe('complete')
    const textBlocks = (agentBlock.blocks ?? []).filter(
      (b): b is { type: 'text'; content: string } => b.type === 'text',
    )
    expect(textBlocks.map((b) => b.content).join('')).toBe(PREFIX + SUFFIX)
    expect(getStreamingAgents().size).toBe(0)
  })

  test('divergent final text is shown alongside the preview, not dropped', () => {
    const { ctx, getMessages } = createTestContext()
    seedStreamingAgent(ctx, {
      agentName: 'Thinker',
      agentType: 'thinker',
      streamed: [{ content: 'Streamed preview' }],
    })

    const handleEvent = createEventHandler(ctx)
    handleEvent(spawnResultEvent('Authoritative final verdict'))

    const agentBlock = (getMessages()[0].blocks ?? [])[0] as AgentContentBlock
    const textBlocks = (agentBlock.blocks ?? []).filter(
      (b): b is { type: 'text'; content: string } => b.type === 'text',
    )
    expect(textBlocks).toHaveLength(2)
    expect(textBlocks[0]?.content).toBe('Streamed preview')
    expect(textBlocks[1]?.content).toBe('Authoritative final verdict')
  })

  test('a stream that already equals the final result stays unduplicated', () => {
    // Degenerate prefix case (stream === final): the byte-equal branch keeps
    // exactly one block.
    const { ctx, getMessages } = createTestContext()
    seedStreamingAgent(ctx, {
      agentName: 'Basher',
      agentType: 'basher',
      streamed: [{ content: 'Complete streamed output' }],
    })

    const handleEvent = createEventHandler(ctx)
    handleEvent(spawnResultEvent('Complete streamed output'))

    const agentBlock = (getMessages()[0].blocks ?? [])[0] as AgentContentBlock
    const textBlocks = (agentBlock.blocks ?? []).filter(
      (b): b is { type: 'text'; content: string } => b.type === 'text',
    )
    expect(textBlocks).toHaveLength(1)
    expect(textBlocks[0]?.content).toBe('Complete streamed output')
  })
})
