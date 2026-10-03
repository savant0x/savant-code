import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { captureModelRoute } from '@savant-code/common/providers/model-route'
import { probeEndpoint } from '@savant-code/common/providers/probe-endpoint'
import { hasProviderCredentials } from '@savant-code/common/providers/readiness'

import { readCachedFreeCatalog } from './free-options'
import { readStoredProviderKeys } from './provider-credentials'
import { monitorProviderHealth } from './provider-health-monitor'
import { applyPersistedProviderApiKeys } from './provider-key-store'
import { onProviderSelectionChanged } from './provider-monitoring-events'
import { providerNotifications } from './provider-notifications'
import { refreshProviderOffers } from './provider-offers'
import { readProviderQuota } from './provider-quota'
import { ProviderQuotaMonitor } from './provider-quota-monitor'
import { loadModelSelection, loadSettings } from './settings'

export class ProviderMonitoring {
  private readonly running = new Map<string, Promise<void>>()
  private readonly quota: ProviderQuotaMonitor
  constructor(
    private readonly signal: AbortSignal,
    private readonly now = Date.now,
    private readonly probe = probeEndpoint,
    reader = readProviderQuota,
  ) {
    this.quota = new ProviderQuotaMonitor(signal, now, reader)
  }
  async refresh(
    quotaRefusal = false,
    requestedProvider?: string,
  ): Promise<void> {
    const settings = loadSettings()
    applyPersistedProviderApiKeys()
    const active = loadModelSelection()?.route.providerId
    const ids = [
      ...new Set([
        ...(active ? [active] : []),
        ...(settings.monitoredProviders ?? []),
      ]),
    ]
    const values = {
      ...readStoredProviderKeys(),
      ...Object.fromEntries(
        Object.entries(process.env).filter(([, v]) => v?.trim()),
      ),
    }
    const registry = getEffectiveProviderRegistry()
    const jobs = ids.filter(
      (id) =>
        (!requestedProvider || id === requestedProvider) &&
        Object.hasOwn(registry, id) &&
        hasProviderCredentials(registry[id], values),
    )
    for (let index = 0; index < jobs.length; index += 2) {
      await Promise.all(
        jobs
          .slice(index, index + 2)
          .map((id) => this.monitor(id, id === active, values, quotaRefusal)),
      )
    }
  }
  private monitor(
    id: string,
    selected: boolean,
    values: Record<string, string | undefined>,
    refusal: boolean,
  ): Promise<void> {
    const existing = this.running.get(id)
    if (existing) return existing
    const task = this.measure(id, selected, values, refusal).finally(() => {
      this.running.delete(id)
    })
    this.running.set(id, task)
    return task
  }
  private async measure(
    id: string,
    selected: boolean,
    values: Record<string, string | undefined>,
    refusal: boolean,
  ): Promise<void> {
    if (this.signal.aborted) return
    const route = captureModelRoute(id)
    await monitorProviderHealth(
      route,
      selected,
      this.signal,
      this.now,
      this.probe,
    )
    if (!this.signal.aborted)
      await this.quota.measure(route, selected, values, refusal)
  }
}

let monitor: ProviderMonitoring | undefined
let releases = 0
let stop: (() => void) | undefined
export function startProviderMonitoring(): () => void {
  if (monitor) {
    releases++
    return releaseMonitoring
  }
  const controller = new AbortController()
  monitor = new ProviderMonitoring(controller.signal)
  releases = 1
  const current = monitor
  const unsubscribe = onProviderSelectionChanged(() => {
    void current.refresh().catch(() => {})
    const catalog = readCachedFreeCatalog()
    if (catalog) providerNotifications.observeCatalog(catalog)
  })
  void current.refresh().catch(() => {})
  void refreshProviderOffers(controller.signal).catch(() => {})
  const timer = setInterval(() => {
    void current.refresh().catch(() => {})
  }, 15 * 60_000)
  timer.unref?.()
  const offerTimer = setInterval(() => {
    void refreshProviderOffers(controller.signal).catch(() => {})
    const catalog = readCachedFreeCatalog()
    if (catalog)
      try {
        providerNotifications.observeCatalog(catalog)
      } catch {
        /* Preserve last-good inbox. */
      }
  }, 60_000)
  offerTimer.unref?.()
  stop = () => {
    controller.abort()
    unsubscribe()
    clearInterval(timer)
    clearInterval(offerTimer)
    if (monitor === current) monitor = undefined
  }
  return releaseMonitoring
}
function releaseMonitoring(): void {
  if (--releases === 0) {
    stop?.()
    stop = undefined
  }
}
export function refreshQuotaAfterRefusal(providerId?: string): void {
  void monitor?.refresh(true, providerId).catch(() => {})
}
