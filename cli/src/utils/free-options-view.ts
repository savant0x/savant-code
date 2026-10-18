/**
 * FID-2026-1017-005 — one derived view for every free-options surface.
 *
 * The boot panel, the markdown export and `/provider free` used to read the
 * report through separate renderers, so counts and payload could diverge and
 * the boot surface never carried the complete list. This module turns the
 * report into the single ordered view those surfaces consume. It is pure: IO,
 * freshness resolution and artifact identity live elsewhere.
 */
import { offerCategoryGroups } from './free-options-offers'
import { selectCodingFreeOptions } from './free-options-selection'

import type { FreeOptionsSelection } from './free-options-selection'
import type { FreeOfferRow, FreeOptionsReport } from './free-options-types'

export type FreeOptionsViewMeta = {
  /** Resolved by `freeOptionsPaths()` by the caller, never hardcoded. */
  markdownPath: string
  /** ISO write time of the artifact this view will be rendered into. */
  generatedAt: string
  /** Optional boot label; the export uses its own data-age wording. */
  freshness?: string
  audience?: 'all' | 'coding'
  /** Required for coding selection; the pure view never reads the clock. */
  nowMs?: number
}

export type FreeOptionsViewCounts = {
  wiredProviders: number
  wiredModels: number
  notWiredProviders: number
  notWiredModels: number
  local: number
  discoveryOnly: number
  offers: number
  offersEndingSoon: number
  newModels: number
}

export type FreeOptionsView = {
  selection?: FreeOptionsSelection
  preview?: { hiddenModels: number; hiddenOffers: number }
  header: {
    freshness: string
    fetchedAt: string | null
    generatedAt: string
    markdownPath: string
    counts: FreeOptionsViewCounts
  }
  wired: Array<{ providerId: string; label: string; models: string[] }>
  notWired: Array<{
    providerId: string
    label: string
    models: string[]
    setupCommand: string
  }>
  local: Array<{ id: string; label: string; setupCommand: string }>
  discoveryOnly: Array<{ providerId: string; label: string; models: string[] }>
  offers: Array<{ category: string; rows: FreeOfferRow[] }>
  newModelIds: string[]
  /** Evidence-class wording for the wired section heading. */
  wiredCaveat: string
  quotaFootnote: string
}

/** Data-age wording for the export; the panel overrides it with boot truth. */
export function dataFreshnessLabel(report: FreeOptionsReport): string {
  if (!report.fetchedAt) return 'catalog unavailable'
  return report.stale
    ? `STALE — catalog older than 24h`
    : `catalog fetched ${report.fetchedAt}`
}

export function freeClaimCaveat(report: FreeOptionsReport): string {
  return report.catalogEvidence?.class === 'reported-unverified'
    ? 'reported free models; listing unverified'
    : 'advertised free models'
}

export function quotaCaveat(report: FreeOptionsReport): string {
  const reading = report.quotaReading
  if (!reading || reading.source === 'none' || reading.state === 'unknown')
    return 'account quota unverified'
  if (reading.state === 'unavailable') return 'account quota unavailable'
  if (reading.state === 'exhausted') return 'account quota observed exhausted'
  if (reading.state === 'approaching_limit')
    return 'account quota approaching limit'
  return 'account quota observed healthy'
}

export function quotaFootnote(report: FreeOptionsReport): string {
  const reading = report.quotaReading
  return !reading || reading.source === 'none' || reading.state === 'unknown'
    ? 'Configured keys and public listings do not verify your account quota'
    : `${quotaCaveat(report)} (source: ${reading.source})`
}

