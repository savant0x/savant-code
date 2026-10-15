import path from 'path'

import { createMockFs } from '@savant-code/common/testing/mocks/filesystem'
import { createMockLogger } from '@savant-code/common/testing/mocks/logger'
import { describe, it, expect } from 'bun:test'

import { loadUserKnowledgeFiles } from '../run-state'

// FID-2026-0819-005 Loop 202: case-insensitive matching suite moved
// verbatim from user-knowledge-files.test.ts; MOCK_HOME/mockPath helpers
// copied verbatim.

const MOCK_HOME = '/mock/home'
// FID-016 Fix A: use path.join() so mock file paths match the implementation's
// path.join() output on both POSIX and Windows. On POSIX path.join('/mock/home',
// '.knowledge.md') === '/mock/home/.knowledge.md'. On Windows path.join yields
// '\mock\home\.knowledge.md', which previously caused the mocks to NEVER match
// the impl's readFile calls, triggering empty results.
const mockPath = (file: string) => path.join(MOCK_HOME, file)

describe('loadUserKnowledgeFiles', () => {
  describe('case-insensitive matching', () => {
    it('should find ~/.KNOWLEDGE.md (uppercase) case-insensitively', async () => {
      const mockFs = createMockFs({
        readdirImpl: async () => ['.KNOWLEDGE.md', '.bashrc', '.gitconfig'],
        readFileImpl: async (p: string) => {
          if (p === mockPath('.KNOWLEDGE.md')) {
            return '# User knowledge (uppercase)'
          }
          throw new Error('File not found')
        },
      })
      const mockLogger = createMockLogger()

      const result = await loadUserKnowledgeFiles({
        fs: mockFs,
        logger: mockLogger,
        homeDir: MOCK_HOME,
      })

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['~/.KNOWLEDGE.md']).toBe('# User knowledge (uppercase)')
    })

    it('should find ~/.agents.md (lowercase) case-insensitively', async () => {
      const mockFs = createMockFs({
        readdirImpl: async () => ['.agents.md', '.bashrc'],
        readFileImpl: async (p: string) => {
          if (p === mockPath('.agents.md')) {
            return '# Agents file (lowercase)'
          }
          throw new Error('File not found')
        },
      })
      const mockLogger = createMockLogger()

      const result = await loadUserKnowledgeFiles({
        fs: mockFs,
        logger: mockLogger,
        homeDir: MOCK_HOME,
      })

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['~/.agents.md']).toBe('# Agents file (lowercase)')
    })

    it('should find ~/.claude.md (lowercase) case-insensitively', async () => {
      const mockFs = createMockFs({
        readdirImpl: async () => ['.claude.md', '.bashrc'],
        readFileImpl: async (p: string) => {
          if (p === mockPath('.claude.md')) {
            return '# Claude (lowercase)'
          }
          throw new Error('File not found')
        },
      })
      const mockLogger = createMockLogger()

      const result = await loadUserKnowledgeFiles({
        fs: mockFs,
        logger: mockLogger,
        homeDir: MOCK_HOME,
      })

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['~/.claude.md']).toBe('# Claude (lowercase)')
    })

    it('should find ~/.Knowledge.md (mixed case) case-insensitively', async () => {
      const mockFs = createMockFs({
        readdirImpl: async () => ['.Knowledge.md', '.bashrc'],
        readFileImpl: async (p: string) => {
          if (p === mockPath('.Knowledge.md')) {
            return '# Mixed case'
          }
          throw new Error('File not found')
        },
      })
      const mockLogger = createMockLogger()

      const result = await loadUserKnowledgeFiles({
        fs: mockFs,
        logger: mockLogger,
        homeDir: MOCK_HOME,
      })

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['~/.Knowledge.md']).toBe('# Mixed case')
    })

    it('should prioritize knowledge.md over AGENTS.md regardless of case', async () => {
      const mockFs = createMockFs({
        readdirImpl: async () => ['.AGENTS.md', '.Knowledge.md', '.bashrc'],
        readFileImpl: async (p: string) => {
          if (p === mockPath('.Knowledge.md')) {
            return '# Knowledge content'
          }
          if (p === mockPath('.AGENTS.md')) {
            return '# Agents content'
          }
          throw new Error('File not found')
        },
      })
      const mockLogger = createMockLogger()

      const result = await loadUserKnowledgeFiles({
        fs: mockFs,
        logger: mockLogger,
        homeDir: MOCK_HOME,
      })

      expect(Object.keys(result)).toHaveLength(1)
      expect(result['~/.Knowledge.md']).toBe('# Knowledge content')
    })

    it('should preserve the original filename case in the key', async () => {
      const mockFs = createMockFs({
        readdirImpl: async () => ['.KNOWLEDGE.MD', '.bashrc'],
        readFileImpl: async (p: string) => {
          if (p === mockPath('.KNOWLEDGE.MD')) {
            return '# All caps'
          }
          throw new Error('File not found')
        },
      })
      const mockLogger = createMockLogger()

      const result = await loadUserKnowledgeFiles({
        fs: mockFs,
        logger: mockLogger,
        homeDir: MOCK_HOME,
      })

      // The key should preserve the original case
      expect(Object.keys(result)[0]).toBe('~/.KNOWLEDGE.MD')
    })
  })
})
