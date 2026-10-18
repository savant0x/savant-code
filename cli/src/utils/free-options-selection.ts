import { canonicalProviderId } from '@savant-code/common/providers/readiness'

import { assessCodingModel } from './openrouter-models/catalog-filter'

import type {
  FreeCatalogModel,
  FreeLane,
  FreeOfferRow,
  FreeOptionsReport,
} from './free-options-types'

type ExclusionReason =
  | 'duplicate'
  | 'expired'
  | 'expiry-unverified'
  | 'specialist'
  | 'non-text'
  | 'purpose-unverified'
  | 'tools-unsupported'
  | 'category'
  | 'invalid-link'

export type FreeOptionsSelection = {
  excludedModels: number
  excludedOffers: number
  unverifiedModels: number
  reasons: Partial<Record<ExclusionReason, number>>
}

/** A date-only advertised deadline remains active through that whole UTC day. */
function deadlineMs(value: string): number {
  const day = /^\d{4}-\d\d-\d\d/.exec(value)?.[0]
  if (!day) return Number.NaN
  const calendar = Date.parse(`${day}T00:00:00Z`)
  if (
    !Number.isFinite(calendar) ||
    new Date(calendar).toISOString().slice(0, 10) !== day
  )
    return Number.NaN
  return Date.parse(
    /^\d{4}-\d\d-\d\d$/.test(value) ? `${value}T23:59:59.999Z` : value,
  )
}

export function freeOfferDeadline(row: FreeOfferRow): number | null {
  if (row.deadlineMs !== undefined && row.deadlineMs !== null)
    return row.deadlineMs
  const day = /^advertised deadline (\d{4}-\d\d-\d\d)$/.exec(
    row.deadlineLabel,
  )?.[1]
  return day
    ? deadlineMs(day)
    : row.deadlineLabel.startsWith('advertised deadline')
      ? Number.NaN
      : null
}

function offerExclusion(
  row: FreeOfferRow,
  nowMs: number,
): ExclusionReason | null {
  const deadline = freeOfferDeadline(row)
  if (deadline !== null && !Number.isFinite(deadline))
    return 'expiry-unverified'
  if (deadline !== null && deadline <= nowMs) return 'expired'
  if (row.deadlineLabel === 'deadline unverified') return 'expiry-unverified'
  if (
    !['coding', 'api providers'].includes(
      row.category?.trim().toLowerCase() ?? '',
    )
  )
    return 'category'
  try {
    if (new URL(row.url).protocol !== 'https:') return 'invalid-link'
  } catch {
    return 'invalid-link'
  }
  return assessCodingModel({ id: row.title }).reason
}

/** Select without mutating or discarding the broad discovery report. No IO/clock reads. */
export function selectCodingFreeOptions(
  report: FreeOptionsReport,
  nowMs: number,
): { report: FreeOptionsReport; selection: FreeOptionsSelection } {
  if (!Number.isFinite(nowMs))
    throw new Error('Free-options selection requires a finite clock')
  const selection: FreeOptionsSelection = {
    excludedModels: 0,
    excludedOffers: 0,
    unverifiedModels: 0,
    reasons: {},
  }
  const count = (reason: ExclusionReason, kind: 'model' | 'offer') => {
    selection.reasons[reason] = (selection.reasons[reason] ?? 0) + 1
    if (kind === 'model') selection.excludedModels += 1
    else selection.excludedOffers += 1
  }
  const keyFor = (provider: string, id: string) =>
    `${canonicalProviderId(provider)}\0${id}`
  const evidence = new Map<string, FreeCatalogModel>()
  for (const model of report.catalogModels ?? [])
    if (!evidence.has(keyFor(model.providerId, model.id)))
      evidence.set(keyFor(model.providerId, model.id), model)
  const seen = new Set<string>()
  const eligibleIds = new Set<string>()
  const selectLane = <T extends FreeLane>(lane: T): T => ({
    ...lane,
    models: lane.models.filter((id) => {
      const key = keyFor(lane.providerId, id)
      if (seen.has(key)) {
        count('duplicate', 'model')
        return false
      }
      seen.add(key)
      const model: FreeCatalogModel = evidence.get(key) ?? {
        id,
        providerId: lane.providerId,
        context_length: null,
      }
      const expiry = model.expirationDate
        ? deadlineMs(model.expirationDate)
        : null
      const assessment = assessCodingModel(model)
      const reason =
        expiry !== null && !Number.isFinite(expiry)
          ? 'expiry-unverified'
          : expiry !== null && expiry <= nowMs
            ? 'expired'
            : assessment.reason
      if (reason) {
        count(reason, 'model')
        return false
      }
      if (!assessment.verified) selection.unverifiedModels += 1
      eligibleIds.add(id)
      return true
    }),
  })
  const wiredFree = report.wiredFree
    .map(selectLane)
    .filter((lane) => lane.models.length > 0)
  const notWired = report.notWired
    .map(selectLane)
    .filter((lane) => lane.models.length > 0)
  const discoveryOnly = (report.discoveryOnly ?? [])
    .map(selectLane)
    .filter((lane) => lane.models.length > 0)
  const seenOffers = new Set<string>()
  const discoveryOffers = (report.discoveryOffers ?? []).filter((row) => {
    const reason = seenOffers.has(row.url)
      ? 'duplicate'
      : offerExclusion(row, nowMs)
    seenOffers.add(row.url)
    if (reason) count(reason, 'offer')
    return reason === null
  })
  return {
    selection,
    report: {
      ...report,
      wiredFree,
      notWired,
      discoveryOnly,
      discoveryOffers,
      newModelIds: (report.newModelIds ?? []).filter((id) =>
        eligibleIds.has(id),
      ),
      discoveryOffersEndingSoon: discoveryOffers.filter((row) => {
        const end = freeOfferDeadline(row)
        return end !== null && end > nowMs && end - nowMs <= 72 * 3600_000
      }).length,
    },
  }
}
