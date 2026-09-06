// FID-2026-0906-007 — spawned-process env bootstrap pins.
//
// common/src/env.ts must find and load the repo-root .env.local (the CLI's
// load-dev-env.ts semantics: findUp, existing-env-wins, binary env.json
// precedence) so that every entrypoint importing @savant-code/common —
// root scripts, the pre-push hook's evals:smoke, spawned sidecars —
// self-bootstraps instead of throwing at import. The class pin (spawned
// import over a scrubbed env) fails today and is the regression guard.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { applyEnvLocalInto, findUpEnvLocal } from '../env-bootstrap'

const savedEnv = { ...process.env }

function makeTree(depth: number, envLocalContent: string): string {
  const root = mkdtempSync(join(tmpdir(), 'env-bootstrap-'))
  let dir = root
  for (let i = 0; i < depth; i++) {
    dir = join(dir, `level-${i}`)
    mkdirSync(dir)
  }
  writeFileSync(join(root, '.env.local'), envLocalContent)
  return dir
}

let cleanup: string | null = null

beforeEach(() => {
  cleanup = null
})

afterEach(() => {
  if (cleanup !== null) rmSync(cleanup, { recursive: true, force: true })
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key]
  }
  Object.assign(process.env, savedEnv)
})

describe('env-bootstrap (FID-2026-0906-007)', () => {
  test('findUpEnvLocal finds the root fixture from a deeply nested start dir', () => {
    const startDir = makeTree(4, 'A=1\n')
    cleanup = startDir
    const found = findUpEnvLocal(startDir)
    expect(found).not.toBeNull()
    expect(found?.endsWith('.env.local')).toBe(true)
  })

  test('applyEnvLocalInto: comments, export prefix, quotes, existing-env-wins', () => {
    const startDir = makeTree(
      1,
      [
        '# a comment',
        'PLAIN=value',
        'export EXPORTED=also-value',
        'QUOTED="spaced value"',
        "SINGLE='single quoted'",
        'EMPTY_OK=',
      ].join('\n'),
    )
    cleanup = startDir
    const target: Record<string, string | undefined> = {
      PLAIN: 'shell-wins',
      EXPORTED: undefined,
      QUOTED: undefined,
      SINGLE: undefined,
    }
    applyEnvLocalInto(target as NodeJS.ProcessEnv, startDir)
    expect(target.PLAIN).toBe('shell-wins')
    expect(target.EXPORTED).toBe('also-value')
    expect(target.QUOTED).toBe('spaced value')
    expect(target.SINGLE).toBe('single quoted')
  })

  test('findUpEnvLocal returns null when no fixture exists (does not throw)', () => {
    const root = mkdtempSync(join(tmpdir(), 'env-bootstrap-none-'))
    cleanup = root
    const nested = join(root, 'nested')
    mkdirSync(nested)
    expect(findUpEnvLocal(nested)).toBeNull()
  })

  test('CLASS PIN: a spawned import of common/src/env.ts over a scrubbed env succeeds when .env.local is findable', async () => {
    // The real repo root has .env.local with the 3 non-defaultable keys.
    // Scrub the shell env (the hook/spawn context) and import env.ts in a
    // child bun process — today this throws; after GREEN it must not.
    const child = Bun.spawnSync(
      [
        'bun',
        '-e',
        "await import('" +
          import.meta.dir +
          "/../../../common/src/env.ts'); console.log('BOOTSTRAP_OK')",
      ],
      {
        cwd: import.meta.dir,
        env: {
          PATH: process.env.PATH ?? '',
          SystemRoot: process.env.SystemRoot ?? '',
          // Deliberately NO NEXT_PUBLIC_* keys — the spawn context.
        },
      },
    )
    const stdout = new TextDecoder().decode(child.stdout)
    expect(child.exitCode).toBe(0)
    expect(stdout).toContain('BOOTSTRAP_OK')
  })
})
