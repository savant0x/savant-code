import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  collectTaskIdLedgerIssues,
  scopeTaskAllocations,
  validateTaskIdLedger,
} from '../task-id-ledger'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

const original = JSON.stringify({
  version: 1,
  reservedThrough: 190,
  allocations: [{ id: 'T188', title: 'Original guard.' }],
})
const scope = '- [ ] **T188. Original guard.** More details.'

describe('permanent task identity', () => {
  test('the standing probe reads committed history and rejects a rewritten identity', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'task-ledger-'))
    roots.push(root)
    const git = (...args: string[]) => {
      const result = spawnSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
      })
      expect(result.status).toBe(0)
    }
    fs.mkdirSync(path.join(root, 'dev'))
    const ledger = path.join(root, 'dev/task-id-ledger.json')
    fs.writeFileSync(ledger, original)
    fs.writeFileSync(path.join(root, 'SCOPE.md'), scope)
    git('init', '-q')
    git('add', 'dev/task-id-ledger.json', 'SCOPE.md')
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '-qm',
      'initialize fixture',
    )
    expect(collectTaskIdLedgerIssues(root)).toEqual([])
    fs.writeFileSync(
      ledger,
      original.replace('Original guard.', 'Different work.'),
    )
    fs.writeFileSync(
      path.join(root, 'SCOPE.md'),
      '- [ ] **T188. Different work.**',
    )
    expect(collectTaskIdLedgerIssues(root)).toHaveLength(1)
    fs.unlinkSync(ledger)
    expect(collectTaskIdLedgerIssues(root)).toHaveLength(1)
  }, 30_000)

  test('closing a task preserves its allocation without keeping it in scope', () => {
    expect(validateTaskIdLedger(scope, original, original)).toEqual([])
    expect(validateTaskIdLedger('', original, original)).toEqual([])
  })

  test('a retired number cannot acquire a new identity', () => {
    expect(
      validateTaskIdLedger('- [ ] **T188. Different work.**', original),
    ).toHaveLength(1)
    const renamed = original.replace('Original guard.', 'Different work.')
    expect(
      validateTaskIdLedger(
        '- [ ] **T188. Different work.**',
        renamed,
        original,
      ),
    ).toHaveLength(1)
  })

  test('deletion, reservation changes and legacy gaps are rejected', () => {
    const removed = JSON.stringify({
      version: 1,
      reservedThrough: 190,
      allocations: [],
    })
    expect(validateTaskIdLedger('', removed, original)).toHaveLength(1)
    expect(
      validateTaskIdLedger('', original.replace('190', '189'), original),
    ).toHaveLength(1)
    const gap = JSON.stringify({
      version: 1,
      reservedThrough: 190,
      allocations: [
        { id: 'T188', title: 'Original guard.' },
        { id: 'T189', title: 'New work.' },
      ],
    })
    expect(validateTaskIdLedger('', gap, original)).toHaveLength(1)
  })

  test('a new allocation above the committed high-water mark is allowed', () => {
    const next = JSON.stringify({
      version: 1,
      reservedThrough: 190,
      allocations: [
        { id: 'T188', title: 'Original guard.' },
        { id: 'T191', title: 'New work.' },
      ],
    })
    expect(
      validateTaskIdLedger('- [ ] **T191. New work.**', next, original),
    ).toEqual([])
    expect(
      validateTaskIdLedger('- [ ] **T192. Unallocated.**', next, original),
    ).toHaveLength(1)
  })

  test('malformed and duplicate allocations fail closed', () => {
    expect(validateTaskIdLedger('', '{}')).toHaveLength(1)
    expect(validateTaskIdLedger('', 'not json')).toHaveLength(1)
    const duplicate = JSON.stringify({
      version: 1,
      reservedThrough: 190,
      allocations: [
        { id: 'T188', title: 'Original guard.' },
        { id: 'T188-A', title: 'Reused number.' },
      ],
    })
    expect(validateTaskIdLedger('', duplicate)).toHaveLength(1)
  })

  test('declarations span lines, preserve suffixes, and ignore prose references', () => {
    expect(
      scopeTaskAllocations(
        'Mention T12 in prose.\n- [ ] **T62-followups.** Body.\n' +
          '- [ ] **T186. Two registered\n      workspaces.**\n## Task 191 — New work.',
      ),
    ).toEqual([
      { id: 'T62-followups', title: 'T62-followups' },
      { id: 'T186', title: 'Two registered workspaces.' },
      { id: 'T191', title: 'New work.' },
    ])
  })
})
