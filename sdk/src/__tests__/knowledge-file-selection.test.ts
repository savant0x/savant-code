import { describe, expect, test } from 'bun:test'

import {
  KNOWLEDGE_FILE_NAMES,
  isKnowledgeFile,
  selectHighestPriorityKnowledgeFile,
} from '../run-state'

describe('KNOWLEDGE_FILE_NAMES', () => {
  test('contains expected file names in priority order', () => {
    expect(KNOWLEDGE_FILE_NAMES).toEqual([
      'knowledge.md',
      'AGENTS.md',
      'CLAUDE.md',
    ])
  })
})

describe('isKnowledgeFile', () => {
  test('returns true for knowledge.md', () => {
    expect(isKnowledgeFile('knowledge.md')).toBe(true)
    expect(isKnowledgeFile('src/knowledge.md')).toBe(true)
    expect(isKnowledgeFile('KNOWLEDGE.MD')).toBe(true)
  })

  test('returns true for AGENTS.md', () => {
    expect(isKnowledgeFile('AGENTS.md')).toBe(true)
    expect(isKnowledgeFile('src/agents.md')).toBe(true)
    expect(isKnowledgeFile('Agents.MD')).toBe(true)
  })

  test('returns true for CLAUDE.md', () => {
    expect(isKnowledgeFile('CLAUDE.md')).toBe(true)
    expect(isKnowledgeFile('src/claude.md')).toBe(true)
    expect(isKnowledgeFile('Claude.MD')).toBe(true)
  })

  test('returns true for *.knowledge.md pattern', () => {
    expect(isKnowledgeFile('authentication.knowledge.md')).toBe(true)
    expect(isKnowledgeFile('src/api.knowledge.md')).toBe(true)
    expect(isKnowledgeFile('docs/AUTH.KNOWLEDGE.MD')).toBe(true)
    expect(isKnowledgeFile('foo.bar.knowledge.md')).toBe(true)
  })

  test('returns false for non-knowledge files', () => {
    expect(isKnowledgeFile('README.md')).toBe(false)
    expect(isKnowledgeFile('src/utils.ts')).toBe(false)
    expect(isKnowledgeFile('knowledge.txt')).toBe(false)
    expect(isKnowledgeFile('agents.txt')).toBe(false)
  })

  test('returns false for files with knowledge in name but no dot separator', () => {
    // These should NOT match - stricter matching requires exact filename or .knowledge.md suffix
    expect(isKnowledgeFile('myknowledge.md')).toBe(false)
    expect(isKnowledgeFile('src/authknowledge.md')).toBe(false)
    expect(isKnowledgeFile('preknowledge.md')).toBe(false)
  })

  test('returns false for similar but non-matching patterns', () => {
    // .agents.md and .claude.md patterns should NOT match
    expect(isKnowledgeFile('auth.agents.md')).toBe(false)
    expect(isKnowledgeFile('auth.claude.md')).toBe(false)
    expect(isKnowledgeFile('foo.AGENTS.md')).toBe(false)
    expect(isKnowledgeFile('foo.CLAUDE.md')).toBe(false)
  })
})

describe('selectHighestPriorityKnowledgeFile', () => {
  test('returns undefined for empty array', () => {
    expect(selectHighestPriorityKnowledgeFile([])).toBeUndefined()
  })

  test('returns undefined when no knowledge files present', () => {
    expect(
      selectHighestPriorityKnowledgeFile(['README.md', 'src/utils.ts']),
    ).toBeUndefined()
  })

  test('returns the only knowledge file', () => {
    expect(selectHighestPriorityKnowledgeFile(['AGENTS.md'])).toBe('AGENTS.md')
  })

  test('prefers knowledge.md over AGENTS.md', () => {
    expect(
      selectHighestPriorityKnowledgeFile(['AGENTS.md', 'knowledge.md']),
    ).toBe('knowledge.md')
  })

  test('prefers knowledge.md over CLAUDE.md', () => {
    expect(
      selectHighestPriorityKnowledgeFile(['CLAUDE.md', 'knowledge.md']),
    ).toBe('knowledge.md')
  })

  test('prefers AGENTS.md over CLAUDE.md', () => {
    expect(selectHighestPriorityKnowledgeFile(['CLAUDE.md', 'AGENTS.md'])).toBe(
      'AGENTS.md',
    )
  })

  test('prefers knowledge.md when all three exist', () => {
    expect(
      selectHighestPriorityKnowledgeFile([
        'CLAUDE.md',
        'AGENTS.md',
        'knowledge.md',
      ]),
    ).toBe('knowledge.md')
  })

  test('handles case-insensitive matching', () => {
    expect(selectHighestPriorityKnowledgeFile(['KNOWLEDGE.MD'])).toBe(
      'KNOWLEDGE.MD',
    )
    expect(selectHighestPriorityKnowledgeFile(['agents.md'])).toBe('agents.md')
    expect(selectHighestPriorityKnowledgeFile(['Claude.md'])).toBe('Claude.md')
  })

  test('filters out non-knowledge files before selecting', () => {
    expect(
      selectHighestPriorityKnowledgeFile([
        'README.md',
        'AGENTS.md',
        'utils.ts',
      ]),
    ).toBe('AGENTS.md')
  })
})
