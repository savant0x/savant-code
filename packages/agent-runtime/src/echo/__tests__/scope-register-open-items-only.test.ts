/**
 * FID-2026-0928-005 — the register holds open items only.
 *
 * The 2026-09-28 ruling: a completed item is not in scope. Leg 2 previously
 * demanded a register line for every task cited by any session summary written
 * since the guard's effective date, which made finished work permanently
 * in-scope: removing the completed index produced 111 issues, every one of them
 * from a historical summary, and zero from either active FID.
 *
 * These legs pin the narrowed contract and, just as importantly, pin the control
 * that survives it. A test suite that only asserts the new behaviour would pass
 * just as happily against a gutted check, so the retained leg is stated
 * explicitly.
 */

import fs, { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { collectRegisterCompletenessIssues } from '../scope-register-completeness'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function createRoot(scopeContent?: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-scope-open-only-'))
  tempRoots.push(root)
  mkdirSync(path.join(root, 'dev/fids'), { recursive: true })
  mkdirSync(path.join(root, 'dev/session-summaries'), { recursive: true })
  if (scopeContent !== undefined) write(root, 'SCOPE.md', scopeContent)
  return root
}

function write(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath)
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content)
}

function activeFid(id: string, body = ''): string {
  return [
    '# FID: sample',
    '',
    `**ID:** ${id}`,
    '**Status:** verified',
    '',
    body,
  ].join('\n')
}

/** A register carrying only open items — the shape the ruling asks for. */
const OPEN_ITEMS_ONLY = [
  '# SCOPE — Active Task Register',
  '',
  '## Open items',
  '',
  '- [ ] **T90-F3. Law 3 receipt staleness at the write boundary.**',
  '      **Blocker:** an operator decision. **Automation level: 3** once ruled.',
  '- [ ] **T95-B. `tauri` is not on `COMMAND_ALLOWLIST`.**',
  '      **Blocker:** an operator ruling. **Automation level: 1.**',
].join('\n')

describe('a completed item is not in scope', () => {
  test('a task cited only by a past session summary needs no register line', () => {
    // The decisive leg. Against the pre-FID-2026-0928-005 code this returns one
    // issue; the register is already correct and the gate is what's wrong.
    const root = createRoot(OPEN_ITEMS_ONLY)
    write(
      root,
      'dev/session-summaries/2026-09-20-1200-shipped.md',
      'Task 74 vocabulary removal landed; Task 81 hook events wired.',
    )
    expect(collectRegisterCompletenessIssues(root)).toEqual([])
  })

  test('a completed item id in a past summary needs no register line', () => {
    const root = createRoot(OPEN_ITEMS_ONLY)
    write(
      root,
      'dev/session-summaries/2026-09-21-0900-done.md',
      'T82-A through T82-M all closed out this session.',
    )
    expect(collectRegisterCompletenessIssues(root)).toEqual([])
  })

  test('a register with no completed index satisfies the live tree', () => {
    // The shape itself: open items only, zero task sections.
    const root = createRoot(OPEN_ITEMS_ONLY)
    const scope = fs.readFileSync(path.join(root, 'SCOPE.md'), 'utf8')
    expect(/^## Task /m.test(scope)).toBe(false)
    expect(collectRegisterCompletenessIssues(root)).toEqual([])
  })
})

describe('the control that survives', () => {
  test('a task an active FID cites is still a gap', () => {
    // Passes before and after. If the narrowing ever gutted leg 2 rather than
    // scoping it, this leg is what catches it.
    const root = createRoot(OPEN_ITEMS_ONLY)
    write(
      root,
      'dev/fids/FID-2026-0928-099-live.md',
      activeFid('FID-2026-0928-099', 'Extends Task 88 the gateway parser.'),
    )
    const issues = collectRegisterCompletenessIssues(root)
    expect(issues.map((i) => i.subject)).toContain('Task 88')
  })

  test('an active FID the register never names is still a gap', () => {
    const root = createRoot(OPEN_ITEMS_ONLY)
    write(
      root,
      'dev/fids/FID-2026-0928-099-live.md',
      activeFid('FID-2026-0928-099'),
    )
    const issues = collectRegisterCompletenessIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.subject).toBe('FID-2026-0928-099')
  })

  test('the agenda is a live surface: a task it lists is a gap', () => {
    const root = createRoot(OPEN_ITEMS_ONLY)
    write(root, 'dev/agenda.md', '- Task 55 undropped provider sweep\n')
    const issues = collectRegisterCompletenessIssues(root)
    expect(issues.map((i) => i.subject)).toContain('Task 55')
  })

  test('a registered open item is not a gap from a live surface', () => {
    const root = createRoot(OPEN_ITEMS_ONLY)
    write(root, 'dev/agenda.md', '- T95-B allowlist ruling pending\n')
    expect(collectRegisterCompletenessIssues(root)).toEqual([])
  })
})

describe('live repository', () => {
  test('the real SCOPE.md holds open items only and stays green', () => {
    let root = import.meta.dir
    while (!fs.existsSync(path.join(root, 'SCOPE.md'))) {
      const parent = path.dirname(root)
      if (parent === root) break
      root = parent
    }
    expect(fs.existsSync(path.join(root, 'SCOPE.md'))).toBe(true)
    const scope = fs.readFileSync(path.join(root, 'SCOPE.md'), 'utf8')
    // No completed index: a finished task is not in scope. Anchored to line
    // starts — the register's own header names the `## Task NN` form in prose,
    // and a substring match trips on the documentation rather than a section.
    expect(/^## Task /m.test(scope)).toBe(false)
    expect(collectRegisterCompletenessIssues(root)).toEqual([])
  })
})
