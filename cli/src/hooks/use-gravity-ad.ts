import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { useEffect, useRef, useState } from 'react'

import { useTerminalLayout } from './use-terminal-layout'
import { getAdsEnabled } from '../commands/ads'
import { useChatStore } from '../state/chat-store'
import { isUserActive, subscribeToActivity } from '../utils/activity-tracker'
import { IS_SAVANT_FREE } from '../utils/constants'
import { isDirectProviderMode } from '../utils/env'
import {
  createLazyResponseAdQueue,
  MAX_RESPONSE_AD_POOL_SIZE,
  requestLazyResponseAds,
} from '../utils/lazy-response-ads'
import {
  addToChoiceCache,
  isInlineAdEligibleAnswer,
  nextFromChoiceCache,
  trackInlineAdEvent,
  useHasUserMessaged,
} from './use-gravity-ad/helpers'
import { createAdNetwork } from './use-gravity-ad/network'
import { AD_CONSTANTS } from './use-gravity-ad/types'

import type {
  AdProvider,
  AdResponse,
  GravityAdOptions,
  GravityAdState,
  GravityController,
} from './use-gravity-ad/types'
import type { JSONValue } from '@savant-code/common/types/json'

export type {
  AdResponse,
  AdProvider,
  AdSurface,
  GravityAdState,
  GravityAdOptions,
} from './use-gravity-ad/types'
export {
  isAnswerMessage,
  isInlineAdEligibleAnswer,
  claimAdImpression,
} from './use-gravity-ad/helpers'

/**
 * Fetches the rotating ad slot and, with `inline`, one reusable placement each
 * time another interspersed response slot becomes eligible. Short answers make
 * no unnecessary inline requests; long answers repeat a pool of four ads.
 */
