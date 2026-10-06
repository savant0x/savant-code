import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { quotaEpisode } from '@savant-code/common/providers/provider-quota-policy'
import { expect, test } from 'bun:test'

import { readProviderQuota } from '../provider-quota'

test('quota episodes distinguish unknown, zero and low, with hysteresis and observed resets', () => {
  const reading = {
    status: 'ok' as const,
    amount: 5,
    limit: 100,
    reading: '5 tokens',
    unit: 'tokens',
    note: '',
    url: 'https://test',
  }
  let episode = quotaEpisode(
    undefined,
    { status: 'unavailable', detail: 'unknown' },
    100,
  )
  expect(episode.level).toBe('unknown')
  episode = quotaEpisode(episode, reading, 100)
  expect(episode.level).toBe('approaching_limit')
  expect(quotaEpisode(episode, { ...reading, amount: 12 }, 100).revision).toBe(
    episode.revision,
  )
  episode = quotaEpisode(episode, { ...reading, amount: 20 }, 100)
  expect(episode.level).toBe('healthy')
  expect(
    quotaEpisode(episode, { ...reading, amount: 0, limit: undefined }, 100)
      .level,
  ).toBe('exhausted')
  expect(
    quotaEpisode(undefined, { ...reading, limit: undefined }, 100).level,
  ).toBe('healthy')
  const old = { level: 'approaching_limit' as const, revision: 1, resetAt: 50 }
  expect(quotaEpisode(old, { ...reading, resetAt: 200 }, 100).revision).toBe(2)
})
test('declared credential auth rejects redirects and malicious origins; failures redact secrets', async () => {
  const config = getEffectiveProviderRegistry().bai
  let called = false
  const transport = Object.assign(
    async (
      _: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      called = true
      expect(init?.redirect).toBe('error')
      throw new Error('placeholder-secret response')
    },
    { preconnect: fetch.preconnect },
  )
  const result = await readProviderQuota({
    config,
    key: 'placeholder-secret',
    fetchImpl: transport,
  })
  expect(called).toBe(true)
  expect(JSON.stringify(result)).not.toContain('placeholder-secret')
  called = false
  expect(
    (
      await readProviderQuota({
        config: {
          ...config,
          quota: { ...config.quota!, url: 'https://untrusted.test/quota' },
        },
        key: 'placeholder',
        fetchImpl: transport,
      })
    ).status,
  ).toBe('unavailable')
  expect(called).toBe(false)
})
