import { describe, expect, test } from 'bun:test'

import { buildActivityTimeline } from '../implementor-helpers'

import type { ContentBlock, TextContentBlock } from '../../types/chat'

describe('buildActivityTimeline', () => {
  test('builds timeline from mixed blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'Making changes to the file',
      } as TextContentBlock,
      {
        type: 'tool',
        toolCallId: 'test-1',
        toolName: 'str_replace',
        input: { path: 'file.ts' },
        outputRaw: [{ type: 'json', value: { unifiedDiff: '+new line' } }],
      },
      {
        type: 'text',
        content: 'Done with changes',
      } as TextContentBlock,
    ]
    const timeline = buildActivityTimeline(blocks)
    expect(timeline).toHaveLength(3)
    expect(timeline[0].type).toBe('commentary')
    expect(timeline[0].content).toBe('Making changes to the file')
    expect(timeline[1].type).toBe('edit')
    expect(timeline[1].content).toBe('file.ts')
    expect(timeline[1].diff).toBe('+new line')
    expect(timeline[2].type).toBe('commentary')
  })

  test('skips reasoning blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'Some reasoning',
        textType: 'reasoning',
      } as TextContentBlock,
      {
        type: 'text',
        content: 'Normal text',
      } as TextContentBlock,
    ]
    const timeline = buildActivityTimeline(blocks)
    expect(timeline).toHaveLength(1)
    expect(timeline[0].content).toBe('Normal text')
  })

  test('skips failed edit tools', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'text',
        content: 'Trying an edit',
      } as TextContentBlock,
      {
        type: 'tool',
        toolCallId: 'test-1',
        toolName: 'write_file',
        input: { path: 'file.ts', content: 'new content' },
        output: 'Failed to write to file',
      },
    ]
    const timeline = buildActivityTimeline(blocks)
    expect(timeline).toHaveLength(1)
    expect(timeline[0].type).toBe('commentary')
  })
})
