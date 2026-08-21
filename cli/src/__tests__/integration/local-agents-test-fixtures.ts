import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { mock } from 'bun:test'

import { setProjectRoot, getProjectRoot } from '../../project-files'
import { __resetLocalAgentRegistryForTests } from '../../utils/local-agent-registry'

// Mock the logger to prevent analytics initialization errors in tests.
mock.module('../../utils/logger', () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
  },
}))

export const MODEL_NAME = 'anthropic/claude-sonnet-4'

export interface LocalAgentsTestContext {
  tempDir: string
  agentsDir: string
  originalCwd: string
  originalProjectRoot: string | undefined
}

export function setupLocalAgentsTest(): LocalAgentsTestContext {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'savant-code-agents-'))
  const originalCwd = process.cwd()
  setProjectRoot(originalCwd)
  const originalProjectRoot = getProjectRoot()

  process.chdir(tempDir)
  setProjectRoot(tempDir)
  __resetLocalAgentRegistryForTests()

  return {
    tempDir,
    agentsDir: path.join(tempDir, '.agents'),
    originalCwd,
    originalProjectRoot,
  }
}

export function cleanupLocalAgentsTest(context: LocalAgentsTestContext): void {
  process.chdir(context.originalCwd)
  setProjectRoot(context.originalProjectRoot ?? context.originalCwd)
  __resetLocalAgentRegistryForTests()
  rmSync(context.tempDir, { recursive: true, force: true })
  mock.restore()
}

export function writeAgentFile(
  agentsDir: string,
  fileName: string,
  contents: string,
): void {
  writeFileSync(path.join(agentsDir, fileName), contents, 'utf8')
}
