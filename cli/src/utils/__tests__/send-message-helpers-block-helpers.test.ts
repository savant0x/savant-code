import { describe, test, expect } from 'bun:test'

import {
  extractPlanFromBuffer,
  createAgentBlock,
  getAgentBaseName,
  updateToolBlockWithOutput,
  transformAskUserBlocks,
  appendInterruptionNotice,
} from '../message-block-helpers'

import type {
  ContentBlock,
  AgentContentBlock,
  AskUserContentBlock,
  TextContentBlock,
  ToolContentBlock,
} from '../../types/chat'

// ============================================================================
// Plan Extraction Tests (from message-block-helpers)
// ============================================================================

describe('extractPlanFromBuffer', () => {
  test('extracts plan content from complete tags', () => {
    const buffer = 'Some text <PLAN>This is the plan</PLAN> more text'

    const result = extractPlanFromBuffer(buffer)

    expect(result).toBe('This is the plan')
  })

  test('returns null for incomplete plan', () => {
    const buffer = 'Some text <PLAN>Incomplete plan'

    expect(extractPlanFromBuffer(buffer)).toBeNull()
  })

  test('returns null when no plan tags exist', () => {
    expect(extractPlanFromBuffer('No plan here')).toBeNull()
  })

  test('trims whitespace from extracted plan', () => {
    const buffer = '<PLAN>  Trimmed plan  </PLAN>'

    expect(extractPlanFromBuffer(buffer)).toBe('Trimmed plan')
  })
})

// ============================================================================
// Agent Block Helpers Tests (from message-block-helpers)
// ============================================================================

describe('createAgentBlock', () => {
  test('creates an agent block with required fields', () => {
    const block = createAgentBlock({
      agentId: 'agent-1',
      agentType: 'scout',
    })

    expect(block.type).toBe('agent')
    expect(block.agentId).toBe('agent-1')
    expect(block.agentType).toBe('scout')
    expect(block.status).toBe('running')
    expect(block.content).toBe('')
  })

  test('includes optional prompt', () => {
    const block = createAgentBlock({
      agentId: 'agent-1',
      agentType: 'scout',
      prompt: 'Find files',
    })

    expect(block.initialPrompt).toBe('Find files')
  })

  test('includes optional params', () => {
    const block = createAgentBlock({
      agentId: 'agent-1',
      agentType: 'scout',
      params: { path: '/src' },
    })

    expect(block.params).toEqual({ path: '/src' })
  })
})

describe('getAgentBaseName', () => {
  test('extracts base name from scoped versioned name', () => {
    expect(getAgentBaseName('savant-code/scout@0.0.2')).toBe('scout')
  })

  test('extracts base name from simple versioned name', () => {
    expect(getAgentBaseName('scout@1.0.0')).toBe('scout')
  })

  test('returns simple name unchanged', () => {
    expect(getAgentBaseName('scout')).toBe('scout')
  })

  test('normalizes direct tool aliases to canonical agent names', () => {
    expect(getAgentBaseName('code_reviewer_lite')).toBe('code-reviewer-lite')
  })
})

describe('agentTypesMatch', () => {
  test('matches same base names with different versions', () => {
    expect(
      getAgentBaseName('savant-code/scout@0.0.2') ===
        getAgentBaseName('scout@1.0.0'),
    ).toBe(true)
  })

  test('matches same simple names', () => {
    expect(getAgentBaseName('scout') === getAgentBaseName('scout')).toBe(true)
  })

  test('does not match different base names', () => {
    expect(
      getAgentBaseName('scout') === getAgentBaseName('code-searcher'),
    ).toBe(false)
  })
})

// ============================================================================
// Tool Block Helpers Tests (from message-block-helpers)
// ============================================================================

describe('updateToolBlockWithOutput', () => {
  test('updates tool block with output', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-1',
        toolName: 'read_files',
        input: {},
      },
    ]

    const result = updateToolBlockWithOutput(blocks, {
      toolCallId: 'tool-1',
      toolOutput: ['File contents'],
    })

    expect((result[0] as ToolContentBlock).output).toBe('File contents')
  })

  test('updates nested tool block', () => {
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
            toolCallId: 'tool-1',
            toolName: 'read_files',
            input: {},
          },
        ],
      },
    ]

    const result = updateToolBlockWithOutput(blocks, {
      toolCallId: 'tool-1',
      toolOutput: ['File contents'],
    })
    const agent = result[0] as AgentContentBlock
    expect((agent.blocks![0] as ToolContentBlock).output).toBe('File contents')
  })

  test('returns same reference if no match', () => {
    const blocks: ContentBlock[] = [{ type: 'text', content: 'Hello' }]

    const result = updateToolBlockWithOutput(blocks, {
      toolCallId: 'tool-1',
      toolOutput: ['Output'],
    })

    expect(result).toEqual(blocks)
  })
})

// ============================================================================
// Ask User Transformation Tests (from message-block-helpers)
// ============================================================================

describe('transformAskUserBlocks', () => {
  test('transforms ask_user tool block to ask-user block', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-1',
        toolName: 'ask_user',
        input: { questions: [{ question: 'Choose?', options: ['A', 'B'] }] },
      },
    ]

    const result = transformAskUserBlocks(blocks, {
      toolCallId: 'tool-1',
      resultValue: { answers: [{ questionIndex: 0, selectedOption: 'A' }] },
    })

    expect(result[0].type).toBe('ask-user')
    expect((result[0] as AskUserContentBlock).answers).toEqual([
      { questionIndex: 0, selectedOption: 'A' },
    ])
  })

  test('keeps tool block if no answers or skipped', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-1',
        toolName: 'ask_user',
        input: { questions: [] },
      },
    ]

    const result = transformAskUserBlocks(blocks, {
      toolCallId: 'tool-1',
      resultValue: {},
    })

    expect(result[0].type).toBe('tool')
  })

  test('handles skipped state', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-1',
        toolName: 'ask_user',
        input: { questions: [] },
      },
    ]

    const result = transformAskUserBlocks(blocks, {
      toolCallId: 'tool-1',
      resultValue: { skipped: true },
    })

    expect(result[0].type).toBe('ask-user')
    expect((result[0] as AskUserContentBlock).skipped).toBe(true)
  })
})

// ============================================================================
// Interruption Handling Tests (from message-block-helpers)
// ============================================================================

describe('appendInterruptionNotice', () => {
  test('appends to existing text block', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: 'Partial response' },
    ]

    const result = appendInterruptionNotice(blocks)

    expect((result[0] as TextContentBlock).content).toBe(
      'Partial response\n\n[response interrupted]',
    )
  })

  test('creates new text block if no existing text', () => {
    const blocks: ContentBlock[] = []

    const result = appendInterruptionNotice(blocks)

    expect(result).toHaveLength(1)
    expect((result[0] as TextContentBlock).content).toBe(
      '[response interrupted]',
    )
  })

  test('creates new block if last block is not text', () => {
    const blocks: ContentBlock[] = [
      {
        type: 'tool',
        toolCallId: 'tool-1',
        toolName: 'read_files',
        input: {},
      },
    ]

    const result = appendInterruptionNotice(blocks)

    expect(result).toHaveLength(2)
    expect(result[1].type).toBe('text')
  })
})
