import { useEffect } from 'react'

import { useToastStore } from '../hooks/use-toast'
import {
  readCachedFreeOptionsReport,
  readCachedFreeCatalog,
  refreshFreeOptions,
} from '../utils/free-options'
import { startProviderMonitoring } from '../utils/provider-monitoring'
import {
  providerNotifications,
  type ProviderNotificationCoordinator,
} from '../utils/provider-notifications'

let refreshInFlight: Promise<void> | undefined
export function refreshProviderNotifications(): Promise<void> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = refreshFreeOptions()
    .then(() => {})
    .finally(() => {
      refreshInFlight = undefined
    })
  return refreshInFlight
}

/** Test isolation: drops the in-flight provider-notification refresh —
 *  process-lifetime state `bun test` shares across files (FID-2026-1007-002). */
export function resetRefreshInFlight(): void {
  refreshInFlight = undefined
}
export function mountProviderNotifications(
  coordinator: ProviderNotificationCoordinator = providerNotifications,
  startMonitoring = startProviderMonitoring,
  refresh = refreshProviderNotifications,
): () => void {
  const release = coordinator.subscribe('cli', (notices) => {
    const selected = notices.filter(
      (n) => n.selected && n.severity !== 'info' && !n.resolved,
    )
    if (selected.length)
      useToastStore.getState().addToast({
        message: `${selected.at(-1)!.message}${selected.length > 1 ? ` (${selected.length} route warnings.)` : ''} Run /notifications to review.`,
        variant: 'warning',
        duration: 0,
        retainedKey: 'provider-route-warning',
      })
    const other = notices.filter((n) => !selected.includes(n))
    const grouped = other.length
    if (grouped)
      useToastStore.getState().addToast({
        message: `${grouped} provider update(s). Run /notifications to review.`,
        variant: 'info',
      })
    return true
  })
  const stopMonitoring = startMonitoring()
  const cached = readCachedFreeOptionsReport()
  const catalog = readCachedFreeCatalog()
  if (catalog && cached && !cached.stale)
    try {
      coordinator.observeCatalog(catalog)
    } catch {
      /* Original inbox is retained. */
    }
  if (!cached || cached.stale) void refresh().catch(() => {})
  const timer = setInterval(() => {
    void refresh().catch(() => {})
  }, 24 * 3600_000)
  timer.unref?.()
  const deliveryTimer = setInterval(() => {
    void coordinator.deliver().catch(() => {})
  }, 1000)
  deliveryTimer.unref?.()
  return () => {
    clearInterval(timer)
    clearInterval(deliveryTimer)
    release()
    stopMonitoring()
  }
}
export function useProviderNotifications(): void {
  useEffect(() => mountProviderNotifications(), [])
}
