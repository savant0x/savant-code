/**
 * Shared fixtures for the terminal-bypass suites (FID-2026-1001-003
 * step 1). Not a test file — bun test only picks up `*.test.ts`.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createGroundingCheckpoint } from '../grounding'

import type { EchoEnforcement } from '../enforcement'
import type {
  AgentState,
  GroundingCheckpoint,
} from '@savant-code/common/types/session-state'

/** Real, fully-grounded checkpoint (same construction as the step-3 suite). */
export function groundedCheckpoint(): GroundingCheckpoint {
  const agentState = {
    protocolFile: 'ECHO.md',
    parentId: undefined,
    messageHistory: [],
  } as unknown as AgentState
  const checkpoint = createGroundingCheckpoint(agentState)
  if (!checkpoint) throw new Error('checkpoint creation failed')
  checkpoint.requiredPaths = ['echo.md']
  checkpoint.completedPaths = ['echo.md']
  checkpoint.fullGroundingCompleted = true
  return checkpoint
}

/** Satisfies the session-init grounding gate. */
export function satisfyGate(enf: EchoEnforcement): void {
  enf.beforeToolCall({
    toolName: 'read_files',
    input: { paths: ['ECHO.md'] },
    agentId: 'savant',
  })
}

const tempDirs: string[] = []

/** Removes every temp dir created by `existingTempFile` in this run. */
export function cleanupTempDirs(): void {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * A REAL existing file: `isNewFile` is a raw existsSync, so Law 1's
 * terminal loop can only block a target that is actually on disk.
 */
export function existingTempFile(name = 'mod.ts'): string {
  const dir = mkdtempSync(join(tmpdir(), 'law1-terminal-'))
  tempDirs.push(dir)
  const target = join(dir, name)
  writeFileSync(target, 'export const value = 1\n')
  return target
}
