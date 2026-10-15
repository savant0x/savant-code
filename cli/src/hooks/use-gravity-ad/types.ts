import type { createLazyResponseAdQueue } from '../../utils/lazy-response-ads'

const AD_ROTATION_INTERVAL_MS = 60 * 1000 // 60 seconds per ad
const MAX_ADS_AFTER_ACTIVITY = 3 // Show up to 3 ads after last activity, then pause fetching new ads
const ACTIVITY_THRESHOLD_MS = 30_000 // 30 seconds idle threshold for fetching new ads
const MAX_AD_CACHE_SIZE = 50 // Maximum number of ads to keep in cache
const ZEROCLICK_IMPRESSIONS_URL = 'https://zeroclick.dev/api/v2/impressions'

// Ad response type (normalized shape across providers; credits added after impression)
export type AdResponse = {
  adText: string
  title: string
  cta: string
  url: string
  favicon: string
  clickUrl: string
  impUrl: string
  provider?: AdProvider
  impressionIds?: string[]
  credits?: number // Set after impression is recorded (in cents)
}

/**
 * Which upstream ad network to query. The server maps each provider onto the
 * same normalized response shape, so the rest of the hook is provider-agnostic.
 */
export type AdProvider = 'gravity' | 'carbon' | 'zeroclick'
// Product surfaces the ads API maps to Gravity placements. 'waiting_room' is the
// legacy wire name for the savant-free landing screen; 'cli_chat' is the inline
// transcript ad in the coding-agent chat. Values must match the server's
// AD_SURFACES enum, so don't rename them.
export type AdSurface = 'waiting_room' | 'cli_chat'

export type GravityAdState = {
  ads: AdResponse[] | null
  /**
   * On-demand ad pools keyed by assistant message id. The renderer repeats a
   * full pool when the response has more eligible slots than distinct ads.
   */
  responseAds: Record<string, AdResponse[]>
  /** Lazily fill the response's bounded ad pool as slots become eligible. */
  requestResponseAds: (messageId: string, count: number) => void
  isLoading: boolean
  recordClick: (ad: AdResponse) => void
  recordImpression: (ad: AdResponse) => void
}

// Consolidated controller state for the ad rotation logic
export type GravityController = {
  choiceCache: AdResponse[][] // Cache of ad sets (choice or single-ad units)
  choiceCacheIndex: number
  impressionsFired: Set<string>
  adsShownSinceActivity: number
  tickInFlight: boolean
  inlineQueue: ReturnType<typeof createLazyResponseAdQueue<AdResponse>>
  eligibleSlotCounts: Map<string, number>
}

export type GravityAdOptionsBase = {
  enabled?: boolean
  /** Skip the "wait for first user message" gate. Used by the savant-free
   *  landing screen, which has no conversation but still needs ads. */
  forceStart?: boolean
  /** Ad network to request first. The server owns fallback ordering. */
  provider?: AdProvider
  /** Product surface requesting the ad. The server maps this to placements. */
  surface?: AdSurface
  /** Explicit provider placement id for the rotating `ads[0]` slot. */
  slotPlacementId?: string
}

export type GravityAdOptions = GravityAdOptionsBase &
  (
    | {
        /** Lazily fetch interspersed ads as the assistant response grows. */
        inline: true
        /** Reusable provider placement id for every lazy inline auction. */
        inlinePlacementId: string
      }
    | {
        inline?: false
        inlinePlacementId?: never
      }
  )

/** Device info sent to the ads API for targeting */
export type DeviceInfo = {
  os: 'macos' | 'windows' | 'linux'
  timezone: string
  locale: string
}

export const AD_CONSTANTS = {
  rotationIntervalMs: AD_ROTATION_INTERVAL_MS,
  maxAdsAfterActivity: MAX_ADS_AFTER_ACTIVITY,
  activityThresholdMs: ACTIVITY_THRESHOLD_MS,
  maxAdCacheSize: MAX_AD_CACHE_SIZE,
  zeroclickImpressionsUrl: ZEROCLICK_IMPRESSIONS_URL,
}