export const useGravityAd = (options?: GravityAdOptions): GravityAdState => {
  const enabled = options?.enabled ?? true
  const forceStart = options?.forceStart ?? false
  const provider: AdProvider = options?.provider ?? 'gravity'
  const surface = options?.surface
  const inline = options?.inline ?? false
  const inlinePlacementId = options?.inlinePlacementId
  const slotPlacementId = options?.slotPlacementId
  const [ads, setAds] = useState<AdResponse[] | null>(null)
  const [responseAds, setResponseAds] = useState<Record<string, AdResponse[]>>(
    {},
  )
  const [isLoading, setIsLoading] = useState(false)

  // Check if terminal height is too small to show ads
  const { terminalHeight } = useTerminalLayout()
  const isVeryCompactHeight = terminalHeight <= 17

  // SavantFree always shows ads even on compact screens (ads are mandatory there).
  const isFreeMode = IS_SAVANT_FREE

  // Skip ads on very compact screens unless we're in SavantFree (where ads are mandatory)
  // Also skip if explicitly disabled (e.g. user has a subscription)
  const shouldHideAds = !enabled || (isVeryCompactHeight && !isFreeMode)

  // forceStart lets callers (e.g. the landing screen) opt out of the
  // "wait for the first user message" gate.
  const hasUserMessagedStore = useHasUserMessaged()
  const shouldStart = forceStart || hasUserMessagedStore

  // Single consolidated controller ref
  const ctrlRef = useRef<GravityController>({
    choiceCache: [],
    choiceCacheIndex: 0,
    impressionsFired: new Set(),
    adsShownSinceActivity: 0,
    tickInFlight: false,
    inlineQueue: createLazyResponseAdQueue<AdResponse>(),
    eligibleSlotCounts: new Map(),
  })

  // Ref for the tick function (avoids useCallback dependency issues)
  const tickRef = useRef<() => void>(() => {})

  // Ref to track whether ads should be hidden for use in async code
  const shouldHideAdsRef = useRef(shouldHideAds)
  shouldHideAdsRef.current = shouldHideAds

  const { recordImpressionOnce, recordClick, fetchAd } = createAdNetwork({
    provider,
    surface,
    ctrlRef,
    shouldHideAdsRef,
    setAds,
  })

  // Update tick function (uses ref to avoid useCallback dependency issues)
  tickRef.current = () => {
    void (async () => {
      const ctrl = ctrlRef.current
      if (ctrl.tickInFlight) return
      ctrl.tickInFlight = true

      try {
        if (!getAdsEnabled()) return

        // Derive "can fetch new ads" from counter and activity (no separate paused ref needed)
        const canFetchNew =
          ctrl.adsShownSinceActivity < AD_CONSTANTS.maxAdsAfterActivity &&
          isUserActive(AD_CONSTANTS.activityThresholdMs)

        const result = canFetchNew
          ? await fetchAd({ placementId: slotPlacementId })
          : null

        if (result) {
          addToChoiceCache(ctrl, result.ads)
          ctrl.adsShownSinceActivity += 1
          setAds(result.ads)
        } else {
          // Fall back to cached ads
          const cachedSet = nextFromChoiceCache(ctrl)
          if (cachedSet) {
            ctrl.adsShownSinceActivity += 1
            setAds(cachedSet)
          } else {
            setAds((cur) => (cur?.[0]?.provider === 'zeroclick' ? null : cur))
          }
        }
      } finally {
        ctrl.tickInFlight = false
      }
    })()
  }

  // Reset ads shown counter on user activity
  useEffect(() => {
    if (!getAdsEnabled()) return
    return subscribeToActivity(() => {
      ctrlRef.current.adsShownSinceActivity = 0
    })
  }, [])

  // Start rotation when user sends first message (or immediately if forced).
  useEffect(() => {
    if (!shouldStart || !getAdsEnabled() || shouldHideAds) return

    setIsLoading(true)

    // Fetch first ad immediately
    void (async () => {
      const result = await fetchAd({ placementId: slotPlacementId })
      if (result) {
        const ctrl = ctrlRef.current
        addToChoiceCache(ctrl, result.ads)
        setAds(result.ads)
        ctrl.adsShownSinceActivity = 1
      }
      setIsLoading(false)
    })()

    // Start interval for rotation (consistent 60s intervals)
    const id = setInterval(
      () => tickRef.current(),
      AD_CONSTANTS.rotationIntervalMs,
    )

    return () => {
      clearInterval(id)
    }
  }, [shouldStart, shouldHideAds, provider, surface])

  // Called by BlocksRenderer only when its streamed node count makes another
  // between-node slot eligible, until the four-ad pool is full. Requests use
  // the same placement id and are serialized per answer so higher-value early
  // results retain their order. The renderer cycles that exact pool for later
  // slots without additional auctions or impression events.
  const requestResponseAds = (messageId: string, count: number): void => {
    if (
      !inline ||
      !inlinePlacementId ||
      count <= 0 ||
      shouldHideAdsRef.current ||
      !getAdsEnabled()
    ) {
      return
    }

    const messages = useChatStore.getState().messages
    const answer = messages.find((m) => m.id === messageId)
    if (!answer || !isInlineAdEligibleAnswer(answer)) {
      return
    }

    const ctrl = ctrlRef.current
    const previousEligibleCount = ctrl.eligibleSlotCounts.get(messageId) ?? 0
    if (count > previousEligibleCount) {
      ctrl.eligibleSlotCounts.set(messageId, count)
      const telemetryProperties: Record<string, JSONValue> = {
        response_id: messageId,
        chat_session_id: useChatStore.getState().chatSessionId,
        eligible_slot_count: count,
        pool_size: MAX_RESPONSE_AD_POOL_SIZE,
        provider,
        placement_id: inlinePlacementId,
        is_savant_free: IS_SAVANT_FREE,
        ...(surface ? { surface } : {}),
      }
      trackInlineAdEvent(
        AnalyticsEvent.CLI_INLINE_AD_SLOT_ELIGIBLE,
        telemetryProperties,
      )

      if (
        count > MAX_RESPONSE_AD_POOL_SIZE &&
        previousEligibleCount <= MAX_RESPONSE_AD_POOL_SIZE
      ) {
        trackInlineAdEvent(
          AnalyticsEvent.CLI_INLINE_AD_POOL_REUSED,
          telemetryProperties,
        )
      }
    }

    void requestLazyResponseAds({
      queue: ctrl.inlineQueue,
      messageId,
      count,
      fetchOne: async () => {
        const result = await fetchAd({ placementId: inlinePlacementId })
        return result?.ads[0] ?? null
      },
      onAd: (ad) => {
        setResponseAds((prev) => ({
          ...prev,
          [messageId]: [...(prev[messageId] ?? []), ad],
        }))
      },
    })
  }

  // Ads are a backend monetization feature; direct-provider mode has no backend.
  if (isDirectProviderMode()) {
    return {
      ads: null,
      responseAds: {},
      requestResponseAds: () => {},
      isLoading: false,
      recordClick: () => {},
      recordImpression: () => {},
    }
  }

  // Don't return ads when ads should be hidden
  const visible = shouldStart && !shouldHideAds
  return {
    ads: visible ? ads : null,
    responseAds: visible ? responseAds : {},
    requestResponseAds,
    isLoading,
    recordClick,
    recordImpression: recordImpressionOnce,
  }
}
