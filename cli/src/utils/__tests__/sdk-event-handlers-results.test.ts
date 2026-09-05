// Sdk-event-handlers test family — spawn_agents error placeholders,
// lastMessage-mode results, streamed-text dedup, and compliance receipts.
// Sibling of the Loop-347 decomposition (shared fixtures in
// ./sdk-event-handlers-test-harness).

import {
  createAgentBlock,
  createEventHandler,
  createTestContext,
  describe,
  expect,
  test,
} from './sdk-event-handlers-test-harness'

import type { ToolResultEvent } from './sdk-event-handlers-test-harness'
import type { AgentContentBlock } from '../../types/chat'

describe('sdk-event-handlers', () => {
  test('hides spawn_agents error placeholders with no user-facing output', () => {
    const { ctx, getMessages, getStreamingAgents } = createTestContext()
    ctx.message.updater.addBlock(
      createAgentBlock({
        agentId: 'tool-1-0',
        agentType: 'basher',
        spawnToolCallId: 'tool-1',
        spawnIndex: 0,
      }),
    )
    ctx.streaming.setStreamingAgents(() => new Set(['tool-1-0']))

    const handleEvent = createEventHandler(ctx)
    const toolResultEvent: ToolResultEvent = {
      type: 'tool_result',
      toolCallId: 'tool-1',
      toolName: 'spawn_agents',
      output: [
        {
          type: 'json',
          value: [
            {
              agentName: 'basher',
              value: {
                errorMessage:
                  'Error spawning agent: Invalid params for agent basher',
              },
            },
          ],
        },
      ],
    }
    handleEvent(toolResultEvent)

    expect(getMessages()[0].blocks).toEqual([])
    expect(getStreamingAgents().size).toBe(0)
  })

  test('renders spawn_agents error content when agent already streamed output', () => {
    const { ctx, getMessages, getStreamingAgents } = createTestContext()
    ctx.message.updater.updateAiMessageBlocks(() => [
      {
        type: 'agent',
        agentId: 'tool-1-0',
        agentName: 'Basher',
        agentType: 'basher',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'text',
            content: 'Checking files...',
            textType: 'text',
          },
        ],
        initialPrompt: '',
        spawnToolCallId: 'tool-1',
        spawnIndex: 0,
      } as any,
    ])
    ctx.streaming.setStreamingAgents(() => new Set(['tool-1-0']))

    const handleEvent = createEventHandler(ctx)
    const toolResultEvent: ToolResultEvent = {
      type: 'tool_result',
      toolCallId: 'tool-1',
      toolName: 'spawn_agents',
      output: [
        {
          type: 'json',
          value: [
            {
              agentName: 'basher',
              value: {
                errorMessage:
                  'Error spawning agent: Invalid params for agent basher',
              },
            },
          ],
        },
      ],
    }
    handleEvent(toolResultEvent)

    const agentBlock = (getMessages()[0].blocks ?? [])[0] as AgentContentBlock
    expect(agentBlock.status).toBe('complete')
    expect(agentBlock.blocks).toHaveLength(2)
    expect(agentBlock.blocks?.[0]).toMatchObject({
      type: 'text',
      content: 'Checking files...',
    })
    expect(agentBlock.blocks?.[1]).toMatchObject({
      type: 'text',
      content: 'Error spawning agent: Invalid params for agent basher',
    })
    expect(getStreamingAgents().size).toBe(0)
  })

  test('handles spawn_agents tool results for agents with tool blocks (lastMessage mode)', () => {
    const { ctx, getMessages, getStreamingAgents } = createTestContext()

    // Create an agent block with an existing tool block (simulating thinker agent's read_files)
    ctx.message.updater.updateAiMessageBlocks(() => [
      {
        type: 'agent',
        agentId: 'tool-1-0',
        agentName: 'Thinker',
        agentType: 'thinker-with-files-gemini',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'tool',
            toolCallId: 'read-1',
            toolName: 'read_files',
            input: { paths: ['package.json'] },
            output: 'package contents',
          },
        ],
        initialPrompt: 'Think about this',
        spawnToolCallId: 'tool-1',
        spawnIndex: 0,
      } as any,
    ])
    ctx.streaming.setStreamingAgents(() => new Set(['tool-1-0']))

    const handleEvent = createEventHandler(ctx)
    const toolResultEvent: ToolResultEvent = {
      type: 'tool_result',
      toolCallId: 'tool-1',
      toolName: 'spawn_agents',
      output: [
        {
          type: 'json',
          value: [
            {
              agentName: 'thinker-with-files-gemini',
              value: {
                type: 'lastMessage',
                value: [
                  {
                    role: 'assistant',
                    content: [
                      { type: 'text', text: 'Here is the analysis result.' },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    }
    handleEvent(toolResultEvent)

    const agentBlock = (getMessages()[0].blocks ?? [])[0] as AgentContentBlock
    expect(agentBlock.status).toBe('complete')
    // Should have the tool block AND the final text content
    expect(agentBlock.blocks).toHaveLength(2)
    expect(agentBlock.blocks?.[0]).toMatchObject({
      type: 'tool',
      toolName: 'read_files',
    })
    expect(agentBlock.blocks?.[1]).toMatchObject({
      type: 'text',
      content: 'Here is the analysis result.',
    })
    expect(getStreamingAgents().size).toBe(0)
  })

  test('renders a compliance_warning as a muted transcript receipt', () => {
    const { ctx, getMessages } = createTestContext()
    const handleEvent = createEventHandler(ctx)

    // FID-2026-0804-009: harness ECHO compliance receipt — non-blocking,
    // appended to the AI message's text blocks.
    handleEvent({
      type: 'compliance_warning',
      law: 'verifier_criteria',
      severity: 'warning',
      message: 'this change meets Verifier trigger criteria (10+ lines)',
      path: 'src/a.ts',
      stepNumber: 2,
    })

    const blocks = getMessages()[0].blocks ?? []
    const textBlock = blocks.find((b) => b.type === 'text') as
      { content: string } | undefined
    expect(textBlock).toBeDefined()
    expect(textBlock!.content).toContain('ECHO Verifier trigger')
    expect(textBlock!.content).toContain('10+ lines')
    expect(textBlock!.content).toContain('src/a.ts')
  })

  test('preserves streamed text content and skips duplicate final content', () => {
    const { ctx, getMessages, getStreamingAgents } = createTestContext()

    // Create an agent block with existing text blocks (simulating streamed output like basher)
    ctx.message.updater.updateAiMessageBlocks(() => [
      {
        type: 'agent',
        agentId: 'tool-1-0',
        agentName: 'Basher',
        agentType: 'basher',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'text',
            content: 'Streamed output from basher',
            textType: 'text',
          },
        ],
        initialPrompt: 'Run a command',
        spawnToolCallId: 'tool-1',
        spawnIndex: 0,
      } as any,
    ])
    ctx.streaming.setStreamingAgents(() => new Set(['tool-1-0']))

    const handleEvent = createEventHandler(ctx)
    const toolResultEvent: ToolResultEvent = {
      type: 'tool_result',
      toolCallId: 'tool-1',
      toolName: 'spawn_agents',
      output: [
        {
          type: 'json',
          value: [
            {
              agentName: 'basher',
              value: {
                type: 'lastMessage',
                value: [
                  {
                    role: 'assistant',
                    content: [
                      { type: 'text', text: 'Streamed output from basher' },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    }
    handleEvent(toolResultEvent)

    const agentBlock = (getMessages()[0].blocks ?? [])[0] as AgentContentBlock
    expect(agentBlock.status).toBe('complete')
    // Should NOT duplicate the streamed text — only the original text block
    expect(agentBlock.blocks).toHaveLength(1)
    expect(agentBlock.blocks?.[0]).toMatchObject({
      type: 'text',
      content: 'Streamed output from basher',
    })
    expect(getStreamingAgents().size).toBe(0)
  })
})
