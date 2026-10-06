import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { captureModelRoute } from '@savant-code/common/providers/model-route'
import { expect, test } from 'bun:test'

import { ProviderNoticeStorage } from '../provider-notice-storage'
import { ProviderNotificationCoordinator } from '../provider-notifications'
import { ProviderQuotaMonitor } from '../provider-quota-monitor'

import type { ProviderQuotaResult } from '../provider-quota'

test('quota monitor honors Retry-After, refusal refresh, hysteresis, and account revision', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'provider-quota-'))
  const prior = process.env.BAI_API_KEY
  process.env.BAI_API_KEY = 'fixture-quota'
  let now = Date.parse('2026-10-03T00:00:00Z'),
    calls = 0
  let result: ProviderQuotaResult = {
    status: 'unavailable',
    detail: 'HTTP 429',
    retryAfterMs: 180_000,
  }
  const service = new ProviderNotificationCoordinator(
    new ProviderNoticeStorage(dir),
    () => now,
  )
  const monitor = new ProviderQuotaMonitor(
    new AbortController().signal,
    () => now,
    async () => {
      calls++
      return result
    },
    service,
  )
  const route = captureModelRoute('bai')
  const measure = () =>
    monitor.measure(route, true, { BAI_API_KEY: 'fixture-quota' }, true)
  try {
    await measure()
    now += 60_000
    await measure()
    expect(calls).toBe(1)
    expect(service.snapshot().notices).toHaveLength(0)
    now += 180_000
    result = {
      status: 'ok',
      amount: 0,
      limit: 100,
      unit: 'credits',
      reading: '0 credits',
      note: 'Fixture quota',
      url: 'https://bai.test',
    }
    await measure()
    expect(
      service.snapshot().notices.filter((n) => n.kind === 'quota-exhausted'),
    ).toHaveLength(1)
    now++
    await measure()
    expect(
      service.snapshot().notices.filter((n) => n.kind === 'quota-exhausted'),
    ).toHaveLength(1)
    result = { ...result, amount: 20, reading: '20 credits' }
    now++
    const resumed = new ProviderQuotaMonitor(
      new AbortController().signal,
      () => now,
      async () => result,
      service,
    )
    await resumed.measure(route, true, { BAI_API_KEY: 'fixture-quota' }, true)
    expect(
      service.snapshot().notices.find((n) => n.kind === 'quota-exhausted')
        ?.resolved,
    ).toBe(true)
    expect(service.snapshot().notices.some((n) => n.kind === 'quota-recovered')).toBe(true)
    result = { ...result, amount: 0, reading: '0 credits' }
    now++
    await measure()
    expect(
      service.snapshot().notices.filter((n) => n.kind === 'quota-exhausted'),
    ).toHaveLength(2)
    process.env.BAI_API_KEY = 'rotated-fixture'
    await expect(measure()).rejects.toThrow('credentials changed')
  } finally {
    if (prior === undefined) delete process.env.BAI_API_KEY
    else process.env.BAI_API_KEY = prior
    rmSync(dir, { recursive: true, force: true })
  }
})

test('cancellation discards a delayed quota response', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'provider-quota-'))
  const prior = process.env.BAI_API_KEY
  process.env.BAI_API_KEY = 'fixture-quota'
  const service = new ProviderNotificationCoordinator(
    new ProviderNoticeStorage(dir),
  )
  const controller = new AbortController()
  const monitor = new ProviderQuotaMonitor(
    controller.signal,
    Date.now,
    async () => {
      controller.abort()
      return {
        status: 'ok',
        amount: 0,
        reading: '0 credits',
        note: '',
        url: 'https://bai.test',
      }
    },
    service,
  )
  try {
    await monitor.measure(
      captureModelRoute('bai'),
      true,
      { BAI_API_KEY: 'fixture-quota' },
      true,
    )
    expect(service.snapshot().notices).toHaveLength(0)
  } finally {
    if (prior === undefined) delete process.env.BAI_API_KEY
    else process.env.BAI_API_KEY = prior
    rmSync(dir, { recursive: true, force: true })
  }
})
