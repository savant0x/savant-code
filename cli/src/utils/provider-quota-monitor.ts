import {
  getModelRouteConfig,
  type ModelRoute,
} from '@savant-code/common/providers/model-route'
import { providerAccountRevision } from '@savant-code/common/providers/provider-account-revisions'
import { quotaEpisode } from '@savant-code/common/providers/provider-quota-policy'

import { providerNotifications } from './provider-notifications'
import { readProviderQuota, type ProviderQuotaResult } from './provider-quota'

import type { ProviderConfig } from '@savant-code/common/providers/types'

export class ProviderQuotaMonitor {
  private readonly backoff = new Map<string, number>()
  constructor(
    private readonly signal: AbortSignal,
    private readonly now = Date.now,
    private readonly reader = readProviderQuota,
    private readonly coordinator = providerNotifications,
  ) {}
  async measure(
    route: ModelRoute,
    selected: boolean,
    values: Record<string, string | undefined>,
    refusal: boolean,
  ): Promise<void> {
    const config = getModelRouteConfig(route)
    if (!config.quota || this.signal.aborted) return
    const key = config.credentials.envVar
      ? values[config.credentials.envVar]?.trim()
      : undefined
    if (!key) return
    const source = `quota-${config.id}-${route.configRevision}-${providerAccountRevision(config)}`
    this.invalidateAccount(config.id, source)
    const state = this.coordinator.storage.presentation()
    if (
      this.now() < (this.backoff.get(source) ?? 0) ||
      (!refusal && this.now() - (state.sourceTimes[source] ?? 0) < 15 * 60_000)
    )
      return
    const quota = await this.reader({ config, key, signal: this.signal })
    if (this.signal.aborted) return
    getModelRouteConfig(route)
    if (quota.status !== 'ok') {
      this.backoff.set(source, this.now() + (quota.retryAfterMs ?? 60_000))
      return
    }
    this.accept(config, source, selected, quota)
  }
  private invalidateAccount(id: string, source: string): void {
    this.coordinator.storage.stage((s) => {
      if (s.facts[`quota-account:${id}`] === source) return s
      return {
        ...s,
        revision: s.revision + 1,
        facts: { ...s.facts, [`quota-account:${id}`]: source },
        notices: s.notices.map((n) =>
          n.providerId === id && n.kind.startsWith('quota-')
            ? { ...n, resolved: true, revision: s.revision + 1 }
            : n,
        ),
      }
    })
  }
  private accept(
    config: ProviderConfig,
    source: string,
    selected: boolean,
    quota: ProviderQuotaResult,
  ): void {
    if (quota.status !== 'ok' || quota.amount === undefined) return
    this.coordinator.storage.stage((s) => {
      const metadata = s.facts[`${source}:episode`]
      const episode = quotaEpisode(
        metadata ? JSON.parse(metadata) : undefined,
        quota,
        this.now(),
      )
      return {
        ...s,
        revision: s.revision + 1,
        facts: { ...s.facts, [`${source}:episode`]: JSON.stringify(episode) },
      }
    })
    const episode = JSON.parse(
      this.coordinator.storage.presentation().facts[`${source}:episode`],
    ) as ReturnType<typeof quotaEpisode>
    const level = episode.level
    this.coordinator.observe(
      source,
      [
        {
          key: 'balance',
          value: `${level}:${episode.revision}`,
          providerId: config.id,
          selected,
          kind:
            level === 'exhausted'
              ? 'quota-exhausted'
              : level === 'low'
                ? 'quota-low'
                : 'quota-recovered',
          severity: level === 'ok' ? 'info' : 'warning',
          message: `${config.label}: ${level === 'ok' ? 'quota reading available' : `quota ${level}`} (${quota.reading}). ${quota.note}`,
        },
      ],
      this.now(),
    )
  }
}
