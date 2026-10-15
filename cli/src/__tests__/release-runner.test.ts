import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { describe, expect, test } from 'bun:test'

import {
  RELEASE_COMMAND_DIAGNOSE,
  RELEASE_COMMAND_GO,
  RELEASE_COMMAND_PREVIEW,
  RELEASE_COMMAND_RESUME,
  RELEASE_COMMAND_STATUS,
  RELEASE_SCRIPT_RELATIVE,
  buildReleaseCommandLine,
  getReleaseStatus,
  latestReleaseEvidence,
  normalizeReleaseCommand,
  releaseScriptFlags,
  resolveReleaseRoot,
  spawnReleaseScript,
} from '../commands/release/release-runner'

function tempRoot(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'savant-release-cli-test-'))
  mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  return dir
}

describe('release command core', () => {
  test('normalizes operations and aliases', () => {
    expect(normalizeReleaseCommand('preview')).toBe(RELEASE_COMMAND_PREVIEW)
    expect(normalizeReleaseCommand('PREVIEW')).toBe(RELEASE_COMMAND_PREVIEW)
    expect(normalizeReleaseCommand('diagnose')).toBe(RELEASE_COMMAND_DIAGNOSE)
    expect(normalizeReleaseCommand('diagnostic')).toBe(RELEASE_COMMAND_DIAGNOSE)
    expect(normalizeReleaseCommand('go')).toBe(RELEASE_COMMAND_GO)
    expect(normalizeReleaseCommand('release')).toBe(RELEASE_COMMAND_GO)
    expect(normalizeReleaseCommand('run')).toBe(RELEASE_COMMAND_GO)
    expect(normalizeReleaseCommand('resume')).toBe(RELEASE_COMMAND_RESUME)
    expect(normalizeReleaseCommand('continue')).toBe(RELEASE_COMMAND_RESUME)
    expect(normalizeReleaseCommand('status')).toBe(RELEASE_COMMAND_STATUS)
    expect(normalizeReleaseCommand('check')).toBe(RELEASE_COMMAND_STATUS)
    expect(normalizeReleaseCommand('state')).toBe(RELEASE_COMMAND_STATUS)
    expect(normalizeReleaseCommand('')).toBeUndefined()
    expect(normalizeReleaseCommand('nonsense')).toBeUndefined()
    expect(normalizeReleaseCommand(undefined)).toBeUndefined()
  })

  test('maps operations to release script flags', () => {
    expect(releaseScriptFlags(RELEASE_COMMAND_PREVIEW)).toEqual(['--preview'])
    expect(releaseScriptFlags(RELEASE_COMMAND_DIAGNOSE)).toEqual(['--diagnose'])
    expect(releaseScriptFlags(RELEASE_COMMAND_RESUME)).toEqual(['--resume'])
    expect(releaseScriptFlags(RELEASE_COMMAND_GO)).toEqual([])
    expect(releaseScriptFlags(RELEASE_COMMAND_STATUS)).toEqual([])
    expect(buildReleaseCommandLine(RELEASE_COMMAND_PREVIEW)).toBe(
      'bun run scripts/public-release.ts --preview',
    )
    expect(buildReleaseCommandLine(RELEASE_COMMAND_GO)).toBe(
      'bun run scripts/public-release.ts',
    )
  })

  test('resolves the release root by walking up the tree', () => {
    const root = tempRoot()
    try {
      writeFileSync(path.join(root, RELEASE_SCRIPT_RELATIVE), '// engine\n')
      const nested = path.join(root, 'a', 'b', 'c')
      mkdirSync(nested, { recursive: true })
      expect(resolveReleaseRoot(nested)).toBe(root)
      expect(resolveReleaseRoot(root)).toBe(root)
      expect(resolveReleaseRoot(os.tmpdir())).toBeUndefined()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('spawns the release script with flags and streams chunks', async () => {
    const root = tempRoot()
    try {
      writeFileSync(
        path.join(root, RELEASE_SCRIPT_RELATIVE),
        [
          "console.log('ENGINE-ARGV:' + process.argv.slice(2).join(','))",
          "console.error('ENGINE-ERR-LINE')",
          'process.exit(0)',
        ].join('\n'),
      )
      const chunks: string[] = []
      const result = await spawnReleaseScript({
        root,
        command: 'bun run scripts/public-release.ts --preview',
        flags: ['--preview'],
        onOutput: (chunk, stream) => chunks.push(`${stream}:${chunk}`),
      })
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('ENGINE-ARGV:--preview')
      expect(result.stderr).toContain('ENGINE-ERR-LINE')
      expect(chunks.some((c) => c.includes('ENGINE-ARGV:--preview'))).toBe(true)
      expect(result.command).toBe('bun run scripts/public-release.ts --preview')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('propagates a non-zero exit from the release engine', async () => {
    const root = tempRoot()
    try {
      writeFileSync(
        path.join(root, RELEASE_SCRIPT_RELATIVE),
        'console.error("gate failed"); process.exit(7)\n',
      )
      const result = await spawnReleaseScript({
        root,
        command: 'bun run scripts/public-release.ts',
      })
      expect(result.exitCode).toBe(7)
      expect(result.stderr).toContain('gate failed')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('status reads version, receipts, and git position without throwing', () => {
    const root = tempRoot()
    const receiptDir = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-evidence-'),
    )
    try {
      writeFileSync(path.join(root, 'VERSION'), '0.0.99\n')
      writeFileSync(
        path.join(receiptDir, 'savant-public-release-0.0.99.json'),
        JSON.stringify({
          version: '0.0.99',
          mode: 'publish',
          headSha: 'a'.repeat(40),
          completedStages: ['PREFLIGHT', 'AUTHENTICATION'],
          failedStage: 'GATES_AND_PACKAGE_DRY_RUNS',
          restored: false,
        }),
      )
      writeFileSync(
        path.join(receiptDir, 'savant-public-release-0.0.99-diagnostic.json'),
        JSON.stringify({
          version: '0.0.99',
          mode: 'publish',
          evidenceFinalized: true,
        }),
      )

      const { receipt, diagnostic } = latestReleaseEvidence(receiptDir)
      expect(receipt?.version).toBe('0.0.99')
      expect(receipt?.failedStage).toBe('GATES_AND_PACKAGE_DRY_RUNS')
      expect(diagnostic?.evidenceFinalized).toBe(true)

      const status = getReleaseStatus({ root, receiptDir })
      expect(status).toContain('version:        0.0.99')
      expect(status).toContain('last receipt:')
      expect(status).toContain('diagnostic:')
      expect(status).toContain('PREFLIGHT,AUTHENTICATION')
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(receiptDir, { recursive: true, force: true })
    }
  })

  test('status reports unknown git state outside a repository', () => {
    const root = tempRoot()
    // Isolated empty receipt dir — the real OS temp dir may hold evidence from
    // actual release/diagnostic runs, which would make 'none' assertions fail.
    const receiptDir = mkdtempSync(
      path.join(os.tmpdir(), 'savant-release-empty-evidence-'),
    )
    try {
      writeFileSync(path.join(root, 'VERSION'), '0.0.99\n')
      const status = getReleaseStatus({ root, receiptDir })
      expect(status).toContain('version:        0.0.99')
      expect(status).toContain('branch:         unknown')
      expect(status).toContain('last receipt:   none')
      expect(status).toContain('diagnostic:     none')
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(receiptDir, { recursive: true, force: true })
    }
  })
})
