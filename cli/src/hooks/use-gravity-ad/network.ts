import {
  claimAdImpression,
  convertToAdMessages,
  getAdUserAgent,
  getCliAdRequestUserAgent,
  getDeviceInfo,
} from './helpers'
import { AD_CONSTANTS } from './types'
import { WEBSITE_URL } from '../../branding/constants'
import { getAdsEnabled } from '../../commands/ads'
import { useChatStore } from '../../state/chat-store'
import { getAuthToken } from '../../utils/auth'
import { logger } from '../../utils/logger'

import type {
  AdProvider,
  AdResponse,
  AdSurface,
  GravityController,
} from './types'
import type { JSONValue } from '@savant-code/common/types/json'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

/** Everything the network layer needs from the hook, bundled so the fetch /
 *  impression / click routines stay pure of React state shapes. */
export interface AdNetworkContext {
  provider: AdProvider
  surface?: AdSurface
  ctrlRef: MutableRefObject<GravityController>
  shouldHideAdsRef: MutableRefObject<boolean>
  setAds: Dispatch<SetStateAction<AdResponse[] | null>>
}

type FetchAdResult = { ads: AdResponse[] } | null

export interface AdNetwork {
  recordImpressionOnce: (ad: AdResponse) => void
  recordClick: (ad: AdResponse) => void
  fetchAd: (params?: { placementId?: string }) => Promise<FetchAdResult>
}

export function createAdNetwork(ctx: AdNetworkContext): AdNetwork {
  const { provider, surface, ctrlRef, shouldHideAdsRef, setAds } = ctx

  // Fire impression and update credits (called when showing an ad)
  const recordImpressionOnce = (ad: AdResponse): void => {
    // Don't record impressions when ads should be hidden
    if (shouldHideAdsRef.current) return

    const ctrl = ctrlRef.current
    const { impUrl } = ad
    if (!claimAdImpression(ctrl.impressionsFired, impUrl)) return

    const recordLocalImpression = async (): Promise<void> => {
      const authToken = getAuthToken()
      if (!authToken) {
        logger.warn('[ads] No auth token, skipping local impression recording')
        return
      }

      // Include mode in request - SavantFree should not grant credits (no balance concept).
      const agentMode = useChatStore.getState().agentMode

      const res = await fetch(`${WEBSITE_URL}/api/v1/ads/impression`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'User-Agent': getCliAdRequestUserAgent(),
        },
        body: JSON.stringify({
          impUrl,
          mode: agentMode,
        }),
      })

      if (!res.ok) {
        logger.debug(
          { status: res.status },
          '[ads] Failed to record local ad impression',
        )
        return
      }

      const data = await res.json()
      if (data.creditsGranted > 0) {
        logger.info(
          { creditsGranted: data.creditsGranted },
          '[ads] Ad impression credits granted',
        )
        // Also update credits in visible ads
        setAds((cur) => {
          if (!cur) return cur
          return cur.map((a) =>
            a.impUrl === impUrl ? { ...a, credits: data.creditsGranted } : a,
          )
        })
      }
    }

    if (ad.provider === 'zeroclick' && ad.impressionIds?.length) {
      void (async () => {
        try {
          const res = await fetch(AD_CONSTANTS.zeroclickImpressionsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: ad.impressionIds }),
          })

          if (!res.ok) {
            logger.debug(
              { status: res.status },
              '[ads] Failed to record ZeroClick impression',
            )
            return
          }
        } catch (err) {
          logger.debug({ err }, '[ads] Failed to record ZeroClick impression')
          return
        }

        recordLocalImpression().catch((err) => {
          logger.debug({ err }, '[ads] Failed to record local ad impression')
        })
      })()
      return
    }

    recordLocalImpression().catch((err) => {
      logger.debug({ err }, '[ads] Failed to record ad impression')
    })
  }

  const recordClick = (ad: AdResponse): void => {
    const authToken = getAuthToken()
    if (!authToken) {
      logger.warn('[ads] No auth token, skipping ad click recording')
      return
    }

    void fetch(`${WEBSITE_URL}/api/v1/ads/click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
        'User-Agent': getCliAdRequestUserAgent(),
      },
      body: JSON.stringify({
        impUrl: ad.impUrl,
        ...(surface ? { surface } : {}),
      }),
    })
      .then((res) => {
        if (!res.ok) {
          logger.debug(
            { status: res.status },
            '[ads] Failed to record ad click',
          )
        }
      })
      .catch((err) => {
        logger.debug({ err }, '[ads] Failed to record ad click')
      })
  }

  // Fetch an ad via web API
  const fetchAd = async (params?: {
    placementId?: string
  }): Promise<FetchAdResult> => {
    // Don't fetch ads when they should be hidden
    if (shouldHideAdsRef.current) return null
    if (!getAdsEnabled()) return null

    const authToken = getAuthToken()
    if (!authToken) {
      logger.warn('[ads] No auth token available')
      return null
    }

    // Get message history from runState (populated after LLM responds)
    const currentRunState = useChatStore.getState().runState
    const messageHistory =
      currentRunState?.sessionState?.mainAgentState?.messageHistory ?? []
    const adMessages = convertToAdMessages(messageHistory)

    // Also check UI messages for the latest user message
    // (UI messages update immediately, runState.messageHistory updates after LLM responds)
    const uiMessages = useChatStore.getState().messages
    const lastUIMessage = [...uiMessages]
      .reverse()
      .find((msg) => msg.variant === 'user')

    // If the latest UI user message isn't in our converted history, append it
    // This ensures we always include the most recent user message even before LLM responds
    if (lastUIMessage?.content) {
      const lastAdUserMessage = [...adMessages]
        .reverse()
        .find((m) => m.role === 'user')
      if (
        !lastAdUserMessage ||
        !lastAdUserMessage.content.includes(lastUIMessage.content)
      ) {
        adMessages.push({
          role: 'user',
          content: `<user_message>${lastUIMessage.content}</user_message>`,
        })
      }
    }

    try {
      const response = await fetch(`${WEBSITE_URL}/api/v1/ads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'User-Agent': getCliAdRequestUserAgent(),
        },
        body: JSON.stringify({
          provider,
          messages: adMessages,
          sessionId: useChatStore.getState().chatSessionId,
          device: getDeviceInfo(),
          ...(surface ? { surface } : {}),
          ...(params?.placementId ? { placementId: params.placementId } : {}),
          // Carbon requires a real browser-ish useragent for targeting/fraud
          // detection. Gravity ignores it. We source one centrally so every
          // provider that needs it sees the same value.
          userAgent: getAdUserAgent(),
        }),
      })

      if (!response.ok) {
        let responseBody: JSONValue
        try {
          const contentType = response.headers.get('content-type') ?? ''
          responseBody = contentType.includes('application/json')
            ? await response.json()
            : await response.text()
        } catch {
          responseBody = 'Unable to parse error response'
        }
        logger.warn(
          { provider, status: response.status, response: responseBody },
          '[ads] Web API returned error',
        )
        return null
      }

      const data = await response.json()

      if (Array.isArray(data.ads) && data.ads.length > 0) {
        return {
          ads: (data.ads as AdResponse[]).map((ad) => ({
            ...ad,
            provider: data.provider ?? provider,
          })),
        }
      }
    } catch (err) {
      logger.error({ err, provider }, '[ads] Failed to fetch ad')
    }

    return null
  }

  return { recordImpressionOnce, recordClick, fetchAd }
}
