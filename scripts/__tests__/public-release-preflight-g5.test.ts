/**
 * Release-preflight G5 pins (FID-2026-1007-014): a verified recovery bundle
 * exists before the cut. Split from the combined G2/G5 suite under the
 * 300-line file cap; G2 lives in public-release-preflight-g2.test.ts.
 *
 * RED-first: no bundle check existed in the pre-audit family. Every pin runs
 * a fixture bundle directory through the check with an injected git runner,
 * so no live git state is needed.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { checkG5BundleState } from '../public-release/pre-audit-g2-g5'

import type { GitRun } from '../public-release/pre-audit-g2-g5'

const tempRoots: string[] = []
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function tempRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-preflight-'))
  tempRoots.push(root)
  return root
}

function bundleRun(markerSha: string, verifyOk: boolean): GitRun {
  return (_root: string, args: string[]) => {
    if (args[0] === 'rev-parse' && args[1] === '--verify') {
      return { status: 0, stdout: `${markerSha}\n`, stderr: '' }
    }
    if (args[0] === 'rev-parse') {
      return { status: 0, stdout: `${markerSha}\n`, stderr: '' }
    }
    if (args[0] === 'bundle') {
      return verifyOk
        ? { status: 0, stdout: 'verified', stderr: '' }
        : { status: 128, stdout: '', stderr: 'not a valid bundle' }
    }
    throw new Error(`unexpected git call: ${args.join(' ')}`)
  }
}

function bundleDirWith(root: string, files: string[]): string {
  const dir = path.join(root, 'bundles')
  mkdirSync(dir, { recursive: true })
  for (const name of files) writeFileSync(path.join(dir, name), 'x')
  return dir
}

const SHA = 'a'.repeat(40)

describe('checkG5BundleState', () => {
  it('passes a marked, present, verifying baseline', () => {
    const root = tempRoot()
    const dir = bundleDirWith(root, ['baseline.bundle'])
    const result = checkG5BundleState(root, bundleRun(SHA, true), {
      bundleDir: dir,
    })
    expect(result.findings).toEqual([])
  })

  it('blocks a missing marker (no recovery point of record)', () => {
    const root = tempRoot()
    const dir = bundleDirWith(root, ['baseline.bundle'])
    const gitFail: GitRun = () => ({ status: 128, stdout: '', stderr: 'boom' })
    const result = checkG5BundleState(root, gitFail, { bundleDir: dir })
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.severity).toBe('block')
    expect(result.findings[0]?.message).toContain('last-backup')
  })

  it('blocks a failing bundle verify, naming the file', () => {
    const root = tempRoot()
    const dir = bundleDirWith(root, ['baseline.bundle'])
    const result = checkG5BundleState(root, bundleRun(SHA, false), {
      bundleDir: dir,
    })
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.severity).toBe('block')
    expect(result.findings[0]?.message).toContain('baseline.bundle')
  })

  it('blocks an absent bundle directory', () => {
    const root = tempRoot()
    const result = checkG5BundleState(root, bundleRun(SHA, true), {
      bundleDir: path.join(root, 'nope'),
    })
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.severity).toBe('block')
  })

  it('blocks an empty bundle directory', () => {
    const root = tempRoot()
    const dir = bundleDirWith(root, [])
    const result = checkG5BundleState(root, bundleRun(SHA, true), {
      bundleDir: dir,
    })
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.severity).toBe('block')
  })

  it('warns (not blocks) when the marker trails HEAD', () => {
    const root = tempRoot()
    const dir = bundleDirWith(root, ['baseline.bundle'])
    const run: GitRun = (_r: string, args: string[]) => {
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        return { status: 0, stdout: `${SHA}\n`, stderr: '' }
      }
      if (args[0] === 'rev-parse') {
        return { status: 0, stdout: `${'b'.repeat(40)}\n`, stderr: '' }
      }
      return { status: 0, stdout: 'verified', stderr: '' }
    }
    const result = checkG5BundleState(root, run, { bundleDir: dir })
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]?.severity).toBe('warn')
  })
})
