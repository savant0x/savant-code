// Sdk-event-handlers test family — plan extraction and spawn placeholder
// mapping. Sibling of the Loop-347 decomposition (shared fixtures in
// ./sdk-event-handlers-test-harness; spawn-results and compliance suites in
// sdk-event-handlers-*.test.ts siblings).

import { describe, expect, test } from 'bun:test'

import {
  createAgentBlock,
  createEventHandler,
  createTestContext,
  createStreamChunkHandler,
} from './sdk-event-handlers-test-harness'

import type { SubagentStartEvent } from './sdk-event-handlers-test-harness'
import type { AgentContentBlock } from '../../types/chat'

describe('sdk-event-handlers', () => {
  test('extracts plan content from root stream', () => {
    const { ctx, getMessages, getHasPlanResponse } =
      createTestContext('SCAFFOLD')
    const handleChunk = createStreamChunkHandler(ctx)

    handleChunk('<PLAN>Build plan</PLAN>')

    const blocks = getMessages()[0].blocks ?? []
    expect(blocks.find((b) => b.type === 'plan')).toMatchObject({
      content: 'Build plan',
    })
    expect(getHasPlanResponse()).toBe(true)
  })

  test('maps spawn agent placeholder to real agent', () => {
    const { ctx, getMessages, getStreamingAgents, streamRefs } =
      createTestContext()
    ctx.streaming.setStreamingAgents(() => new Set(['tool-1-0']))
    ctx.message.updater.addBlock(
      createAgentBlock({ agentId: 'tool-1-0', agentType: 'temp' }),
    )
    streamRefs.controller.setters.setSpawnAgentInfo('tool-1-0', {
      index: 0,
      agentType: 'scout',
    })

    const handleEvent = createEventHandler(ctx)
    const startEvent: SubagentStartEvent = {
      type: 'subagent_start',
      agentId: 'agent-real',
      agentType: 'savant-code/scout@1.0.0',
      displayName: 'Agent',
      onlyChild: false,
      parentAgentId: undefined,
      params: undefined,
      prompt: undefined,
    }
    handleEvent(startEvent)

    const agentBlock = (getMessages()[0].blocks ?? [])[0] as AgentContentBlock
    expect(agentBlock.agentId).toBe('agent-real')
    expect(getStreamingAgents().has('agent-real')).toBe(true)
    expect(getStreamingAgents().has('tool-1-0')).toBe(false)
  })
})
