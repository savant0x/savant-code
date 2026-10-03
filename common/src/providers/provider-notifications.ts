import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'
import { z } from 'zod/v4'

const identity = z.string().min(1).max(512)
export const providerNoticeSchema = z
  .object({
    id: identity,
    revision: z.number().int().nonnegative(),
    providerId: identity,
    modelId: identity.optional(),
    kind: z.enum([
      'summary',
      'model-added',
      'model-removed',
      'health-down',
      'health-up',
      'quota-low',
      'quota-exhausted',
      'quota-recovered',
      'expiry',
      'fallback-attempt',
      'fallback-outcome',
    ]),
    severity: z.enum(['info', 'warning', 'critical']),
    episode: z.number().int().positive(),
    createdAt: z.number().finite().nonnegative(),
    message: z.string().min(1).max(2000),
    selected: z.boolean(),
    unread: z.boolean(),
    dismissed: z.boolean(),
    resolved: z.boolean().optional(),
    acceptedBy: z.array(identity),
    aggregateCount: z.number().int().positive().optional(),
  })
  .strict()
export type ProviderNotice = z.infer<typeof providerNoticeSchema>
export const providerNoticeEventSchema = z.object({
  type: z.literal('provider_notice'),
  notice: providerNoticeSchema,
})
export const providerNoticeSnapshotSchema = z.object({
  revision: z.number().int().nonnegative(),
  notices: z.array(providerNoticeSchema),
})
export const providerNoticeStoreSchema = providerNoticeSnapshotSchema.extend({
  version: z.literal(1),
  facts: z.record(z.string(), z.string()),
  episodes: z.record(z.string(), z.number().int().nonnegative()),
  sourceTimes: z.record(z.string(), z.number().finite().nonnegative()),
})
export type ProviderNoticeState = z.infer<typeof providerNoticeStoreSchema>
export function emptyProviderNoticeState(): ProviderNoticeState {
  return {
    version: 1,
    revision: 0,
    notices: [],
    facts: {},
    episodes: {},
    sourceTimes: {},
  }
}

export type ProviderFact = {
  key: string
  value: string
  providerId: string
  modelId?: string
  kind: ProviderNotice['kind']
  severity: ProviderNotice['severity']
  selected: boolean
  message: string
}

/** Commit a complete source snapshot. No timestamp/prose noise participates. */
export function applyProviderFacts(
  state: ProviderNoticeState,
  source: string,
  observedAt: number,
  facts: ProviderFact[],
  now: number,
): ProviderNoticeState {
  if (
    !Number.isFinite(observedAt) ||
    observedAt > now ||
    now - observedAt > 24 * 3600_000 ||
    observedAt < (state.sourceTimes[source] ?? 0)
  )
    return state
  if (observedAt === state.sourceTimes[source]) {
    const next = structuredClone(state)
    next.revision++
    for (const fact of facts) {
      const key = `${source}:${fact.key}`
      if (next.facts[key] === fact.value)
        updateSelection(next, key, fact.selected)
    }
    return next.notices.some((n) => n.revision === next.revision) ? next : state
  }
  const next = structuredClone(state)
  next.revision += 1
  const first = next.sourceTimes[source] === undefined
  next.sourceTimes[source] = observedAt
  for (const fact of facts) applyFact(next, source, fact, first, now)
  if (first)
    next.notices.push(summaryNotice(source, next.revision, now, facts.length))
  next.notices = retainProviderNotices(next.notices, now)
  return next
}

function applyFact(
  next: ProviderNoticeState,
  source: string,
  fact: ProviderFact,
  first: boolean,
  now: number,
): void {
  const key = `${source}:${fact.key}`
  if (next.facts[key] === fact.value) {
    updateSelection(next, key, fact.selected)
    return
  }
  next.facts[key] = fact.value
  for (const notice of next.notices) {
    if (notice.id.startsWith(`${factIdentity(key)}:`) && !notice.resolved) {
      notice.resolved = true
      notice.revision = next.revision
    }
  }
  const episode = (next.episodes[key] ?? 0) + 1
  next.episodes[key] = episode
  if (first && (!fact.selected || fact.severity === 'info')) return
  const { key: factKey, value: factValue, ...noticeFields } = fact
  void factKey
  void factValue
  next.notices.push(
    providerNoticeSchema.parse({
      ...noticeFields,
      id: `${factIdentity(key)}:${episode}`,
      episode,
      revision: next.revision,
      createdAt: now,
      unread: true,
      dismissed: false,
      acceptedBy: [],
    }),
  )
}

function updateSelection(
  state: ProviderNoticeState,
  key: string,
  selected: boolean,
): void {
  for (const notice of state.notices) {
    if (
      !notice.id.startsWith(`${factIdentity(key)}:`) ||
      notice.selected === selected
    )
      continue
    notice.selected = selected
    notice.revision = state.revision
    if (selected && notice.severity !== 'info' && !notice.resolved)
      notice.acceptedBy = []
  }
}

function factIdentity(key: string): string {
  return bytesToHex(sha256(key))
}

function summaryNotice(
  source: string,
  revision: number,
  now: number,
  count: number,
): ProviderNotice {
  return {
    id: `${source}:summary:1`,
    revision,
    providerId: source,
    kind: 'summary',
    severity: 'info',
    episode: 1,
    createdAt: now,
    message: `Provider monitoring started: ${count} observations. Run /notifications to review updates.`,
    selected: false,
    unread: true,
    dismissed: false,
    acceptedBy: [],
  }
}

/** Selected unresolved warnings survive retention; acknowledged history is bounded. */
export function retainProviderNotices(
  notices: ProviderNotice[],
  now: number,
): ProviderNotice[] {
  const critical = notices.filter(
    (n) => n.selected && n.severity !== 'info' && !n.dismissed && !n.resolved,
  )
  const ordinary = notices.filter(
    (n) => !critical.includes(n) && now - n.createdAt <= 30 * 24 * 3600_000,
  )
  if (critical.length <= 1000)
    return [
      ...critical,
      ...ordinary.slice(-Math.max(0, 1000 - critical.length)),
    ].sort((a, b) => a.createdAt - b.createdAt)
  const overflow = critical.slice(0, critical.length - 999)
  const count = overflow.reduce((sum, n) => sum + (n.aggregateCount ?? 1), 0)
  return [
    ...critical.slice(-999),
    {
      ...overflow[0],
      id: 'active-warning-overflow',
      kind: 'summary',
      revision: Math.max(...overflow.map((n) => n.revision)),
      createdAt: now,
      acceptedBy: [],
      unread: true,
      aggregateCount: count,
      message: `${count} additional active selected-route warnings are grouped here. Affected providers: ${[...new Set(overflow.map((n) => n.providerId))].join(', ').slice(0, 1500)}. Review provider configuration and current health.`,
    },
  ]
}

/** Acceptance is separate from reading/dismissal; safe to repeat after a crash. */
export function acknowledgeProviderNotice(
  state: ProviderNoticeState,
  id: string,
  surface: string,
  action: 'accepted' | 'read' | 'dismiss',
): ProviderNoticeState {
  const next = structuredClone(state)
  const notice = next.notices.find((n) => n.id === id)
  if (!notice) return state
  if (action === 'accepted' && notice.acceptedBy.includes(surface)) return state
  if (
    (action === 'read' && !notice.unread) ||
    (action === 'dismiss' && notice.dismissed)
  )
    return state
  if (action === 'accepted') notice.acceptedBy.push(surface)
  else if (action === 'read') notice.unread = false
  else {
    notice.dismissed = true
    notice.unread = false
  }
  next.revision += 1
  notice.revision = next.revision
  return next
}
