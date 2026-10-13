import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  applyRetirement,
  LEARNINGS_PATH,
  MOVE_RECORD_PATH,
  RETIRED_PATH,
} from '../learnings-retire'
import {
  RETIREMENT_LOCK_PATH,
  RETIREMENT_PENDING_PATH,
  writeRetirementFile,
} from '../learnings-retirement-transaction'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'retirement-recovery-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'dev'))
  const lesson = (title: string, date: string) =>
    `## Lesson: ${title}\n\n- **Date:** ${date}\n- **Status:** active\n- **Guard:** keep evidence\n\n`
  fs.writeFileSync(
    path.join(root, LEARNINGS_PATH),
    '# LEARNINGS\n\n' +
      lesson('Old', '2026-01-01') +
      lesson('New', '2026-10-01'),
  )
  fs.writeFileSync(
    path.join(root, RETIRED_PATH),
    '# Archive\n\nExisting bytes  \n\n\n',
  )
  return root
}

describe('retirement transaction recovery', () => {
  test.each([RETIRED_PATH, LEARNINGS_PATH, MOVE_RECORD_PATH])(
    'recovers an interruption after %s without duplicate content or receipts',
    (interrupt) => {
      const root = fixture()
      const originalArchive = fs.readFileSync(
        path.join(root, RETIRED_PATH),
        'utf8',
      )
      expect(() =>
        applyRetirement(root, {
          cap: 10,
          write: (file, content) => {
            writeRetirementFile(file, content)
            if (file === path.join(root, interrupt))
              throw new Error('injected interruption')
          },
        }),
      ).toThrow('injected interruption')
      expect(fs.existsSync(path.join(root, RETIREMENT_PENDING_PATH))).toBe(true)
      expect(fs.existsSync(path.join(root, RETIREMENT_LOCK_PATH))).toBe(false)
      const result = applyRetirement(root, { cap: 10 })
      expect(result.retired).toHaveLength(1)
      expect(result.retired[0]?.title).toBe('Old')
      const archive = fs.readFileSync(path.join(root, RETIRED_PATH), 'utf8')
      expect(archive.startsWith(originalArchive)).toBe(true)
      expect(archive.match(/## Lesson: Old/g)).toHaveLength(1)
      const records = fs.readFileSync(path.join(root, MOVE_RECORD_PATH), 'utf8')
      expect(records.trim().split('\n')).toHaveLength(1)
      expect(fs.existsSync(path.join(root, RETIREMENT_PENDING_PATH))).toBe(
        false,
      )
      expect(applyRetirement(root, { cap: 10 }).retired).toEqual([])
      expect(fs.readFileSync(path.join(root, RETIRED_PATH), 'utf8')).toBe(
        archive,
      )
      expect(fs.readFileSync(path.join(root, MOVE_RECORD_PATH), 'utf8')).toBe(
        records,
      )
    },
  )

  test('receipt-write failure is recoverable even after the ledger is under cap', () => {
    const root = fixture()
    expect(() =>
      applyRetirement(root, {
        cap: 10,
        write: (file, content) => {
          if (file === path.join(root, MOVE_RECORD_PATH))
            throw new Error('receipt blocked')
          writeRetirementFile(file, content)
        },
      }),
    ).toThrow('receipt blocked')
    expect(
      fs.readFileSync(path.join(root, LEARNINGS_PATH), 'utf8'),
    ).not.toContain('Lesson: Old')
    expect(fs.existsSync(path.join(root, MOVE_RECORD_PATH))).toBe(false)
    expect(applyRetirement(root, { cap: 10 }).retired[0]?.title).toBe('Old')
    expect(
      fs.readFileSync(path.join(root, MOVE_RECORD_PATH), 'utf8'),
    ).toContain('Old')
  })

  test('recovery refuses conflicting edits before replaying any file', () => {
    const root = fixture()
    expect(() =>
      applyRetirement(root, {
        cap: 10,
        write: () => {
          throw new Error('stopped')
        },
      }),
    ).toThrow('stopped')
    const changed = '# Operator changed the ledger\n'
    fs.writeFileSync(path.join(root, LEARNINGS_PATH), changed)
    const archive = fs.readFileSync(path.join(root, RETIRED_PATH), 'utf8')
    expect(() => applyRetirement(root, { cap: 10 })).toThrow(
      'recovery conflict: ledger',
    )
    expect(fs.readFileSync(path.join(root, LEARNINGS_PATH), 'utf8')).toBe(
      changed,
    )
    expect(fs.readFileSync(path.join(root, RETIRED_PATH), 'utf8')).toBe(archive)
    expect(fs.existsSync(path.join(root, MOVE_RECORD_PATH))).toBe(false)
  })

  test('a conservative writer lock prevents concurrent mutation', () => {
    const root = fixture()
    const before = fs.readFileSync(path.join(root, LEARNINGS_PATH), 'utf8')
    fs.writeFileSync(path.join(root, RETIREMENT_LOCK_PATH), String(process.pid))
    expect(() => applyRetirement(root, { cap: 10 })).toThrow()
    expect(fs.readFileSync(path.join(root, LEARNINGS_PATH), 'utf8')).toBe(
      before,
    )
  })

  test.each(['archive', 'ledger', 'receipts'] as const)(
    'a forged %s after-image cannot authorize destructive recovery',
    (kind) => {
      const root = fixture()
      expect(() =>
        applyRetirement(root, {
          cap: 10,
          write: () => {
            throw new Error('stopped')
          },
        }),
      ).toThrow('stopped')
      const file = path.join(root, RETIREMENT_PENDING_PATH)
      const journal = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<
        'archive' | 'ledger' | 'receipts',
        { after: string }
      >
      journal[kind].after = 'forged destructive replacement'
      fs.writeFileSync(file, JSON.stringify(journal))
      const before = fs.readFileSync(path.join(root, LEARNINGS_PATH), 'utf8')
      expect(() => applyRetirement(root, { cap: 10 })).toThrow(
        'move-only transaction',
      )
      expect(fs.readFileSync(path.join(root, LEARNINGS_PATH), 'utf8')).toBe(
        before,
      )
      expect(fs.existsSync(path.join(root, MOVE_RECORD_PATH))).toBe(false)
    },
  )

  test('an unfinished journal cannot be replayed while its foreign owner is live', () => {
    const root = fixture()
    expect(() =>
      applyRetirement(root, {
        cap: 10,
        write: () => {
          throw new Error('stopped')
        },
      }),
    ).toThrow('stopped')
    const file = path.join(root, RETIREMENT_PENDING_PATH)
    const journal = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      ownerPid: number
    }
    journal.ownerPid = process.ppid
    fs.writeFileSync(file, JSON.stringify(journal))
    expect(() => applyRetirement(root, { cap: 10 })).toThrow('live process')
    expect(fs.existsSync(path.join(root, MOVE_RECORD_PATH))).toBe(false)
  })

  test('corrupt journals fail closed and absent stores remain a no-op', () => {
    const root = fixture()
    fs.writeFileSync(path.join(root, RETIREMENT_PENDING_PATH), 'not-json')
    const before = fs.readFileSync(path.join(root, LEARNINGS_PATH), 'utf8')
    expect(() => applyRetirement(root, { cap: 10 })).toThrow()
    expect(fs.readFileSync(path.join(root, LEARNINGS_PATH), 'utf8')).toBe(
      before,
    )
    const absent = fs.mkdtempSync(path.join(os.tmpdir(), 'retirement-absent-'))
    roots.push(absent)
    expect(applyRetirement(absent)).toEqual({
      retired: [],
      linesBefore: 0,
      linesAfter: 0,
    })
  })
})
