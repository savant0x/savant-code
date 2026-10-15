import path from 'path'

import { describe, expect, test, beforeEach } from 'bun:test'

import { initialSessionState } from '../run-state'

import type { MockStatResult } from '@savant-code/common/testing/mock-types'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'

describe('Initial Session State', () => {
  let mockFs: SavantCodeFileSystem
  let mockLogger: Logger

  beforeEach(() => {
    mockFs = {
      readFile: async (path: string) => {
        if (path.includes('src/index.ts')) {
          return 'console.log("Hello world");'
        }
        if (path.includes('src/utils.ts')) {
          return 'export function add(a: number, b: number) { return a + b; }'
        }
        if (path.includes('knowledge.md')) {
          return '# Knowledge\n\nThis is a knowledge file.'
        }
        if (path.includes('README.md')) {
          return '# Project\n\nThis is a readme.'
        }
        if (path.includes('.gitignore')) {
          return 'node_modules/\n.git/'
        }
        if (path.includes('.savantignore')) {
          return ''
        }
        if (path.includes('.savantignore')) {
          return ''
        }
        throw new Error(`File not found: ${path}`)
      },
      readdir: async (path: string) => {
        // Top-level mock kept for tests that use projectFiles (these tests don't
        // exercise getProjectFileTree, so the shape of readdir's return doesn't
        // matter for them). Use plain strings + inclusive matches so this mock
        // is portable to Windows where path.join may produce backslashes.
        if (path.includes('test-project')) {
          return ['src', '.git', 'knowledge.md', 'README.md', '.gitignore']
        }
        if (path.includes('src')) {
          return ['index.ts', 'utils.ts']
        }
        return []
      },
      // FID-016 Fix D: parameter named `filePath` (not `path`) so it doesn't
      // shadow the imported node:path module. path.basename(filePath) gives the
      // cross-platform final path component so /test-project/src/index.ts is
      // correctly classified as a file (basename 'index.ts'), not a directory.
      stat: async (filePath: string): Promise<MockStatResult> => {
        const basename = path.basename(filePath)
        const isDirectory = basename === 'src' || basename === '.git'
        return {
          isDirectory: () => isDirectory,
          isFile: () => !isDirectory,
        }
      },
      exists: async (path: string) => {
        if (path.includes('.gitignore')) return true
        if (path.includes('.savantignore')) return true
        if (path.includes('.savantignore')) return true
        if (path.includes('src')) return true
        if (path.includes('.git')) return true
        if (path.includes('knowledge.md')) return true
        if (path.includes('README.md')) return true
        return false
      },
      mkdir: async () => {},
      writeFile: async () => {},
    } as unknown as SavantCodeFileSystem

    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
  })

  test('creates initial session state with explicit projectFiles', async () => {
    const projectFiles = {
      'src/index.ts': 'console.log("Hello world");',
      'src/utils.ts':
        'export function add(a: number, b: number) { return a + b; }',
      'knowledge.md': '# Knowledge\n\nThis is a knowledge file.',
    }

    const sessionState = await initialSessionState({
      cwd: '/test-project',
      projectFiles,
      fs: mockFs,
      logger: mockLogger,
    })

    expect(sessionState.fileContext.fileTree).toBeDefined()
    expect(sessionState.fileContext.fileTree.length).toBeGreaterThan(0)
    expect(sessionState.fileContext.fileTokenScores).toBeDefined()
    expect(sessionState.mainAgentState.agentId).toBe('main-agent')
    expect(sessionState.mainAgentState.messageHistory).toEqual([])
  })

  test('discovers project files automatically when projectFiles is undefined', async () => {
    // FID-016 Fix D: readdir returns plain strings (matches Node default behavior
    // and the SavantCodeFileSystem type). getProjectFileTree iterates strings then
    // calls fs.stat(path.join(fullPath, file)) to decide file vs directory.
    // Normalize dirPath so comparison works on Windows where path.join uses backslashes.
    const normDir = (p: string) => p.replace(/\\/g, '/')
    mockFs.readdir = (async (dirPath: string) => {
      const norm = normDir(dirPath)
      if (norm === '/test-project') {
        return ['src', '.git', 'knowledge.md', 'README.md', '.gitignore']
      }
      if (norm === '/test-project/src') {
        return ['index.ts', 'utils.ts', 'generated.ts']
      }
      return []
    }) as SavantCodeFileSystem['readdir']

    // FID-016 Fix D: stat receives path.join(fullPath, entry). Use path.basename
    // (cross-platform) so we only match the final path component (avoids false
    // positives where filePath is e.g. /test-project/src/index.ts but basename
    // is index.ts, not src).
    mockFs.stat = (async (filePath: string) => {
      const basename = path.basename(filePath)
      const isDirectory = basename === 'src' || basename === '.git'
      return {
        isDirectory: () => isDirectory,
        isFile: () => !isDirectory,
        size: basename === 'generated.ts' ? 1_000_001 : 100,
      }
    }) as SavantCodeFileSystem['stat']

    const readFilePaths: string[] = []
    const originalReadFile = mockFs.readFile
    mockFs.readFile = (async (filePath: string, encoding?: BufferEncoding) => {
      readFilePaths.push(filePath)
      return originalReadFile(filePath, encoding)
    }) as SavantCodeFileSystem['readFile']

    const sessionState = await initialSessionState({
      cwd: '/test-project',
      projectFiles: undefined,
      fs: mockFs,
      logger: mockLogger,
    })

    expect(sessionState.fileContext.fileTree).toBeDefined()
    expect(sessionState.mainAgentState.agentId).toBe('main-agent')
    expect(sessionState.mainAgentState.messageHistory).toEqual([])
    // Cross-platform path suffix check: endsWith is separator-sensitive, so
    // 'src/index.ts' won't match 'src\\index.ts' on Windows where path.join
    // uses backslashes. Accept both forms.
    const endsWithSegment = (segment: string) => (p: string) =>
      p.endsWith(`src${path.sep}${segment}`) || p.endsWith(`src/${segment}`)
    const endsWithRoot = (name: string) => (p: string) =>
      p.endsWith(`${path.sep}${name}`) || p.endsWith(`/${name}`)

    expect(readFilePaths.some(endsWithSegment('index.ts'))).toBe(true)
    expect(readFilePaths.some(endsWithSegment('utils.ts'))).toBe(true)
    expect(readFilePaths.some(endsWithSegment('generated.ts'))).toBe(false)
    expect(readFilePaths.some(endsWithRoot('README.md'))).toBe(false)
    expect(readFilePaths.some(endsWithRoot('knowledge.md'))).toBe(true)
  })

  test('derives knowledgeFiles from projectFiles when not provided', async () => {
    const projectFiles = {
      'src/index.ts': 'console.log("Hello world");',
      'knowledge.md': '# Knowledge\n\nThis is a knowledge file.',
      'claude.md': '# Claude context\n\nThis is claude context.',
      'README.md': '# Project\n\nThis is a readme.',
    }

    const sessionState = await initialSessionState({
      cwd: '/test-project',
      projectFiles,
      knowledgeFiles: undefined,
      fs: mockFs,
      logger: mockLogger,
    })

    expect(sessionState.fileContext.knowledgeFiles).toBeDefined()
    expect(sessionState.fileContext.knowledgeFiles['knowledge.md']).toBe(
      '# Knowledge\n\nThis is a knowledge file.',
    )
    expect(sessionState.fileContext.knowledgeFiles['claude.md']).toBeUndefined()
    expect(sessionState.fileContext.knowledgeFiles['README.md']).toBeUndefined()
  })

  test('derives reads knowledgeFiles from claude.md when knowledge.md is not present', async () => {
    const projectFiles = {
      'src/index.ts': 'console.log("Hello world");',
      'claude.md': '# Claude context\n\nThis is claude context.',
      'README.md': '# Project\n\nThis is a readme.',
    }

    const sessionState = await initialSessionState({
      cwd: '/test-project',
      projectFiles,
      knowledgeFiles: undefined,
      fs: mockFs,
      logger: mockLogger,
    })

    expect(sessionState.fileContext.knowledgeFiles).toBeDefined()
    expect(
      sessionState.fileContext.knowledgeFiles['knowledge.md'],
    ).toBeUndefined()
    expect(sessionState.fileContext.knowledgeFiles['claude.md']).toEqual(
      '# Claude context\n\nThis is claude context.',
    )
    expect(sessionState.fileContext.knowledgeFiles['README.md']).toBeUndefined()
  })

  test('respects explicit knowledgeFiles when provided', async () => {
    const projectFiles = {
      'src/index.ts': 'console.log("Hello world");',
      'knowledge.md': '# Knowledge\n\nThis is a knowledge file.',
    }

    const knowledgeFiles = {
      'custom-knowledge.md': '# Custom Knowledge\n\nThis is custom knowledge.',
    }

    const sessionState = await initialSessionState({
      cwd: '/test-project',
      projectFiles,
      knowledgeFiles,
      fs: mockFs,
      logger: mockLogger,
    })

    expect(sessionState.fileContext.knowledgeFiles).toEqual(knowledgeFiles)
    expect(
      sessionState.fileContext.knowledgeFiles['knowledge.md'],
    ).toBeUndefined()
  })

  test('sets maxAgentSteps when provided', async () => {
    const projectFiles = {
      'src/index.ts': 'console.log("Hello world");',
    }

    const sessionState = await initialSessionState({
      cwd: '/test-project',
      projectFiles,
      maxAgentSteps: 10,
      fs: mockFs,
      logger: mockLogger,
    })

    expect(sessionState.mainAgentState.stepsRemaining).toBe(10)
  })
})
