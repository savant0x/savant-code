import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  unlinkSync,
  readdirSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { ProviderNoticeStorage } from '../../utils/provider-notice-storage'
import { ProviderNotificationCoordinator } from '../../utils/provider-notifications'

describe('provider notification lifecycle', () => {
  test('failed sink leaves durable pending delivery; restart accepts without reading it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provider-notices-'))
    try {
      const storage = new ProviderNoticeStorage(dir)
      const service = new ProviderNotificationCoordinator(storage)
      service.observe('health', [
        {
          key: 'p',
          value: 'down',
          providerId: 'p',
          kind: 'health-down',
          severity: 'critical',
          selected: true,
          message: 'p down',
        },
      ])
      const off = service.subscribe('cli', () => false)
      await service.deliver()
      off()
      expect(storage.read().notices[0].acceptedBy).toEqual([])
      const restarted = new ProviderNotificationCoordinator(storage)
      let count = 0
      const release = restarted.subscribe('cli', (notices) => {
        count += notices.length
        return true
      })
      await restarted.deliver()
      release()
      expect(count).toBe(2)
      expect(storage.read().notices[0].acceptedBy).toEqual(['cli'])
      expect(storage.read().notices[0].unread).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  test('two writers merge acknowledgements; corrupt files are preserved', () => {
    const dir = mkdtempSync(join(tmpdir(), 'provider-notices-'))
    try {
      const first = new ProviderNoticeStorage(dir)
      const second = new ProviderNoticeStorage(dir)
      first.update((s) => ({ ...s, revision: 1 }))
      second.update((s) => ({ ...s, revision: s.revision + 1 }))
      expect(first.read().revision).toBe(2)
      const file = join(dir, 'provider-notifications.json')
      writeFileSync(file, '{broken')
      expect(() => first.update((s) => s)).toThrow()
      expect(readFileSync(file, 'utf8')).toBe('{broken')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  test('busy writer retains fresh memory, retries acknowledgement without duplicate presentation, then persists', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provider-notices-'))
    const now = Date.now()
    const storage = new ProviderNoticeStorage(dir, () => now)
    const service = new ProviderNotificationCoordinator(storage, () => now)
    const lease = join(dir, 'provider-notifications.json.lease')
    try {
      storage.update((s) => s)
      writeFileSync(lease, `${now}:${process.pid}:test-owner`)
      service.observe('health', [
        {
          key: 'p',
          value: 'down',
          providerId: 'p',
          kind: 'health-down',
          severity: 'warning',
          selected: true,
          message: 'pending warning',
        },
      ])
      expect(storage.read().notices).toHaveLength(0)
      expect(
        service.snapshot().notices.some((n) => n.message === 'pending warning'),
      ).toBe(true)
      let presentations = 0
      const off = service.subscribe('cli', () => {
        presentations++
        return true
      })
      await expect(service.deliver()).rejects.toThrow('busy')
      await expect(service.deliver()).rejects.toThrow('busy')
      expect(presentations).toBe(1)
      unlinkSync(lease)
      await service.deliver()
      off()
      expect(
        storage.read().notices.find((n) => n.message === 'pending warning')
          ?.acceptedBy,
      ).toEqual(['cli'])
      expect(presentations).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  test('dead stale owner is recovered; fresh catalog recovers corrupt bytes with a diagnostic backup', () => {
    const dir = mkdtempSync(join(tmpdir(), 'provider-notices-'))
    const now = Date.now()
    const storage = new ProviderNoticeStorage(dir, () => now)
    const file = join(dir, 'provider-notifications.json')
    try {
      writeFileSync(`${file}.lease`, `${now - 20_000}:2147483647:dead-owner`)
      storage.update((s) => ({ ...s, revision: 1 }))
      expect(storage.read().revision).toBe(1)
      writeFileSync(file, '{broken')
      expect(storage.presentation().notices[0].id).toBe(
        'notice-storage-diagnostic',
      )
      storage.recover()
      expect(
        readdirSync(dir).filter((f) => f.endsWith('.corrupt')),
      ).toHaveLength(1)
      expect(storage.read().notices).toHaveLength(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
