import path from 'path'

import { createMockFs } from '@savant-code/common/testing/mocks/filesystem'
import { createMockLogger } from '@savant-code/common/testing/mocks/logger'
import { describe, it, expect } from 'bun:test'

import { loadUserKnowledgeFiles } from '../run-state'

// FID-2026-0819-005 Loop 201: error-handling suite moved verbatim from
// user-knowledge-files.test.ts; MOCK_HOME/mockPath helpers copied verbatim.

const MOCK_HOME = '/mock/home'
// FID-016 Fix A: use path.join() so mock file paths match the implementation's
// path.join() output on both POSIX and Windows. On POSIX path.join('/mock/home',
// '.knowledge.md') === '/mock/home/.knowledge.md'. On Windows path.join yields
// '\mock\home\.knowledge.md', which previously caused the mocks to NEVER match
// the impl's readFile calls, triggering empty results.
const mockPath = (file: string) => path.join(MOCK_HOME, file)

describe('loadUserKnowledgeFiles', () => {
  describe('error handling', () => {
    it('should handle readdir failure gracefully', async () => {
      const mockFs = createMockFs({
        readdirImpl: async () => {
          throw new Error('Permission denied')
        },
        readFileImpl: async () => '',
      })
      const mockLogger = createMockLogger()

      const result = await loadUserKnowledgeFiles({
        fs: mockFs,
        logger: mockLogger,
        homeDir: MOCK_HOME,
      })

      expect(Object.keys(result)).toHaveLength(0)
    })

    it('should handle readFile failure gracefully and try next priority', async () => {
      const mockFs = createMockFs({
        readdirImpl: async () => ['.knowledge.md', '.AGENTS.md'],
        readFileImpl: async (p: string) => {
          if (p === mockPath('.knowledge.md')) {
            throw new Error('Read error')
          }
          if (p === mockPath('.AGENTS.md')) {
            return '# Agents fallback'
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

      // Should fall back to AGENTS.md when knowledge.md fails to read
      expect(result).toEqual({ '~/.AGENTS.md': '# Agents fallback' })
    })
  })
})
