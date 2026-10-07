/**
 * FID-2026-1007-002 — pins for the module-state audit.
 *
 * Two halves, both load-bearing. The fixtures pin what the scanner must and
 * must NOT call state (the false-positive classes are why a fan-out would
 * otherwise mint duplicate resets): a read-only constant is not state, a nested
 * declaration is not module scope, a WRAPPED declaration is still a candidate,
 * and an existing `__reset*`/`clear*` seam already counts as coverage. The
 * wiring fixtures pin the preload parser, including an aliased import. The live
 * repository leg pins the whole claim: every module-scope mutable binding in
 * this repository has a reset, a documented exemption, or a documented reason
 * for being unreachable from a preload — and every reset a preload imports
 * still exists and is still called.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { collectModuleStateAudit } from '../audit-module-state'
import { analyzeSource } from '../module-state-analyze'
import { isEntrypoint } from '../module-state-scan'
import {
  preloadModules,
  wiredModules,
  wiringIssues,
} from '../module-state-wiring'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function tempRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-module-state-'))
  tempRoots.push(root)
  return root
}

function write(root: string, relativePath: string, content: string): void {
  const target = path.join(root, relativePath)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, content)
}

describe('analyzeSource — what counts as module-scope state', () => {
  test('a read-only container constant is not state', () => {
    const result = analyzeSource(
      "const protocols = new Set(['http:', 'https:'])",
    )
    expect(result.findings).toEqual([])
    expect(result.constants).toBe(1)
  })

  test('a mutated Map is a finding when no reset names it', () => {
    const result = analyzeSource(
      ['const cache = new Map<string, number>()', "cache.set('a', 1)"].join(
        '\n',
      ),
    )
    expect(result.findings.map((finding) => finding.name)).toEqual(['cache'])
  })

  test('a reset naming the binding cures it', () => {
    const result = analyzeSource(
      [
        'const cache = new Map<string, number>()',
        "cache.set('a', 1)",
        'export function resetCache(): void {',
        '  cache.clear()',
        '}',
      ].join('\n'),
    )
    expect(result.findings).toEqual([])
    expect(result.cured.map((binding) => binding.reset)).toEqual(['resetCache'])
  })

  test('the older __reset* and clear* seams count as coverage, not as gaps', () => {
    const seams = [
      'export function __resetCacheForTests(): void {',
      'export function clearCacheForTesting(): void {',
    ]
    for (const seam of seams) {
      const result = analyzeSource(
        [
          'const cache = new Set<string>()',
          "cache.add('a')",
          seam,
          '  cache.clear()',
          '}',
        ].join('\n'),
      )
      expect(result.findings).toEqual([])
    }
  })

  test('a declaration wrapped across lines is still a candidate', () => {
    const result = analyzeSource(
      [
        'const listToolsCache: Record<',
        '  string,',
        '  Promise<unknown>',
        '> = {}',
        'listToolsCache[key] = value',
      ].join('\n'),
    )
    expect(result.findings.map((finding) => finding.name)).toEqual([
      'listToolsCache',
    ])
  })

  test('a module-scope let is state; a nested binding is not', () => {
    const moduleScope = analyzeSource(
      ['let counter = 0', 'counter += 1'].join('\n'),
    )
    expect(moduleScope.findings.map((finding) => finding.name)).toEqual([
      'counter',
    ])
    const nested = analyzeSource(
      [
        'function f(): void {',
        '  const nested = new Map<string, number>()',
        "  nested.set('a', 1)",
        '}',
      ].join('\n'),
    )
    expect(nested.findings).toEqual([])
  })

  test('a program entrypoint is reported as one', () => {
    expect(
      isEntrypoint(['if (import.meta.main) {', '  run()', '}'].join('\n')),
    ).toBe(true)
    expect(isEntrypoint('export function run(): void {}')).toBe(false)
  })
})

describe('preload wiring', () => {
  const RESET_MODULE = [
    'export function resetCache(): void {',
    '  cache.clear()',
    '}',
  ].join('\n')

  function wiringRoot(preloadBody: string): string {
    const root = tempRoot()
    write(root, 'package.json', JSON.stringify({ workspaces: ['w'] }, null, 2))
    write(root, 'w/bunfig.toml', '[test]\npreload = ["./test/preload.ts"]\n')
    write(root, 'w/test/preload.ts', preloadBody)
    write(root, 'w/src/mod.ts', RESET_MODULE)
    return root
  }

  test('an aliased import is still wiring', () => {
    const root = wiringRoot(
      [
        "import { resetCache as resetTheCache } from '../src/mod'",
        'resetTheCache()',
      ].join('\n'),
    )
    expect(preloadModules(root)).toEqual(['w/test/preload.ts'])
    expect([...(wiredModules(root).get('w/src/mod.ts') ?? [])].sort()).toEqual([
      'resetCache',
      'resetTheCache',
    ])
    expect(wiringIssues(root)).toEqual([])
  })

  test('an imported reset that is never called is reported', () => {
    const root = wiringRoot("import { resetCache } from '../src/mod'")
    expect(wiringIssues(root)).toEqual([
      'w/test/preload.ts: imports resetCache but never calls it — the reset exists and does nothing.',
    ])
  })

  test('an import of a reset the module no longer exports is reported', () => {
    const root = wiringRoot(
      ["import { resetGone } from '../src/mod'", 'resetGone()'].join('\n'),
    )
    expect(wiringIssues(root)[0]).toContain('does not export it')
  })
})

describe('live repository', () => {
  test('every module-scope binding is cured, exempted or explained', () => {
    let root = import.meta.dir
    while (!isRepositoryRoot(root)) {
      const parent = path.dirname(root)
      if (parent === root) break
      root = parent
    }
    const report = collectModuleStateAudit(root)
    expect(report.wiringIssues).toEqual([])
    expect(report.findings).toEqual([])
    expect(report.wired).toBeGreaterThan(100)
  })
})

/** The repository root is the directory holding `SCOPE.md` and `package.json`. */
function isRepositoryRoot(dir: string): boolean {
  return (
    existsSync(path.join(dir, 'SCOPE.md')) &&
    existsSync(path.join(dir, 'package.json'))
  )
}
