/**
 * FID-2026-0919-025 — the scope register-completeness check.
 *
 * FID-2026-0919-024 removed the label an agent trimmed scope with. This pins the
 * quiet path it cannot cover: an item with no line in `SCOPE.md` is invisible, so
 * it needs no forbidden token to be dropped. The two legs held here are the
 * decidable ones — an active FID the register never names, and a task cited by
 * an active FID or a current session summary that has no register line.
 */

import fs, { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  collectRegisterCompletenessIssues,
  collectRegisteredTasks,
  scanUnregisteredTaskReferences,
} from '../scope-register-completeness'

const tempRoots: string[] = []

afterEach(() => {
  for (const root of tempRoots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function createRoot(scopeContent?: string): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'savant-scope-register-'))
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

const REGISTER_WITH_TASK_74 = [
  '# Scope',
  '',
  '## Task 74 — no agent-side scope trimming',
  '',
  '- [x] **T74-A. Vocabulary removed.** done',
].join('\n')

function activeFid(id: string, body = ''): string {
  return [
    `# FID: sample`,
    '',
    `**ID:** ${id}`,
    '**Status:** verified',
    '',
    body,
  ].join('\n')
}

describe('what the register accounts for', () => {
  test('task sections and item ids are both register lines', () => {
    const registered = collectRegisteredTasks(REGISTER_WITH_TASK_74)
    expect(registered.taskNumbers.has(74)).toBe(true)
    expect(registered.itemIds.has('T74-A')).toBe(true)
  })

  test('an item id registers its task number too', () => {
    const registered = collectRegisteredTasks('- [x] **T59-B. done**')
    expect(registered.taskNumbers.has(59)).toBe(true)
  })
})

describe('task references', () => {
  const registered = collectRegisteredTasks(REGISTER_WITH_TASK_74)

  test('a cited task with no register line is a gap', () => {
    const issues = scanUnregisteredTaskReferences(
      'SCOPE Task 99 governs this.',
      'dev/fids/FID-2026-0919-025-x.md',
      registered,
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]?.subject).toBe('Task 99')
    expect(issues[0]?.message).toContain('no line in SCOPE.md')
  })

  test('a cited item on an unregistered task is a gap', () => {
    const issues = scanUnregisteredTaskReferences(
      'T99-Z was never registered.',
      'dev/session-summaries/2026-09-19-2200-x.md',
      registered,
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]?.subject).toBe('T99-Z')
  })

  test('a registered task number covers its item references', () => {
    expect(
      scanUnregisteredTaskReferences(
        'T74-B and T74-C were implemented.',
        'dev/fids/FID-2026-0919-025-x.md',
        registered,
      ),
    ).toEqual([])
  })

  test('one line citing both a known and an unknown task reports only the gap', () => {
    const issues = scanUnregisteredTaskReferences(
      'Task 74 done; Task 98 opened.',
      'dev/fids/FID-2026-0919-025-x.md',
      registered,
    )
    expect(issues.map((issue) => issue.subject)).toEqual(['Task 98'])
  })

  test('a backticked reference is a quotation; a bare one is the claim', () => {
    const quoted =
      'Historical summaries cite `Task 51` with no register section.'
    expect(
      scanUnregisteredTaskReferences(
        quoted,
        'dev/fids/FID-2026-0919-025-x.md',
        registered,
      ),
    ).toEqual([])
    const bare = 'Task 51 governs this.'
    expect(
      scanUnregisteredTaskReferences(
        bare,
        'dev/fids/FID-2026-0919-025-x.md',
        registered,
      ),
    ).toHaveLength(1)
  })

  test('lookalike identifiers are not task references', () => {
    expect(
      scanUnregisteredTaskReferences(
        'UTF-8 encoding, GPT-4 class models, HTTP-2 frames.',
        'dev/fids/FID-2026-0919-025-x.md',
        registered,
      ),
    ).toEqual([])
  })
})

describe('FID coverage', () => {
  test('an active FID the register never names is a gap', () => {
    const root = createRoot(REGISTER_WITH_TASK_74)
    write(
      root,
      'dev/fids/FID-2026-0919-025-register-completeness.md',
      activeFid('FID-2026-0919-025'),
    )
    const issues = collectRegisterCompletenessIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.subject).toBe('FID-2026-0919-025')
    expect(issues[0]?.line).toBe(3)
  })

  test('a FID named in the register is covered', () => {
    const root = createRoot(
      `${REGISTER_WITH_TASK_74}\n\nSee FID-2026-0919-025 for the evidence.\n`,
    )
    write(
      root,
      'dev/fids/FID-2026-0919-025-register-completeness.md',
      activeFid('FID-2026-0919-025'),
    )
    expect(collectRegisterCompletenessIssues(root)).toEqual([])
  })

  test('the register index and the archive are not the active queue', () => {
    const root = createRoot(REGISTER_WITH_TASK_74)
    write(root, 'dev/fids/README.md', 'ledger prose')
    write(
      root,
      'dev/fids/archive/FID-2026-0919-001-old.md',
      activeFid('FID-2026-0919-001'),
    )
    expect(collectRegisterCompletenessIssues(root)).toEqual([])
  })
})

describe('narrative window', () => {
  test('session summaries from before the effective date are history', () => {
    const root = createRoot()
    write(
      root,
      'dev/session-summaries/2026-09-01-legacy.md',
      'Task 51 keyed identity audit (historical).',
    )
    expect(collectRegisterCompletenessIssues(root)).toEqual([])
  })

  test('current session summaries are scanned', () => {
    const root = createRoot(REGISTER_WITH_TASK_74)
    write(
      root,
      'dev/session-summaries/2026-09-19-2200-current.md',
      'Task 98 work landed here.',
    )
    const issues = collectRegisterCompletenessIssues(root)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.file).toBe(
      'dev/session-summaries/2026-09-19-2200-current.md',
    )
  })

  test('a missing register is not an error', () => {
    const root = createRoot()
    expect(collectRegisterCompletenessIssues(root)).toEqual([])
  })
})

describe('live repository', () => {
  test('every tracked item has a line in the real SCOPE.md', () => {
    let root = import.meta.dir
    while (!fs.existsSync(path.join(root, 'SCOPE.md'))) {
      const parent = path.dirname(root)
      if (parent === root) break
      root = parent
    }
    expect(fs.existsSync(path.join(root, 'SCOPE.md'))).toBe(true)
    expect(collectRegisterCompletenessIssues(root)).toEqual([])
  })
})
