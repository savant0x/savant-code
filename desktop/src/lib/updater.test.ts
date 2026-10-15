// FID-2026-0824-011 Step 4 tests: cadence gate, storage round-trip, and the
// consent-gated check outcome mapping (available / none / failed) with an
// injected checker — no Tauri runtime involved.

import { describe, expect, it } from 'bun:test'

import {
  readLastCheck,
  runUpdateCheck,
  shouldCheckNow,
  stampLastCheck,
  UPDATE_CHECK_INTERVAL_MS,
  type UpdaterChecker,
} from './updater'

function memoryStorage(initial: Record<string, string> = {}): {
  store: Map<string, string>
  getItem(key: string): string | null
  setItem(key: string, value: string): void
} {
  const store = new Map(Object.entries(initial))
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
}

describe('cadence gate', () => {
  it('checks when no timestamp exists', () => {
    expect(shouldCheckNow(null, 1_000)).toBe(true)
  })

  it('skips inside the interval and checks past it', () => {
    const last = 10 * UPDATE_CHECK_INTERVAL_MS
    expect(shouldCheckNow(last, last + UPDATE_CHECK_INTERVAL_MS - 1)).toBe(
      false,
    )
    expect(shouldCheckNow(last, last + UPDATE_CHECK_INTERVAL_MS)).toBe(true)
  })
})

describe('last-check storage', () => {
  it('round-trips a timestamp and treats garbage as absent', () => {
    const storage = memoryStorage()
    expect(readLastCheck(storage)).toBeNull()
    stampLastCheck(storage, 1234)
    expect(readLastCheck(storage)).toBe(1234)
    storage.setItem('savant.updater.lastCheck', 'not-a-number')
    expect(readLastCheck(storage)).toBeNull()
  })
})

describe('runUpdateCheck outcome mapping', () => {
  const unavailable = (() => Promise.resolve(null)) as unknown as UpdaterChecker

  it('maps an unavailable update to none', async () => {
    const outcome = await runUpdateCheck(unavailable)
    expect(outcome).toEqual({ kind: 'none' })
  })

  it('maps an available update to its offer', async () => {
    const checker = (() =>
      Promise.resolve({
        available: true,
        version: '0.0.28',
        body: 'fixes',
        downloadAndInstall: () => Promise.resolve(),
      })) as unknown as UpdaterChecker
    const outcome = await runUpdateCheck(checker)
    expect(outcome).toEqual({
      kind: 'available',
      offer: { version: '0.0.28', notes: 'fixes' },
    })
  })

  it('never throws — failures map to a failed outcome (Law 14)', async () => {
    const checker = (() =>
      Promise.reject(
        new Error('signature verification failed'),
      )) as unknown as UpdaterChecker
    const outcome = await runUpdateCheck(checker)
    expect(outcome).toEqual({
      kind: 'failed',
      message: 'signature verification failed',
    })
  })
})
