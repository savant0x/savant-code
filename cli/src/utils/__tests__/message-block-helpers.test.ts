// Message-block-helpers test family — name resolution and plan-tag
// extraction/scrubbing. Decomposed from the FID-2026-0819-005 Loop 319
// monolith; siblings cover auto-collapse, spawn-result extraction,
// interruption/creation, tree edits, ask-user, and tool-output updates.

import { describe, expect, test } from 'bun:test'

import {
  getAgentBaseName,
  extractPlanFromBuffer,
  scrubPlanTags,
  scrubPlanTagsInBlocks,
  insertPlanBlock,
} from '../message-block-helpers'

import type { ContentBlock } from '../../types/chat'

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

  test('handles scoped name without version', () => {
    expect(getAgentBaseName('savant-code/scout')).toBe('scout')
  })

  test('handles empty string', () => {
    expect(getAgentBaseName('')).toBe('')
  })

  test('handles name with multiple slashes', () => {
    expect(getAgentBaseName('@scope/sub/agent@1.0.0')).toBe('agent')
  })
})

describe('extractPlanFromBuffer', () => {
  test('extracts plan content between tags', () => {
    const buffer = 'Some text <PLAN>This is the plan</PLAN> more text'
    expect(extractPlanFromBuffer(buffer)).toBe('This is the plan')
  })

  test('trims whitespace from extracted plan', () => {
    const buffer = '<PLAN>  \n  Plan with whitespace  \n  </PLAN>'
    expect(extractPlanFromBuffer(buffer)).toBe('Plan with whitespace')
  })

  test('returns null when no opening tag', () => {
    const buffer = 'This is the plan</PLAN>'
    expect(extractPlanFromBuffer(buffer)).toBeNull()
  })

  test('returns null when no closing tag', () => {
    const buffer = '<PLAN>This is the plan'
    expect(extractPlanFromBuffer(buffer)).toBeNull()
  })

  test('returns null when tags are in wrong order', () => {
    const buffer = '</PLAN>content<PLAN>'
    expect(extractPlanFromBuffer(buffer)).toBeNull()
  })

  test('returns null for empty buffer', () => {
    expect(extractPlanFromBuffer('')).toBeNull()
  })

  test('handles multiline plan content', () => {
    const buffer =
      '<PLAN>\n1. First step\n2. Second step\n3. Third step\n</PLAN>'
    expect(extractPlanFromBuffer(buffer)).toBe(
      '1. First step\n2. Second step\n3. Third step',
    )
  })
})

describe('scrubPlanTags helpers', () => {
  test('removes plan tags from text', () => {
    expect(scrubPlanTags('<PLAN>Plan</PLAN> trailing')).toBe(' trailing')
  })

  test('scrubs plan tags inside text blocks and removes empties', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: '<PLAN>Plan</PLAN>' },
      { type: 'text', content: 'Keep me' },
      { type: 'tool', toolCallId: 'id', toolName: 'read_files', input: {} },
    ]
    const result = scrubPlanTagsInBlocks(blocks)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ type: 'text', content: 'Keep me' })
    expect(result[1].type).toBe('tool')
  })

  test('inserts plan block after scrubbing', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', content: 'Intro <PLAN>secret</PLAN>' },
    ]
    const result = insertPlanBlock(blocks, 'Plan body')
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ type: 'text', content: 'Intro ' })
    expect(result[1]).toEqual({ type: 'plan', content: 'Plan body' })
  })
})