export function buildFreeOptionsView(
  report: FreeOptionsReport,
  meta: FreeOptionsViewMeta,
): FreeOptionsView {
  if (meta.audience === 'coding') {
    if (meta.nowMs === undefined || !Number.isFinite(meta.nowMs))
      throw new Error(
        'Coding free-options selection requires an explicit clock',
      )
    const selected = selectCodingFreeOptions(report, meta.nowMs)
    const view = buildFreeOptionsView(selected.report, {
      ...meta,
      audience: 'all',
    })
    return {
      ...view,
      selection: selected.selection,
      wiredCaveat: `${freeClaimCaveat(report)} — text candidates; coding suitability unverified`,
      quotaFootnote: `${selected.selection.unverifiedModels} candidate(s) lack verified text/tool metadata. ${view.quotaFootnote}`,
    }
  }
  const wired = report.wiredFree.map((lane) => ({
    providerId: lane.providerId,
    label: lane.label,
    models: [...lane.models],
  }))
  const notWired = report.notWired.map((lane) => ({
    providerId: lane.providerId,
    label: lane.label,
    models: [...lane.models],
    setupCommand: lane.setupCommand,
  }))
  const local = report.localFree.map((lane) => ({ ...lane }))
  const discoveryOnly = (report.discoveryOnly ?? []).map((lane) => ({
    providerId: lane.providerId,
    label: lane.label,
    models: [...lane.models],
  }))
  const offers = offerCategoryGroups(report.discoveryOffers ?? []).map(
    (group) => ({ category: group.category, rows: group.rows }),
  )

  const wiredModels = wired.reduce((n, lane) => n + lane.models.length, 0)
  const notWiredModels = notWired.reduce((n, lane) => n + lane.models.length, 0)
  const offerCount = (report.discoveryOffers ?? []).length

  return {
    header: {
      freshness: meta.freshness ?? dataFreshnessLabel(report),
      fetchedAt: report.fetchedAt,
      generatedAt: meta.generatedAt,
      markdownPath: meta.markdownPath,
      counts: {
        wiredProviders: wired.length,
        wiredModels,
        notWiredProviders: notWired.length,
        notWiredModels,
        local: local.length,
        discoveryOnly: discoveryOnly.length,
        offers: offerCount,
        offersEndingSoon: report.discoveryOffersEndingSoon ?? 0,
        newModels: report.newModelIds?.length ?? 0,
      },
    },
    wired,
    notWired,
    local,
    discoveryOnly,
    offers,
    newModelIds: [...(report.newModelIds ?? [])],
    wiredCaveat: freeClaimCaveat(report),
    quotaFootnote: `${quotaFootnote(report)}. Local registration does not verify a running server.`,
  }
}

/** Both the expanded boot panel and Copy consume this same bounded view. */
export function previewFreeOptionsView(view: FreeOptionsView): FreeOptionsView {
  const modelLimit = 5
  const offerLimit = 5
  let hiddenModels = 0
  const trimLane = <T extends { models: string[] }>(lane: T): T => {
    hiddenModels += Math.max(0, lane.models.length - modelLimit)
    return { ...lane, models: lane.models.slice(0, modelLimit) }
  }
  let remaining = offerLimit
  const offers = view.offers
    .map((group) => {
      const rows = group.rows.slice(0, remaining)
      remaining -= rows.length
      return { ...group, rows }
    })
    .filter((group) => group.rows.length > 0)
  return {
    ...view,
    wired: view.wired.map(trimLane),
    notWired: view.notWired.map(trimLane),
    // Unsupported integrations are provider summaries, with no model rows mounted.
    discoveryOnly: view.discoveryOnly,
    offers,
    preview: {
      hiddenModels,
      hiddenOffers: Math.max(0, view.header.counts.offers - offerLimit),
    },
  }
}

export function freeOptionsSelectionLine(view: FreeOptionsView): string {
  const selection = view.selection
  if (!selection) return ''
  const reasons = Object.entries(selection.reasons)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([reason, count]) => `${reason.replaceAll('-', ' ')} ${count}`)
    .join(', ')
  return `Coding focus: ${selection.excludedModels} model row(s) and ${selection.excludedOffers} offer row(s) filtered${reasons ? ` (${reasons})` : ''} · ${selection.unverifiedModels} candidate(s) unverified · full discovery: ${view.header.markdownPath}`
}

export function freeOptionsPreviewLine(view: FreeOptionsView): string {
  if (
    !view.preview ||
    (!view.preview.hiddenModels && !view.preview.hiddenOffers)
  )
    return ''
  return `Preview: ${view.preview.hiddenModels} more model(s), ${view.preview.hiddenOffers} more offer(s) · full discovery: ${view.header.markdownPath}`
}
