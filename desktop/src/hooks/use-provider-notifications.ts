import { useEffect } from 'react'

import { useProviderNoticeStore } from '../state/provider-notifications'

import type { GatewayClient } from '../lib/gateway-client'
import type { ProviderNotice } from '@savant-code/common/providers/provider-notifications'

export function useProviderNotifications(client: GatewayClient): void {
  useEffect(() => {
    let active = true
    let generation = 0
    const accept = async (notices: ProviderNotice[]) => {
      if (!active) return
      useProviderNoticeStore.getState().merge(notices)
      for (const n of notices) {
        if (!active) return
        if (!n.acceptedBy.includes('desktop'))
          await client.providerNotices.acknowledge(n.id, 'accepted')
      }
    }
    const refresh = async () => {
      if (!client.providerNotices.enabled) return
      const current = ++generation
      useProviderNoticeStore.getState().setLoading(true)
      try {
        const snapshot = await client.providerNotices.snapshot()
        if (!active || current !== generation) return
        useProviderNoticeStore.getState().hydrate(snapshot)
        await accept(snapshot.notices)
        useProviderNoticeStore.getState().setError('')
      } catch {
        if (active && current === generation) {
          useProviderNoticeStore.getState().setLoading(false)
          useProviderNoticeStore
            .getState()
            .setError(
              'Provider notification sync failed. Retry when connected.',
            )
        }
      }
    }
    const offStatus = client.onStatus((s) => {
      if (s === 'ready') void refresh()
    })
    const offGap = client.onReplayGap(() => {
      void refresh()
    })
    const offEvents = client.onEvents((events) => {
      void accept(
        events.flatMap((e) => (e.type === 'provider_notice' ? [e.notice] : [])),
      ).catch(() => {
        if (active)
          useProviderNoticeStore
            .getState()
            .setError(
              'Provider notice acknowledgement failed; delivery will retry.',
            )
      })
    })
    if (client.getStatus() === 'ready') void refresh()
    return () => {
      active = false
      generation++
      offStatus()
      offGap()
      offEvents()
    }
  }, [client])
}
