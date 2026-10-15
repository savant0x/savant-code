import path from 'path'

import { createMockFs } from '@savant-code/common/testing/mocks/filesystem'
import { createMockLogger } from '@savant-code/common/testing/mocks/logger'
import { describe, it, expect } from 'bun:test'

import { loadUserKnowledgeFiles } from '../run-state'

const MOCK_HOME = '/mock/home'
// FID-016 Fix A: use path.join() so mock file paths match the implementation's
// path.join() output on both POSIX and Windows. On POSIX path.join('/mock/home',
// '.knowledge.md') === '/mock/home/.knowledge.md'. On Windows path.join yields
// '\mock\home\.knowledge.md', which previously caused the mocks to NEVER match
// the impl's readFile calls, triggering empty results.
const mockPath = (file: string) => path.join(MOCK_HOME, file)

describe('loadUserKnowledgeFiles', () => {
  it('should return empty object when no knowledge files exist', async () => {
    const mockFs = createMockFs({
      readdirImpl: async () => ['.bashrc', '.gitconfig', '.profile'],
      readFileImpl: async () => {
        throw new Error('File not found')
      },
    })
    const mockLogger = createMockLogger()

    const result = await loadUserKnowledgeFiles({
      fs: mockFs,
      logger: mockLogger,
      homeDir: MOCK_HOME,
    })

    expect(Object.keys(result)).toHaveLength(0)
  })

  it('should load ~/.knowledge.md when it exists', async () => {
    const mockFs = createMockFs({
      readdirImpl: async () => ['.knowledge.md', '.bashrc'],
      readFileImpl: async (p: string) => {
        if (p === mockPath('.knowledge.md')) {
          return '# My user knowledge'
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

    expect(result).toEqual({ '~/.knowledge.md': '# My user knowledge' })
  })

  it('should load ~/.AGENTS.md when ~/.knowledge.md does not exist', async () => {
    const mockFs = createMockFs({
      readdirImpl: async () => ['.AGENTS.md', '.bashrc'],
      readFileImpl: async (p: string) => {
        if (p === mockPath('.AGENTS.md')) {
          return '# Agents config'
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

    expect(result).toEqual({ '~/.AGENTS.md': '# Agents config' })
  })

  it('should load ~/.CLAUDE.md when neither knowledge.md nor AGENTS.md exist', async () => {
    const mockFs = createMockFs({
      readdirImpl: async () => ['.CLAUDE.md', '.bashrc'],
      readFileImpl: async (p: string) => {
        if (p === mockPath('.CLAUDE.md')) {
          return '# Claude instructions'
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

    expect(result).toEqual({ '~/.CLAUDE.md': '# Claude instructions' })
  })

  it('should prefer knowledge.md over AGENTS.md when both exist', async () => {
    const mockFs = createMockFs({
      readdirImpl: async () => ['.AGENTS.md', '.knowledge.md', '.bashrc'],
      readFileImpl: async (p: string) => {
        if (p === mockPath('.knowledge.md')) {
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

    expect(result).toEqual({ '~/.knowledge.md': '# Knowledge content' })
  })

  it('should prefer AGENTS.md over CLAUDE.md when both exist', async () => {
    const mockFs = createMockFs({
      readdirImpl: async () => ['.CLAUDE.md', '.AGENTS.md'],
      readFileImpl: async (p: string) => {
        if (p === mockPath('.AGENTS.md')) {
          return '# Agents content'
        }
        if (p === mockPath('.CLAUDE.md')) {
          return '# Claude content'
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

    expect(result).toEqual({ '~/.AGENTS.md': '# Agents content' })
  })

  it('should only return one knowledge file (highest priority)', async () => {
    const mockFs = createMockFs({
      readdirImpl: async () => [
        '.knowledge.md',
        '.AGENTS.md',
        '.CLAUDE.md',
        '.bashrc',
      ],
      readFileImpl: async (p: string) => {
        if (p === mockPath('.knowledge.md')) {
          return '# Knowledge'
        }
        if (p === mockPath('.AGENTS.md')) {
          return '# Agents'
        }
        if (p === mockPath('.CLAUDE.md')) {
          return '# Claude'
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
    expect(result['~/.knowledge.md']).toBe('# Knowledge')
  })
})
