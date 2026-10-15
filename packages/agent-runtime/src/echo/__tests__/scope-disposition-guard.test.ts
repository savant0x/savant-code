/**
 * FID-2026-0919-024 — the scope-disposition guard.
 *
 * The regression being pinned is governance, not code: the protocol let the
 * agent mark approved work `[OUT-OF-SCOPE]`/`[DEFERRED]` itself, so the label
 * became a self-approved scope trim (measured: 2 live register items, 1 index
 * line, 3 CHANGELOG lines, 12 session summaries). These pins hold the
 * prohibition in all four places it can leak — the register, active FIDs, the
 * agenda, and new narrative records — and hold the single lawful exemption.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'
import {
  collectScopeDispositionIssues,
  runScopeDispositionGate,
  scanChangelogSinceEffective,
  scanScopeDispositions,
} from '../scope-disposition-guard'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function createRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-scope-guard-'))
  tempRoots.push(root)
  mkdirSync(path.join(root, 'dev/fids'), { recursive: true })
  mkdirSync(path.join(root, 'dev/session-summaries'), { recursive: true })
  return root
}

function write(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath)
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}

describe('scope disposition tokens', () => {
  test('flags every label form and both status markers', () => {
    const content = [
      '- [ ] **T1.** [OPEN-OUT-OF-SCOPE] leftover',
      '- [ ] **T2.** [OUT-OF-SCOPE] leftover',
      '- [ ] **T3.** [DEFERRED] leftover',
      '- [ ] **T4.** deferred::waiting',
      '- [ ] **T5.** skipped::later',
    ].join('\n')
    const issues = scanScopeDispositions(content, 'SCOPE.md')
    expect(issues).toHaveLength(5)
    expect(issues.map((issue) => issue.line)).toEqual([1, 2, 3, 4, 5])
    expect(issues[0]?.message).toContain('prohibited disposition token')
  })

  test('the operator ruling is the only lawful exemption', () => {
    const approved =
      '- 2. later — dropped::operator-approved 2026-09-19 — "<quote>"'
    expect(scanScopeDispositions(approved, 'SCOPE.md')).toEqual([])
  })

  test('prose that states the rule is not a token', () => {
    const prose =
      'Nothing is ever out of scope: work is completed or blocked, never trimmed.'
    expect(scanScopeDispositions(prose, 'SCOPE.md')).toEqual([])
  })

  test('a backticked token is a quotation; a bare one is the disposition', () => {
    // The rule must be statable in an artifact without excusing the tag. This is
    // what lets the register carry the prohibition: quoted = documentation,
    // bare = the mechanism.
    const quoted =
      '- The labels `[OUT-OF-SCOPE]` and `[DEFERRED]` are not statuses.'
    expect(scanScopeDispositions(quoted, 'SCOPE.md')).toEqual([])
    const bare = '- [ ] **T1.** [OUT-OF-SCOPE] parked'
    expect(scanScopeDispositions(bare, 'SCOPE.md')).toHaveLength(1)
    const mixed =
      '- Rule: `[DEFERRED]` is banned — but this one is live: [DEFERRED]'
    expect(scanScopeDispositions(mixed, 'SCOPE.md')).toHaveLength(1)
  })
})

describe('scope surface coverage', () => {
  test('the live register and active FIDs are scanned', () => {
    const root = createRoot()
    write(root, 'SCOPE.md', '- [ ] **T9.** [DEFERRED] stale item\n')
    write(root, 'dev/fids/FID-2026-0101-001-x.md', '[OUT-OF-SCOPE] aside\n')
    const files = collectScopeDispositionIssues(root).map((issue) => issue.file)
    expect(files).toContain('SCOPE.md')
    expect(files).toContain('dev/fids/FID-2026-0101-001-x.md')
  })

  test('narrative records are windowed: pre-rule history is not rewritten', () => {
    const root = createRoot()
    write(
      root,
      'dev/session-summaries/2026-09-05-old.md',
      '- recorded [OPEN-OUT-OF-SCOPE] (historic)\n',
    )
    write(
      root,
      'dev/session-summaries/2026-09-19-new.md',
      '- recorded [OPEN-OUT-OF-SCOPE] (not allowed)\n',
    )
    const issues = collectScopeDispositionIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.file).toBe('dev/session-summaries/2026-09-19-new.md')
  })

  test('only the current-release CHANGELOG block is scanned', () => {
    const changelog = [
      '# Changelog',
      '',
      '## 0.0.33 — 2026-09-19',
      '',
      '- shipped [OPEN-OUT-OF-SCOPE] (must be caught)',
      '',
      '## 0.0.32 — 2026-09-18',
      '',
      '- historic [OPEN-OUT-OF-SCOPE] (left as record)',
      '',
    ].join('\n')
    const issues = scanChangelogSinceEffective(changelog)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.token).toBe('[OPEN-OUT-OF-SCOPE]')
    expect(issues[0]?.line).toBe(5)
  })
})

describe('pre-write block', () => {
  test('blocks a scope surface that would gain a token', () => {
    const result = runScopeDispositionGate({
      targetPath: '/proj/SCOPE.md',
      input: { content: '- [ ] **T1.** [OUT-OF-SCOPE] nope\n' },
      warnings: [],
    })
    expect(result?.blocked).toBe(true)
    expect(result?.reason).toContain('Scope gate')
  })

  // Absolute, non-existent paths: the suite must behave identically whether it
  // runs from the repo root or from the package (a relative `SCOPE.md` exists in
  // the repo, so Law 1 would fire before the scope gate and mask it).
  const SCOPE_PATH = '/proj/SCOPE.md'

  test('reachable through the full pre-write gate chain', () => {
    const blocked = runPreWriteGates({
      toolName: 'write_file',
      input: {
        path: SCOPE_PATH,
        content: '- [ ] **T1.** [OPEN-OUT-OF-SCOPE] parked\n',
      },
      agentId: 'savant',
      state: createEnforcementState(),
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(blocked.blocked).toBe(true)
    expect(blocked.reason).toContain('Scope gate')

    const clean = runPreWriteGates({
      toolName: 'write_file',
      input: { path: SCOPE_PATH, content: '- [x] **T1.** completed\n' },
      agentId: 'savant',
      state: createEnforcementState(),
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(clean.blocked).toBe(false)
  })

  test('allows a clean scope write and ignores unrelated paths', () => {
    expect(
      runScopeDispositionGate({
        targetPath: '/proj/SCOPE.md',
        input: { content: '- [x] **T1.** done\n' },
        warnings: [],
      }),
    ).toBeNull()
    expect(
      runScopeDispositionGate({
        targetPath: 'src/index.ts',
        input: { content: '// [OUT-OF-SCOPE] comment in code\n' },
        warnings: [],
      }),
    ).toBeNull()
  })
})
