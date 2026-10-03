import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test } from 'bun:test'

import { ProviderNoticeStorage } from '../../utils/provider-notice-storage'
import { ProviderNotificationCoordinator } from '../../utils/provider-notifications'
import { HostedFallbackNotices } from '../use-savant-free-session/fallback-notices'

test('hosted fallback explains attempt and admission outcome once per unavailable episode', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hosted-fallback-'))
  let now = Date.now()
  try {
    const service = new ProviderNotificationCoordinator(
      new ProviderNoticeStorage(dir),
      () => ++now,
    )
    const adapter = new HostedFallbackNotices(service)
    adapter.attempted('preferred', 'fallback')
    adapter.attempted('preferred', 'fallback')
    adapter.outcome(true)
    adapter.outcome(true)
    let notices = service.snapshot().notices.filter((n) => n.kind !== 'summary')
    expect(notices.map((n) => n.kind)).toEqual([
      'fallback-attempt',
      'fallback-outcome',
    ])
    expect(notices[0].message).toContain('admission is pending')
    expect(notices[1].message).toContain('admission succeeded')
    now++
    adapter.attempted('preferred', 'fallback')
    now++
    adapter.outcome(false)
    notices = service.snapshot().notices.filter((n) => n.kind !== 'summary')
    expect(notices).toHaveLength(4)
    expect(notices[3].message).toContain('admission failed')
    expect(notices[2].episode).toBe(2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
