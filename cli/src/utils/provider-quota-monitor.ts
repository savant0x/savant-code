import {
  getModelRouteConfig,
  type ModelRoute,
} from '@savant-code/common/providers/model-route'
import { providerAccountRevision } from '@savant-code/common/providers/provider-account-revisions'
import { quotaEpisode } from '@savant-code/common/providers/provider-quota-policy'
import { quotaNoticeKindForTransition } from '@savant-code/common/providers/provider-quota-state'

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
    const priorRaw = this.coordinator.storage.presentation().facts[`${source}:episode`]
    let previous: ReturnType<typeof quotaEpisode> | undefined
    try {
      if (priorRaw) {
        const parsed: unknown = JSON.parse(priorRaw)
        if (typeof parsed === 'object' && parsed !== null &&
          'level' in parsed && typeof parsed.level === 'string' &&
          ['healthy', 'approaching_limit', 'exhausted', 'unavailable', 'unknown'].includes(parsed.level) &&
          'revision' in parsed && typeof parsed.revision === 'number' && Number.isFinite(parsed.revision))
          previous = parsed as ReturnType<typeof quotaEpisode>
      }
    } catch {
      // A corrupt legacy record is unknown, never an exhaustion fact.
    }
    this.coordinator.storage.stage((s) => {
      const episode = quotaEpisode(previous, quota, this.now())
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
    // FID-2026-1005-008: emission preconditions — a quota notice is
    // lawfully emitted only on a real transition (`quota-recovered`
    // requires a prior observed exhaustion; `unknown`/`unavailable` emit
    // nothing). Legacy-persisted levels fail to match the vocabulary and
    // normalize within one probe round (read-migration, no script).
    const kind = quotaNoticeKindForTransition(
      previous?.level ?? 'unknown',
      level,
      'authenticated-usage-api',
    )
    if (kind === null) return
    this.coordinator.observe(
      source,
      [
        {
          key: 'balance',
          value: `${level}:${episode.revision}`,
          providerId: config.id,
          selected,
          kind,
          severity: kind === 'quota-recovered' ? 'info' : 'warning',
          message: `${config.label}: ${kind === 'quota-recovered' ? 'quota recovered' : kind === 'quota-low' ? 'quota approaching limit' : 'quota exhausted'} (${quota.reading}). ${quota.note}`,
        },
      ],
      this.now(),
    )
  }
}
