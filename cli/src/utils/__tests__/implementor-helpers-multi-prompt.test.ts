import { describe, expect, test } from 'bun:test'

import {
  getMultiPromptPreview,
  getMultiPromptProgress,
} from '../implementor-helpers'

import type {
  AgentContentBlock,
  ContentBlock,
  TextContentBlock,
  ToolContentBlock,
} from '../../types/chat'

describe('getMultiPromptProgress', () => {
  const createImplementorAgent = (
    id: string,
    status: 'running' | 'complete' | 'failed' | 'cancelled' = 'complete',
  ): AgentContentBlock =>
    ({
      type: 'agent',
      agentId: id,
      agentName: 'Implementor',
      agentType: 'editor-implementor-opus',
      content: '',
      status,
      blocks: [],
    }) as AgentContentBlock

  const createSelectorAgent = (
    status: 'running' | 'complete' = 'running',
  ): AgentContentBlock =>
    ({
      type: 'agent',
      agentId: 'selector-1',
      agentName: 'Selector',
      agentType: 'best-of-n-selector2',
      content: '',
      status,
      blocks: [],
    }) as AgentContentBlock

  test('returns null for empty blocks', () => {
    expect(getMultiPromptProgress([])).toBeNull()
    expect(getMultiPromptProgress(undefined)).toBeNull()
  })

  test('returns null when no implementors present', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: 'some text' } as TextContentBlock,
    ]
    expect(getMultiPromptProgress(blocks)).toBeNull()
  })

  test('counts total and completed implementors', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'running'),
      createImplementorAgent('impl-3', 'complete'),
    ]
    const progress = getMultiPromptProgress(blocks)
    expect(progress).toEqual({
      total: 3,
      completed: 2,
      failed: 0,
      isSelecting: false,
      isSelectorComplete: false,
    })
  })

  test('counts failed implementors separately', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'failed'),
      createImplementorAgent('impl-3', 'cancelled'),
    ]
    const progress = getMultiPromptProgress(blocks)
    expect(progress).toEqual({
      total: 3,
      completed: 1,
      failed: 2,
      isSelecting: false,
      isSelectorComplete: false,
    })
  })

  test('detects selector running state', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'complete'),
      createSelectorAgent('running'),
    ]
    const progress = getMultiPromptProgress(blocks)
    expect(progress?.isSelecting).toBe(true)
    expect(progress?.isSelectorComplete).toBe(false)
  })

  test('detects selector complete state', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'complete'),
      createSelectorAgent('complete'),
    ]
    const progress = getMultiPromptProgress(blocks)
    expect(progress?.isSelecting).toBe(false)
    expect(progress?.isSelectorComplete).toBe(true)
  })

  test('treats failed as finished for progress calculation', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'failed'),
      createImplementorAgent('impl-3', 'running'),
    ]
    const progress = getMultiPromptProgress(blocks)
    // 1 complete + 1 failed = 2 finished out of 3
    expect(progress?.completed).toBe(1)
    expect(progress?.failed).toBe(1)
    expect(progress?.total).toBe(3)
  })
})

describe('getMultiPromptPreview', () => {
  const createImplementorAgent = (
    id: string,
    status: 'running' | 'complete' | 'failed' | 'cancelled' = 'complete',
  ): AgentContentBlock =>
    ({
      type: 'agent',
      agentId: id,
      agentName: 'Implementor',
      agentType: 'editor-implementor-opus',
      content: '',
      status,
      blocks: [],
    }) as AgentContentBlock

  const createSelectorAgent = (
    status: 'running' | 'complete' = 'running',
  ): AgentContentBlock =>
    ({
      type: 'agent',
      agentId: 'selector-1',
      agentName: 'Selector',
      agentType: 'best-of-n-selector2',
      content: '',
      status,
      blocks: [],
    }) as AgentContentBlock

  const createSetOutputBlock = (reason?: string): ToolContentBlock => ({
    type: 'tool',
    toolCallId: 'set-output-1',
    toolName: 'set_output',
    input: reason
      ? { data: { chosenStrategy: 'strategy A', reason } }
      : { data: { chosenStrategy: 'strategy A' } },
  })

  test('returns null for empty blocks', () => {
    expect(getMultiPromptPreview([])).toBeNull()
    expect(getMultiPromptPreview(undefined)).toBeNull()
  })

  test('shows generating message when no implementors complete', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'running'),
      createImplementorAgent('impl-2', 'running'),
      createImplementorAgent('impl-3', 'running'),
    ]
    expect(getMultiPromptPreview(blocks)).toBe('Generating 3 proposals...')
  })

  test('shows progress when some implementors complete', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'running'),
      createImplementorAgent('impl-3', 'complete'),
    ]
    expect(getMultiPromptPreview(blocks)).toBe('2/3 proposals complete...')
  })

  test('shows selecting message when selector is running', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'complete'),
      createImplementorAgent('impl-3', 'complete'),
      createSelectorAgent('running'),
    ]
    expect(getMultiPromptPreview(blocks)).toBe(
      '3 proposals complete • Selecting best...',
    )
  })

  test('shows applying message when selector is complete but agent not done', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'complete'),
      createSelectorAgent('complete'),
    ]
    expect(getMultiPromptPreview(blocks, false)).toBe(
      'Applying selected changes...',
    )
  })

  test('shows evaluation count when agent is complete without reason', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'complete'),
      createImplementorAgent('impl-3', 'complete'),
    ]
    expect(getMultiPromptPreview(blocks, true)).toBe('3 proposals evaluated')
  })

  test('shows evaluation count with reason when agent is complete', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'complete'),
      createSetOutputBlock('best implementation with proper error handling'),
    ]
    const preview = getMultiPromptPreview(blocks, true)
    expect(preview).toBe(
      '2 proposals evaluated\nBest implementation with proper error handling',
    )
  })

  test('capitalizes first letter of reason', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createSetOutputBlock('simple and clean'),
    ]
    const preview = getMultiPromptPreview(blocks, true)
    expect(preview).toContain('Simple and clean')
  })

  test('shows failure count when some implementors fail', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'failed'),
      createImplementorAgent('impl-3', 'running'),
    ]
    expect(getMultiPromptPreview(blocks)).toBe('1/3 complete, 1 failed...')
  })

  test('shows all finished with failures when all done but some failed', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'complete'),
      createImplementorAgent('impl-2', 'complete'),
      createImplementorAgent('impl-3', 'failed'),
    ]
    expect(getMultiPromptPreview(blocks)).toBe(
      '2/3 proposals complete (1 failed)',
    )
  })

  test('treats failed implementors as finished for progress', () => {
    const blocks: ContentBlock[] = [
      createImplementorAgent('impl-1', 'cancelled'),
      createImplementorAgent('impl-2', 'failed'),
      createImplementorAgent('impl-3', 'complete'),
    ]
    // All 3 are finished (1 complete + 2 failed/cancelled), so should show completion message
    expect(getMultiPromptPreview(blocks)).toBe(
      '1/3 proposals complete (2 failed)',
    )
  })
})
