/**
 * FID-2026-1006-004 pin-hardening, generalized: a test helper must never call
 * a budgeted function without injecting the budget (see
 * `../audit-test-budget-injection.ts`). These pins cover both directions —
 * the scanner's findings on a planted tree, and the live tree staying clean.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import {
  BUDGETED_FUNCTIONS,
  callArgumentTexts,
  collectTestBudgetIssues,
  hasInjectedBudget,
  isHelperModule,
  isTestFile,
  maskNonCode,
} from '../audit-test-budget-injection'

const repoRoot = join(import.meta.dir, '..', '..')

const tempRoots: string[] = []
afterEach(() => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function write(root: string, relative: string, content: string): void {
  const absolute = join(root, relative)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

/**
 * A root carrying registry source files whose signatures DO declare the
 * registered budget parameter, so only the call-site findings under test can
 * appear. Derived from the registry, so a new entry cannot silently make these
 * fixtures report `registry-missing-source` instead.
 */
function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'budget-injection-'))
  tempRoots.push(root)
  for (const entry of BUDGETED_FUNCTIONS) {
    write(
      root,
      entry.source,
      `export function ${entry.name}(params: { ${entry.param}?: number }) {\n  return params.${entry.param}\n}\n`,
    )
  }
  return root
}

describe('test-budget-injection scanner', () => {
  it('accepts a call that names the parameter, and refuses one that does not', () => {
    expect(hasInjectedBudget(' { repoRoot, budgetMs: 0 } ', 'budgetMs')).toBe(
      true,
    )
    expect(
      hasInjectedBudget(' { repoRoot, budgetMs: PIN_BUDGET_MS } ', 'budgetMs'),
    ).toBe(true)
    expect(hasInjectedBudget(' { repoRoot } ', 'budgetMs')).toBe(false)
    // A positional call naming an uppercase constant is injected…
    expect(hasInjectedBudget('root, PIN_BUDGET_MS', 'budgetMs')).toBe(true)
    // …but a lookalike parameter is not the seam (no word boundary).
    expect(hasInjectedBudget(' { headerBudgetMs: 5 } ', 'budgetMs')).toBe(false)
  })

  it('masks comments and string contents so a quoted call is not a finding', () => {
    const masked = maskNonCode(
      "// reconcileWorktree({ repoRoot })\nconst s = 'reconcileWorktree({ repoRoot })'\n",
    )
    expect(masked).not.toContain('reconcileWorktree')
    expect(callArgumentTexts(masked, 'reconcileWorktree')).toEqual([])
  })

  it('extracts balanced argument text across nested braces and parens', () => {
    const source =
      'reconcileWorktree({ a: f(1, 2), b: { c: [3] }, dirtyFiles })'
    expect(callArgumentTexts(maskNonCode(source), 'reconcileWorktree')).toEqual(
      ['{ a: f(1, 2), b: { c: [3] }, dirtyFiles }'],
    )
  })

  it('separates helper modules from test files', () => {
    expect(isHelperModule('packages/x/src/__tests__/thing-fixtures.ts')).toBe(
      true,
    )
    expect(isHelperModule('packages/x/src/__tests__/thing.test.ts')).toBe(false)
    expect(isHelperModule('packages/x/src/thing.ts')).toBe(false)
    expect(isTestFile('packages/x/src/__tests__/thing.test.ts')).toBe(true)
  })
})

describe('test-budget-injection findings (RED legs on a planted tree)', () => {
  it('fails a shared helper module that omits the budget', () => {
    const root = fixtureRoot()
    write(
      root,
      'packages/agent-runtime/src/echo/__tests__/planted-fixtures.ts',
      'import { reconcileWorktree } from "../enforcement/worktree-reconcile"\n' +
        'export function run(root: string) {\n' +
        '  return reconcileWorktree({ checkpoint, repoRoot: root })\n' +
        '}\n',
    )
    const issues = collectTestBudgetIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('test-budget.uninjected-helper-call')
    expect(issues[0].message).toContain('test helper module')
    expect(issues[0].message).toContain('RECONCILE_BUDGET_MS')
  })

  it('fails a local helper declaration in a test file, but not a test body', () => {
    const root = fixtureRoot()
    write(
      root,
      'packages/agent-runtime/src/echo/__tests__/planted.test.ts',
      'function wrap(root: string) {\n' +
        '  return reconcileWorktree({ repoRoot: root })\n' +
        '}\n' +
        "describe('x', () => {\n" +
        "  it('injects', () => {\n" +
        '    reconcileWorktree({ repoRoot: root, budgetMs: PIN_BUDGET_MS })\n' +
        '  })\n' +
        "  it('inherits the default on purpose (allowed in a test body)', () => {\n" +
        '    reconcileWorktree({ repoRoot: root })\n' +
        '  })\n' +
        '})\n',
    )
    const issues = collectTestBudgetIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('test helper `wrap`')
    expect(issues[0].message).toContain('planted.test.ts:2')
  })

  it('fails loudly when the registry names a parameter the source no longer has', () => {
    const root = fixtureRoot()
    const entry = BUDGETED_FUNCTIONS[0]
    write(root, entry.source, `export function ${entry.name}(params: {}) {}\n`)
    const issues = collectTestBudgetIssues(root)
    expect(issues.map((issue) => issue.code)).toContain(
      'test-budget.registry-stale',
    )
  })

  it('fails loudly when a registry source file is missing', () => {
    const root = fixtureRoot()
    rmSync(join(root, BUDGETED_FUNCTIONS[0].source))
    const issues = collectTestBudgetIssues(root)
    expect(issues.map((issue) => issue.code)).toContain(
      'test-budget.registry-missing-source',
    )
  })
})

describe('test-budget-injection on this repository', () => {
  it('is clean: no helper silently inherits a production budget', () => {
    expect(collectTestBudgetIssues(repoRoot)).toEqual([])
  })
})
