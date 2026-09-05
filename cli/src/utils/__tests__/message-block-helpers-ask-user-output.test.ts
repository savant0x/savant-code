// Message-block-helpers test family — transformAskUserBlocks and
// updateToolBlockWithOutput. Sibling of the Loop 319 decomposition.

import { describe, expect, test } from 'bun:test'

import {
  transformAskUserBlocks,
  updateToolBlockWithOutput,
} from '../message-block-helpers'

import type {
  AgentContentBlock,
  AskUserContentBlock,
  ContentBlock,
  ToolContentBlock,
} from '../../types/chat'

describe('transformAskUserBlocks', () => {
  test('transforms ask_user tool block to ask-user block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-123',
        toolName: 'ask_user',
        input: {
          questions: [
            { question: 'Pick one', options: [{ label: 'A' }, { label: 'B' }] },
          ],
        },
      },
    ]
    const result = transformAskUserBlocks(blocks, {
      toolCallId: 'tool-123',
      resultValue: { answers: [{ questionIndex: 0, selectedOption: 'A' }] },
    })
    expect(result[0].type).toBe('ask-user')
    const askUserBlock = result[0] as AskUserContentBlock
    expect(askUserBlock.answers).toEqual([
      { questionIndex: 0, selectedOption: 'A' },
    ])
    expect(askUserBlock.questions).toEqual([
      { question: 'Pick one', options: [{ label: 'A' }, { label: 'B' }] },
    ])
  })

  test('transforms skipped ask_user block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-123',
        toolName: 'ask_user',
        input: {
          questions: [
            { question: 'Pick one', options: [{ label: 'A' }, { label: 'B' }] },
          ],
        },
      },
    ]
    const result = transformAskUserBlocks(blocks, {
      toolCallId: 'tool-123',
      resultValue: { skipped: true },
    })
    expect(result[0].type).toBe('ask-user')
    expect((result[0] as AskUserContentBlock).skipped).toBe(true)
  })

  test('keeps tool block when no result data', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-123',
        toolName: 'ask_user',
        input: { questions: [] },
      },
    ]
    const result = transformAskUserBlocks(blocks, {
      toolCallId: 'tool-123',
      resultValue: {},
    })
    expect(result[0].type).toBe('tool')
  })

  test('does not transform non-matching tool', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-123',
        toolName: 'ask_user',
        input: { questions: [] },
      },
    ]
    const result = transformAskUserBlocks(blocks, {
      toolCallId: 'different-id',
      resultValue: { answers: [{ questionIndex: 0, selectedOption: 'A' }] },
    })
    expect(result[0].type).toBe('tool')
  })

  test('transforms nested ask_user in agent blocks', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'tool',
            toolCallId: 'tool-123',
            toolName: 'ask_user',
            input: { questions: [{ question: 'Q?' }] },
          },
        ],
        initialPrompt: '',
      },
    ]
    const result = transformAskUserBlocks(blocks, {
      toolCallId: 'tool-123',
      resultValue: { answers: [{ questionIndex: 0, selectedOption: 'Yes' }] },
    })
    expect((result[0] as AgentContentBlock).blocks![0].type).toBe('ask-user')
  })

  test('returns same reference when nothing changes', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]
    const result = transformAskUserBlocks(blocks, {
      toolCallId: 'tool-123',
      resultValue: { answers: [{ questionIndex: 0, selectedOption: 'A' }] },
    })
    expect(result[0]).toBe(blocks[0])
  })
})

describe('updateToolBlockWithOutput', () => {
  test('updates tool block with formatted output', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-123',
        toolName: 'read_files',
        input: { paths: ['file.ts'] },
      },
    ]
    const result = updateToolBlockWithOutput(blocks, {
      toolCallId: 'tool-123',
      toolOutput: [{ type: 'text', value: 'file contents' }],
    })
    expect((result[0] as ToolContentBlock).output).toBeDefined()
  })

  test('formats terminal command output specially', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-123',
        toolName: 'run_terminal_command',
        input: { command: 'echo hi' },
      },
    ]
    const result = updateToolBlockWithOutput(blocks, {
      toolCallId: 'tool-123',
      toolOutput: [{ value: { stdout: 'hi\n', stderr: '' } }],
    })
    expect((result[0] as ToolContentBlock).output).toBe('hi\n')
  })

  test('combines stdout and stderr for terminal commands', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-123',
        toolName: 'run_terminal_command',
        input: { command: 'cmd' },
      },
    ]
    const result = updateToolBlockWithOutput(blocks, {
      toolCallId: 'tool-123',
      toolOutput: [{ value: { stdout: 'out', stderr: 'err' } }],
    })
    expect((result[0] as ToolContentBlock).output).toBe('outerr')
  })

  test('does not update non-matching tool block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-123',
        toolName: 'read_files',
        input: {},
      },
    ]
    const result = updateToolBlockWithOutput(blocks, {
      toolCallId: 'different-id',
      toolOutput: [{ value: 'output' }],
    })
    expect((result[0] as ToolContentBlock).output).toBeUndefined()
  })

  test('updates nested tool blocks in agent', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'running',
        blocks: [
          {
            type: 'tool',
            toolCallId: 'tool-123',
            toolName: 'read_files',
            input: {},
          },
        ],
        initialPrompt: '',
      },
    ]
    const result = updateToolBlockWithOutput(blocks, {
      toolCallId: 'tool-123',
      toolOutput: [{ type: 'text', value: 'contents' }],
    })
    expect(
      ((result[0] as AgentContentBlock).blocks![0] as ToolContentBlock).output,
    ).toBeDefined()
  })

  test('returns same reference for unchanged nested blocks', () => {
    const nestedBlocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]
    const blocks: ContentBlock[] = [
      {
        type: 'agent',
        agentId: 'agent-1',
        agentName: 'Test',
        agentType: 'test',
        content: '',
        status: 'running',
        blocks: nestedBlocks,
        initialPrompt: '',
      },
    ]
    const result = updateToolBlockWithOutput(blocks, {
      toolCallId: 'non-existent',
      toolOutput: [],
    })
    expect(result[0]).toBe(blocks[0])
  })
})
