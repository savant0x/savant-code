import { describe, expect, test } from 'bun:test'

import { createTestContext } from './sdk-event-handlers-test-harness'
import { replayVerifier, RAW_REVIEW, VERDICT } from './verifier-output-fixture'
import { isTextBlock } from '../../types/chat'
import { reconcileSpawnResult } from '../sdk-event-handlers/spawn-result-reconciliation'
import { handleSpawnAgentsResult } from '../sdk-event-handlers/spawn-results'

import type { AgentContentBlock, ContentBlock } from '../../types/chat'

function visible(blocks: ContentBlock[]) {
  return blocks
    .filter(isTextBlock)
    .filter((block) => block.textType !== 'reasoning')
    .map((block) => block.content)
    .join('')
}

describe('FID-2026-1010-002: audit final-result replay', () => {
  test('real spawn, start, chunk, finish and repeated result produce one complete review', () => {
    for (const type of ['verifier', 'adversary']) {
      for (const chunks of [
        RAW_REVIEW.split(''),
        [],
        ['FAIL stale preview'],
        ['<think>Audit'],
        ['<think>Audit notes</think>\n' + VERDICT.slice(0, 30)],
      ]) {
        const agent = replayVerifier(type, chunks)
        expect(agent.status).toBe('complete')
        expect(visible(agent.blocks ?? [])).toBe('\n' + VERDICT)
        expect(
          agent.blocks?.filter(
            (block) => block.type === 'text' && block.textType === 'reasoning',
          ),
        ).toHaveLength(1)
        expect(
          agent.blocks?.filter(
            (block) => block.type === 'text' && block.textType !== 'reasoning',
          ),
        ).toHaveLength(1)
      }
    }
  })

  test('divergent audit results preserve tools, children and reasoning in relative order', () => {
    const tool: ContentBlock = {
      type: 'tool',
      toolCallId: 'read',
      toolName: 'read_files',
      input: {},
    }
    const child: AgentContentBlock = {
      type: 'agent',
      agentId: 'child',
      agentName: 'Scout',
      agentType: 'scout',
      status: 'complete',
      content: '',
      blocks: [],
    }
    const reasoning: ContentBlock = {
      type: 'text',
      content: 'Native notes',
      textType: 'reasoning',
      thinkingId: 'keep',
      userOpened: true,
    }
    const blocks: ContentBlock[] = [
      reasoning,
      { type: 'text', content: 'Old preview' },
      tool,
      child,
      { type: 'text', content: ' tail', textType: 'text' },
    ]
    const result = reconcileSpawnResult(blocks, RAW_REVIEW, 'verifier')
    expect(visible(result)).toBe('\n' + VERDICT)
    expect(result.filter((block) => block.type !== 'text')).toEqual([
      tool,
      child,
    ])
    expect(result[0]).toMatchObject({ ...reasoning, thinkingOpen: false })
    expect(reconcileSpawnResult(result, RAW_REVIEW, 'verifier')).toEqual(result)
  })

  test('a partial untyped block receives the suffix in the same paragraph', () => {
    const result = reconcileSpawnResult(
      [{ type: 'text', content: VERDICT.slice(0, 30) }],
      VERDICT,
      'verifier',
    )
    expect(result).toHaveLength(1)
    expect(visible(result)).toBe(VERDICT)
    expect(reconcileSpawnResult(result, VERDICT, 'verifier')).toEqual(result)
  })

  test('empty results preserve preview evidence; non-auditors retain divergent previews', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Preview' }]
    expect(visible(reconcileSpawnResult(blocks, '', 'verifier'))).toBe(
      'Preview',
    )
    expect(visible(reconcileSpawnResult(blocks, 'Final', 'thinker'))).toBe(
      'PreviewFinal',
    )
  })

  test('replayed error results retain usable streamed evidence once and close reasoning', () => {
    const { ctx, getMessages } = createTestContext()
    const agent: AgentContentBlock = {
      ...replayVerifier(),
      blocks: [
        { type: 'text', content: 'Native notes', textType: 'reasoning' },
        { type: 'text', content: VERDICT },
      ],
      spawnToolCallId: 'spawn',
      spawnIndex: 0,
    }
    ctx.message.updater.updateAiMessageBlocks(() => [agent])
    const results = [
      { agentName: 'Verifier', value: { errorMessage: 'Provider failed' } },
    ]
    handleSpawnAgentsResult(ctx, 'spawn', results)
    handleSpawnAgentsResult(ctx, 'spawn', results)
    const completed = getMessages()[0].blocks?.[0]
    if (completed?.type !== 'agent') throw new Error('Missing evidence')
    expect(visible(completed.blocks ?? [])).toBe(VERDICT + 'Provider failed')
    expect(completed.blocks?.[0]).toMatchObject({ thinkingOpen: false })
    ctx.message.updater.updateAiMessageBlocks(() => [{ ...agent, blocks: [] }])
    handleSpawnAgentsResult(ctx, 'spawn', results)
    expect(getMessages()[0].blocks).toEqual([])
  })
})
