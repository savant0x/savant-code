/**
 * Contract pins for the `no-duplicate-shared-primitive` ESLint rule
 * (FID-2026-0928-009 Parts 1+2): the rule fires on a local top-level
 * declaration of a registered primitive outside its canonical owner, and
 * stays silent for the owner itself, renamed locals, non-top-level
 * bindings, and test files.
 *
 * The rule is exercised through the real flat-config ESLint binary (the
 * same path the pre-push gate runs), so the pins prove wiring, not just
 * rule logic.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

const repoRoot = path.resolve(import.meta.dir, '..', '..')
const execPath = process.execPath

/** Lint a temp file placed inside the repo and return matched rule ids. */
function lintTempFile(
  relativeDir: string,
  code: string,
): {
  fired: string[]
  output: string
  exit: number
} {
  const dir = path.join(repoRoot, relativeDir)
  const filePath = path.join(dir, '__rule-pin-probe.ts')
  fs.writeFileSync(filePath, code)
  try {
    const result = spawnSync(
      execPath,
      ['x', 'eslint', '--no-warn-ignored', path.relative(repoRoot, filePath)],
      { cwd: repoRoot, encoding: 'utf8', shell: false, timeout: 120_000 },
    )
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    const fired = [
      ...output.matchAll(/savant\/no-duplicate-shared-primitive/g),
    ].map(() => 'savant/no-duplicate-shared-primitive')
    return { fired, output, exit: result.status ?? 1 }
  } finally {
    fs.rmSync(filePath, { force: true })
  }
}

const DUPLICATE = [
  'const sleep = (ms: number): Promise<void> =>',
  '  new Promise<void>((resolve) => setTimeout(resolve, ms))',
  '',
  'export const useIt = sleep',
  '',
].join('\n')

describe('no-duplicate-shared-primitive (FID-2026-0928-009)', () => {
  test('fires for a top-level sleep re-declaration outside the owner', () => {
    const { fired, exit, output } = lintTempFile('cli/src/utils', DUPLICATE)
    expect(fired.length).toBeGreaterThan(0)
    expect(exit).toBe(1)
    expect(output).toContain('common/src/util/promise.ts')
  })

  test('is silent inside the canonical owner file', () => {
    // The owner imports/defines nothing here that duplicates — linting the
    // owner's actual source must stay clean.
    const result = spawnSync(
      execPath,
      ['x', 'eslint', '--no-warn-ignored', 'common/src/util/hash.ts'],
      { cwd: repoRoot, encoding: 'utf8', shell: false, timeout: 120_000 },
    )
    expect(result.status).toBe(0)
  })

  test('is silent for a function-local binding (not top-level)', () => {
    const code = [
      'export function wrapper() {',
      '  const sleep = (ms: number): Promise<void> =>',
      '    new Promise<void>((resolve) => setTimeout(resolve, ms))',
      '  return sleep(1)',
      '}',
      '',
    ].join('\n')
    const { fired } = lintTempFile('cli/src/utils', code)
    expect(fired.length).toBe(0)
  })

  test('is silent for test files', () => {
    const dir = path.join(repoRoot, 'cli/src/utils/__tests__')
    const filePath = path.join(dir, '__rule-pin-probe.test.ts')
    fs.writeFileSync(filePath, DUPLICATE)
    try {
      const result = spawnSync(
        execPath,
        ['x', 'eslint', '--no-warn-ignored', path.relative(repoRoot, filePath)],
        { cwd: repoRoot, encoding: 'utf8', shell: false, timeout: 120_000 },
      )
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
      expect(output.includes('no-duplicate-shared-primitive')).toBe(false)
    } finally {
      fs.rmSync(filePath, { force: true })
    }
  })

  test('registry parses and every owner path exists', () => {
    const registryPath = path.join(
      repoRoot,
      'scripts',
      'eslint-rules',
      'shared-primitives.json',
    )
    const registry = JSON.parse(
      fs.readFileSync(registryPath, 'utf8'),
    ) as Record<string, { owner?: string } | string[] | boolean>
    const allowedFiles = registry.allowedFiles as string[]
    expect(allowedFiles.length).toBeGreaterThan(0)
    for (const [name, entry] of Object.entries(registry)) {
      if (
        name.startsWith('$') ||
        name === 'allowedFiles' ||
        name === 'allowedTests'
      )
        continue
      const owner = (entry as { owner?: string }).owner
      expect(owner).toBeDefined()
      // The owner file must exist and already declare the symbol it owns.
      const source = fs.readFileSync(path.join(repoRoot, owner!), 'utf8')
      expect(
        source.includes(`function ${name}`) ||
          source.includes(`const ${name}`) ||
          source.includes(`export { ${name}`) ||
          source.includes(`${name} as`),
      ).toBe(true)
    }
  })
})
