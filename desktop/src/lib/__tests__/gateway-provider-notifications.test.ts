import {
  applyProviderFacts,
  emptyProviderNoticeState,
} from '@savant-code/common/providers/provider-notifications'
import { describe, expect, test } from 'bun:test'

import {
  mergeProviderNotices,
  useProviderNoticeStore,
} from '../../state/provider-notifications'
import { GatewayProviderNotifications } from '../gateway-provider-notifications'

const notice = applyProviderFacts(
  emptyProviderNoticeState(),
  'health',
  100,
  [
    {
      key: 'p',
      value: 'down',
      providerId: 'p',
      selected: true,
      severity: 'warning',
      kind: 'health-down',
      message: 'Endpoint unavailable',
    },
  ],
  100,
).notices[0]
describe('desktop provider notice boundary', () => {
  test('requires negotiation, validates snapshots and sends surface-specific acknowledgements', async () => {
    const methods: string[] = []
    const client = new GatewayProviderNotifications({
      nextId: () => 1,
      dispatch: async (frame) => {
        methods.push(frame.method)
        if (frame.method === 'provider_notices_snapshot')
          return { revision: 1, notices: [notice] }
        expect(frame.params).toEqual({
          id: notice.id,
          action: 'read',
          surface: 'desktop',
        })
        return { accepted: true }
      },
    })
    await expect(client.snapshot()).rejects.toThrow('unavailable')
    expect(methods).toHaveLength(0)
    client.enabled = true
    expect((await client.snapshot()).notices[0].id).toBe(notice.id)
    await client.acknowledge(notice.id, 'read')
    expect(methods).toEqual([
      'provider_notices_snapshot',
      'provider_notices_ack',
    ])
  })
  test('snapshot/replay duplicates merge by revision in independent notice state', () => {
    const read = { ...notice, revision: 4, unread: false }
    expect(mergeProviderNotices([read], [notice, read])).toEqual([read])
    useProviderNoticeStore.getState().merge([read])
    expect(
      useProviderNoticeStore.getState().notices.some((n) => n.id === read.id),
    ).toBe(true)
    expect(() =>
      mergeProviderNotices([], [{ ...notice, kind: 'unknown' } as never]),
    ).toThrow()
  })
})
