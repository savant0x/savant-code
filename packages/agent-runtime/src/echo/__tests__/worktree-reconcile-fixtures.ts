/**
 * Shared fixtures for the worktree-reconciliation suites
 * (FID-2026-1001-003 step 2). Not a test file — bun test only picks up
 * `*.test.ts`; this module holds the temp-repo and agent-state builders so
 * the suites stay under the 300-line cap.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, expect } from 'bun:test'

import { EchoEnforcement } from '../enforcement'
import { createGroundingCheckpoint, isAgentGrounded } from '../grounding'

import type {
  AgentState,
  GroundingCheckpoint,
} from '@savant-code/common/types/session-state'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

/**
 * Grounded agent-state stub carrying a REAL grounding checkpoint (the
 * constructor hydrates only when `isAgentGrounded` passes, which requires a
 * fully-completed real checkpoint — no type-cast lies on the grounding
 * fields).
 */
export function groundedAgentState(): AgentState {
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
  agentState.groundingCheckpoint = checkpoint
  expect(isAgentGrounded(agentState)).toBe(true)
  return agentState
}

/** A real git repo with one committed file — git mode exercised for real. */
export function tempGitRepo(): { root: string; file: string } {
  const root = mkdtempSync(join(tmpdir(), 'law15-reconcile-'))
  tempDirs.push(root)
  const file = join(root, 'tracked.ts')
  writeFileSync(file, 'export const original = 1\n')
  const git = (args: string[]) =>
    spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  git(['init', '--initial-branch=main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'test'])
  git(['add', '.'])
  git(['commit', '-m', 'init', '--no-gpg-sign'])
  return { root, file }
}

/** Bypass route simulation: mutate the tree with NO write tool involved. */
export function outOfBandEdit(file: string, content: string): void {
  writeFileSync(file, content)
}

/** Minimal grounded EchoEnforcement over an existing checkpoint. */
export function enforcementForCheckpoint(
  checkpoint: GroundingCheckpoint,
  mode: 'hybrid' | 'strict' = 'hybrid',
): EchoEnforcement {
  const agentState = {
    protocolFile: 'ECHO.md',
    parentId: undefined,
    messageHistory: [],
  } as unknown as AgentState
  agentState.groundingCheckpoint = checkpoint
  return new EchoEnforcement(mode, { agentState })
}
