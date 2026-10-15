import {
  catalogProviderFacts,
  type NoticeCatalog,
} from '@savant-code/common/providers/provider-notice-catalog'
import {
  acknowledgeProviderNotice,
  applyProviderFacts,
  emptyProviderNoticeState,
  type ProviderNotice,
  type ProviderFact,
} from '@savant-code/common/providers/provider-notifications'

import { ProviderNoticeStorage } from './provider-notice-storage'
import { loadModelSelection } from './settings'

type Sink = (notices: ProviderNotice[]) => boolean | Promise<boolean>
export class ProviderNotificationCoordinator {
  private readonly sinks = new Map<string, Sink>()
  private draining: Promise<void> | undefined
  private deliveryRequested = false
  private readonly presented = new Map<string, Set<string>>()
  constructor(
    readonly storage = new ProviderNoticeStorage(),
    private readonly now = Date.now,
  ) {}
  snapshot() {
    const { revision, notices } = this.storage.presentation()
    return { revision, notices }
  }
  subscribe(surface: string, sink: Sink): () => void {
    this.sinks.set(surface, sink)
    void this.deliver().catch(() => {})
    return () => {
      if (this.sinks.get(surface) === sink) this.sinks.delete(surface)
    }
  }
  observeCatalog(catalog: NoticeCatalog): void {
    const selection = loadModelSelection()
    if (
      !catalogProviderFacts(
        catalog,
        emptyProviderNoticeState(),
        { model: '' },
        this.now(),
      )
    )
      return
    try {
      this.storage.read()
    } catch {
      try {
        this.storage.recover()
      } catch {
        /* stage retains fresh evidence in memory. */
      }
      this.observe('store-recovery', [
        {
          key: 'recovery',
          value: 'rebuilt',
          providerId: 'monitor',
          kind: 'summary',
          severity: 'warning',
          selected: true,
          message:
            'Provider notification state was rebuilt from fresh evidence. The corrupt original is retained beside the inbox file for diagnosis.',
        },
      ])
    }
    this.storage.stage((state) => {
      const facts = catalogProviderFacts(
        catalog,
        state,
        {
          model: selection?.model ?? '',
          providerId: selection?.route.providerId,
        },
        this.now(),
      )
      if (!facts) return state
      const next = applyProviderFacts(
        state,
        'catalog',
        Date.parse(catalog.fetchedAt),
        facts.filter((f) => f.kind !== 'expiry'),
        this.now(),
      )
      return applyProviderFacts(
        next,
        'catalog-expiry',
        this.now(),
        facts.filter((f) => f.kind === 'expiry'),
        this.now(),
      )
    })
    void this.deliver().catch(() => {})
  }
  observe(
    source: string,
    facts: ProviderFact[],
    observedAt = this.now(),
  ): void {
    this.storage.stage((state) =>
      applyProviderFacts(state, source, observedAt, facts, this.now()),
    )
    void this.deliver().catch(() => {})
  }
  acknowledge(
    id: string,
    surface: string,
    action: 'accepted' | 'read' | 'dismiss',
  ): void {
    this.storage.update((state) =>
      acknowledgeProviderNotice(state, id, surface, action),
    )
  }
  deliver(): Promise<void> {
    this.deliveryRequested = true
    if (this.draining) return this.draining
    this.draining = Promise.resolve()
      .then(() => this.drain())
      .finally(() => {
        this.draining = undefined
        if (this.deliveryRequested) void this.deliver().catch(() => {})
      })
    return this.draining
  }
  private async drain(): Promise<void> {
    do {
      this.deliveryRequested = false
      for (const [surface, sink] of this.sinks) {
        const notices = this.snapshot().notices.filter(
          (n) => !n.dismissed && !n.acceptedBy.includes(surface),
        )
        const presented = this.presented.get(surface) ?? new Set<string>()
        const currentKeys = new Set(
          this.snapshot().notices.map(presentationIdentity),
        )
        for (const key of presented)
          if (!currentKeys.has(key)) presented.delete(key)
        const fresh = notices.filter(
          (n) => !presented.has(presentationIdentity(n)),
        )
        if (!notices.length || (fresh.length && !(await sink(fresh)))) continue
        for (const n of fresh) presented.add(presentationIdentity(n))
        this.presented.set(surface, presented)
        this.storage.update((state) =>
          notices.reduce((next, n) => {
            const current = next.notices.find((row) => row.id === n.id)
            return current &&
              presentationIdentity(current) === presentationIdentity(n)
              ? acknowledgeProviderNotice(next, n.id, surface, 'accepted')
              : next
          }, state),
        )
      }
    } while (this.deliveryRequested)
  }
}
function presentationIdentity(n: ProviderNotice): string {
  return JSON.stringify([n.id, n.createdAt, n.selected, n.resolved, n.message])
}
export const providerNotifications = new ProviderNotificationCoordinator()
