import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test, beforeEach } from 'bun:test'
import { z } from 'zod/v4'

// FID-2026-0819-005 Loop 286: the custom-definition, system-info, skills,
// and agent-state-init suites moved verbatim from
// initial-session-state.test.ts; harness (mockFs/mockLogger beforeEach)
// copied verbatim.
import { initialSessionState } from '../run-state'

import type { MockStatResult } from '@savant-code/common/testing/mock-types'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { ProcessedAgentTemplate } from '@savant-code/common/util/file'

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

  test('includes custom agent definitions', async () => {
    const projectFiles = {
      'src/index.ts': 'console.log("Hello world");',
    }

    const agentDefinitions = [
      {
        id: 'custom-agent',
        displayName: 'Custom Agent',
        spawnerPrompt: 'A custom agent',
        model: 'anthropic/claude-4-sonnet-20250522',
        outputMode: 'last_message' as const,
        includeMessageHistory: false,
        inheritParentSystemPrompt: false,
        mcpServers: {},
        toolNames: [],
        spawnableAgents: [],
        inputSchema: {},
        systemPrompt: 'Custom system prompt',
        instructionsPrompt: '',
        stepPrompt: '',
      },
    ]

    const sessionState = await initialSessionState({
      cwd: '/test-project',
      projectFiles,
      agentDefinitions,
      fs: mockFs,
      logger: mockLogger,
    })

    expect(sessionState.fileContext.agentTemplates).toBeDefined()
    expect(
      sessionState.fileContext.agentTemplates['custom-agent'],
    ).toBeDefined()
    expect(
      (
        sessionState.fileContext.agentTemplates[
          'custom-agent'
        ] as ProcessedAgentTemplate
      ).displayName,
    ).toBe('Custom Agent')
  })

  test('includes custom tool definitions', async () => {
    const projectFiles = {
      'src/index.ts': 'console.log("Hello world");',
    }

    const inputSchema = z.object({ input: z.string() })
    const customToolDefinitions = [
      {
        toolName: 'custom_tool',
        inputSchema,
        description: 'A custom tool',
        endsAgentStep: false,
        exampleInputs: [],
        execute: async (_input: Record<string, string>) => [],
      },
    ]

    const sessionState = await initialSessionState({
      cwd: '/test-project',
      projectFiles,
      customToolDefinitions,
      fs: mockFs,
      logger: mockLogger,
    })

    expect(sessionState.fileContext.customToolDefinitions).toBeDefined()
    expect(
      sessionState.fileContext.customToolDefinitions?.['custom_tool'],
    ).toBeDefined()
    expect(
      sessionState.fileContext.customToolDefinitions?.['custom_tool']
        ?.description,
    ).toBe('A custom tool')
  })

  test('populates system info correctly', async () => {
    const projectFiles = {
      'src/index.ts': 'console.log("Hello world");',
    }

    const sessionState = await initialSessionState({
      cwd: '/test-project',
      projectFiles,
      fs: mockFs,
      logger: mockLogger,
    })

    expect(sessionState.fileContext.systemInfo).toBeDefined()
    expect(sessionState.fileContext.systemInfo.platform).toBe(process.platform)
    expect(sessionState.fileContext.systemInfo.shell).toBeDefined()
    expect(sessionState.fileContext.systemInfo.nodeVersion).toBe(
      process.version,
    )
    expect(sessionState.fileContext.systemInfo.cpus).toBeGreaterThan(0)
  })

  test('loads skills from skillsDir when provided', async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'sdk-skills-test-'))
    try {
      const skillDir = path.join(tmpDir, 'my-skill')
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        [
          '---',
          'name: my-skill',
          'description: A test skill',
          '---',
          '',
          '# My Skill',
          '',
          'Some instructions here.',
        ].join('\n'),
      )

      const sessionState = await initialSessionState({
        cwd: '/test-project',
        skillsDir: tmpDir,
        projectFiles: { 'src/index.ts': 'console.log("hello");' },
        fs: mockFs,
        logger: mockLogger,
      })

      expect(sessionState.fileContext.skills).toBeDefined()
      expect(sessionState.fileContext.skills!['my-skill']).toBeDefined()
      expect(sessionState.fileContext.skills!['my-skill'].name).toBe('my-skill')
      expect(sessionState.fileContext.skills!['my-skill'].description).toBe(
        'A test skill',
      )
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('skillsDir with no valid skills results in empty skills map', async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'sdk-skills-test-'))
    try {
      const sessionState = await initialSessionState({
        cwd: '/test-project',
        skillsDir: tmpDir,
        projectFiles: { 'src/index.ts': 'console.log("hello");' },
        fs: mockFs,
        logger: mockLogger,
      })

      expect(sessionState.fileContext.skills).toBeDefined()
      expect(Object.keys(sessionState.fileContext.skills!)).toHaveLength(0)
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  test('initializes empty agent state correctly', async () => {
    const projectFiles = {
      'src/index.ts': 'console.log("Hello world");',
    }

    const sessionState = await initialSessionState({
      cwd: '/test-project',
      projectFiles,
      fs: mockFs,
      logger: mockLogger,
    })

    expect(sessionState.mainAgentState.agentId).toBe('main-agent')
    expect(sessionState.mainAgentState.agentType).toBeNull()
    expect(sessionState.mainAgentState.agentContext).toEqual({})
    expect(sessionState.mainAgentState.ancestorRunIds).toEqual([])
    expect(sessionState.mainAgentState.subagents).toEqual([])
    expect(sessionState.mainAgentState.childRunIds).toEqual([])
    expect(sessionState.mainAgentState.messageHistory).toEqual([])
    expect(sessionState.mainAgentState.creditsUsed).toBe(0)
    expect(sessionState.mainAgentState.directCreditsUsed).toBe(0)
    expect(sessionState.mainAgentState.output).toBeUndefined()
    expect(sessionState.mainAgentState.parentId).toBeUndefined()
  })
})
