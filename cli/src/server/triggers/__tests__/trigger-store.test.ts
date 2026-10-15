import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { TriggerStore, hashTriggerSecret } from '../trigger-store'

describe('trigger store', () => {
  let configRoot: string

  beforeEach(() => {
    // Per-test isolation: every case gets a fresh config dir via the
    // SAVANT_CODE_CONFIG_DIR override (non-prod only, per config-dir.ts).
    configRoot = mkdtempSync(path.join(os.tmpdir(), 'savant-triggers-'))
    process.env.SAVANT_CODE_CONFIG_DIR = configRoot
  })

  afterEach(() => {
    rmSync(configRoot, { recursive: true, force: true })
  })

  test('create returns the plaintext secret exactly once and stores a hash', () => {
    const storeFile = path.join(configRoot, 'triggers.json')
    const store = new TriggerStore(storeFile)
    const created = store.create({ name: 'github-ci' })

    expect(created.id).toMatch(/^trg_/)
    expect(created.name).toBe('github-ci')
    expect(created.secret).toMatch(/^svt_/)
    // The plaintext secret is on the created record ONLY — the persisted
    // record must carry the hash instead.
    const persisted = JSON.parse(readFileSync(storeFile, 'utf8')) as {
      triggers: Array<{ secretHash: string; secret?: string }>
    }
    expect(persisted.triggers).toHaveLength(1)
    expect(persisted.triggers[0]?.secret).toBeUndefined()
    expect(persisted.triggers[0]?.secretHash).toBe(
      hashTriggerSecret(created.secret),
    )
  })

  test('verify accepts the right secret and rejects wrong/empty/missing', () => {
    const store = new TriggerStore(path.join(configRoot, 'triggers.json'))
    const created = store.create({ name: 'stripe' })
    expect(store.verify(created.id, created.secret)).toBe(true)
    expect(store.verify(created.id, 'svt_wrong')).toBe(false)
    expect(store.verify(created.id, '')).toBe(false)
    expect(store.verify('trg_missing', 'svt_whatever')).toBe(false)
  })

  test('hash determinism: hashTriggerSecret is the comparison basis', () => {
    expect(hashTriggerSecret('svt_abc')).toBe(hashTriggerSecret('svt_abc'))
    expect(hashTriggerSecret('svt_abc')).not.toBe(hashTriggerSecret('svt_abd'))
  })

  test('list and delete operate on persisted state; reopening sees the same data', () => {
    const storeFile = path.join(configRoot, 'triggers.json')
    const store = new TriggerStore(storeFile)
    const a = store.create({ name: 'a' })
    store.create({ name: 'b' })
    expect(
      store
        .list()
        .map((t) => t.name)
        .sort(),
    ).toEqual(['a', 'b'])

    expect(store.delete(a.id)).toBe(true)
    expect(store.list().map((t) => t.name)).toEqual(['b'])
    expect(store.delete(a.id)).toBe(false)

    const reopened = new TriggerStore(storeFile)
    expect(reopened.list().map((t) => t.name)).toEqual(['b'])
  })

  test('rotate replaces the secret hash and invalidates the old secret', () => {
    const store = new TriggerStore(path.join(configRoot, 'triggers.json'))
    const created = store.create({ name: 'rot' })
    const old = created.secret
    const rotated = store.rotate(created.id)
    expect(rotated?.secret).toMatch(/^svt_/)
    expect(store.verify(created.id, old)).toBe(false)
    expect(store.verify(created.id, rotated?.secret ?? '')).toBe(true)
    expect(store.rotate('trg_missing')).toBeNull()
  })

  test('setRecurrence validates fail-closed and computes the first nextRunAt', () => {
    const storeFile = path.join(configRoot, 'triggers.json')
    const store = new TriggerStore(storeFile)
    const created = store.create({ name: 'scheduled' })

    expect(() => store.setRecurrence(created.id, 'banana')).toThrow()
    expect(() => store.setRecurrence(created.id, '0 3 * *')).toThrow() // 4 fields

    // Fail-closed: no mutation on rejected input.
    const untouched = store.list().find((t) => t.id === created.id)
    expect(untouched?.recurrence).toBeUndefined()
    expect(untouched?.nextRunAt).toBeUndefined()

    expect(store.setRecurrence(created.id, '0 3 * * *')).toBe(true)
    const stored = store.list().find((t) => t.id === created.id)
    expect(stored?.recurrence).toBe('0 3 * * *')
    expect(stored?.nextRunAt).toBeDefined()
    expect(new Date(stored?.nextRunAt ?? '').getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    )
    expect(store.setRecurrence('trg_does_not_exist', '0 3 * * *')).toBe(false)
  })

  test('setRecurrence persists; clearing returns to webhook-only', () => {
    const storeFile = path.join(configRoot, 'triggers.json')
    const store = new TriggerStore(storeFile)
    const created = store.create({ name: 'scheduled' })
    store.setRecurrence(created.id, '*/5 * * * *')

    const reopened = new TriggerStore(storeFile)
    expect(reopened.list().find((t) => t.id === created.id)?.recurrence).toBe(
      '*/5 * * * *',
    )

    reopened.setRecurrence(created.id, null)
    const cleared = reopened.list().find((t) => t.id === created.id)
    expect(cleared?.recurrence).toBeUndefined()
    expect(cleared?.nextRunAt).toBeUndefined()
  })

  test('names are unique', () => {
    const store = new TriggerStore(path.join(configRoot, 'triggers.json'))
    store.create({ name: 'dup' })
    expect(() => store.create({ name: 'dup' })).toThrow()
  })

  // --- step 4/5 extensions: recurrence at create (atomic) + enable/disable ---

  test('create with valid recurrence stores it and seeds the cursor atomically', () => {
    const store = new TriggerStore(path.join(configRoot, 'triggers.json'))
    const created = store.create({ name: 'atomic', recurrence: '*/10 * * * *' })

    const rec = store.list().find((t) => t.id === created.id)
    expect(rec?.recurrence).toBe('*/10 * * * *')
    expect(rec?.nextRunAt).toBeDefined()
    expect(new Date(rec!.nextRunAt!).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    )
  })

  test('create with an invalid recurrence throws and persists NOTHING (atomic)', () => {
    const store = new TriggerStore(path.join(configRoot, 'triggers.json'))
    expect(() =>
      store.create({ name: 'never-created', recurrence: 'not a cron' }),
    ).toThrow()
    // The failed creation must not leave a half-record behind.
    expect(store.list().some((t) => t.name === 'never-created')).toBe(false)
  })

  test('setEnabled toggles a persisted enabled flag; new triggers default enabled', () => {
    const storeFile = path.join(configRoot, 'triggers.json')
    const store = new TriggerStore(storeFile)
    const created = store.create({ name: 'toggled' })
    expect(store.list().find((t) => t.id === created.id)?.enabled).toBe(true)

    expect(store.setEnabled(created.id, false)).toBe(true)
    expect(store.list().find((t) => t.id === created.id)?.enabled).toBe(false)

    const reopened = new TriggerStore(storeFile)
    expect(reopened.list().find((t) => t.id === created.id)?.enabled).toBe(
      false,
    )

    expect(store.setEnabled(created.id, true)).toBe(true)
    expect(store.setEnabled('trg_unknown', false)).toBe(false)
  })
})
