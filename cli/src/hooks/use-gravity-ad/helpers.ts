import { AD_CONSTANTS } from './types'
import { useChatStore } from '../../state/chat-store'
import { AI_MESSAGE_ID_PREFIX } from '../../utils/ai-message-id'
import { trackEvent } from '../../utils/analytics'
import { IS_SAVANT_FREE } from '../../utils/constants'
import { getCliEnv } from '../../utils/env'
import { logger } from '../../utils/logger'

import type { AdResponse, DeviceInfo, GravityController } from './types'
import type { ChatMessage } from '../../types/chat'
import type { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/sdk'

// Pure helper: add an ad set to the cache
export function addToChoiceCache(
  ctrl: GravityController,
  ads: AdResponse[],
): void {
  // ZeroClick offer responses must not be stored for later display. Keep them
  // out of the rotation cache and only render them for the live request.
  if (ads.some((ad) => ad.provider === 'zeroclick')) return

  // Deduplicate by checking if any set has the same first impUrl
  const key = ads[0]?.impUrl
  if (key && ctrl.choiceCache.some((set) => set[0]?.impUrl === key)) return
  if (ctrl.choiceCache.length >= AD_CONSTANTS.maxAdCacheSize)
    ctrl.choiceCache.shift()
  ctrl.choiceCache.push(ads)
}

// Pure helper: get the next cached ad set
export function nextFromChoiceCache(
  ctrl: GravityController,
): AdResponse[] | null {
  if (ctrl.choiceCache.length === 0) return null
  const set = ctrl.choiceCache[ctrl.choiceCacheIndex % ctrl.choiceCache.length]!
  ctrl.choiceCacheIndex = (ctrl.choiceCacheIndex + 1) % ctrl.choiceCache.length
  return set
}

/**
 * A streamed LLM answer (possibly still in flight). Other top-level
 * 'ai'-variant messages (bash echoes, system notices, mode dividers) are
 * excluded via the `ai-` id prefix.
 */
export function isAnswerMessage(m: ChatMessage): boolean {
  return (
    !m.parentId && m.variant === 'ai' && m.id.startsWith(AI_MESSAGE_ID_PREFIX)
  )
}

export function isInlineAdEligibleAnswer(m: ChatMessage): boolean {
  return isAnswerMessage(m) && m.metadata?.allowInlineAds === true
}

export function claimAdImpression(
  impressionsFired: Set<string>,
  impUrl: string,
): boolean {
  if (impressionsFired.has(impUrl)) return false
  impressionsFired.add(impUrl)
  return true
}

export function trackInlineAdEvent(
  event: AnalyticsEvent,
  properties: Record<string, JSONValue>,
): void {
  try {
    trackEvent(event, properties)
  } catch (error) {
    // Telemetry must never interfere with fetching or rendering an ad.
    logger.debug({ error, event }, '[ads] Failed to track inline ad event')
  }
}

type AdMessage = { role: 'user' | 'assistant'; content: string }

/**
 * Convert LLM message history to ad API format.
 * Includes only user and assistant messages.
 */
export const convertToAdMessages = (messages: Message[]): AdMessage[] => {
  const adMessages: AdMessage[] = messages
    .filter(
      (message) => message.role === 'assistant' || message.role === 'user',
    )
    .filter(
      (message) =>
        !message.tags || !message.tags.includes('INSTRUCTIONS_PROMPT'),
    )
    .map((message) => ({
      role: message.role,
      content: message.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text.trim())
        .filter((c) => c !== '')
        .join('\n\n')
        .trim(),
    }))
    .filter((message) => message.content !== '')

  return adMessages
}

/** Get device info for ads API */
export function getDeviceInfo(): DeviceInfo {
  // Map Node.js platform to Gravity API os values
  const platformToOs: Record<string, 'macos' | 'windows' | 'linux'> = {
    darwin: 'macos',
    win32: 'windows',
    linux: 'linux',
  }
  const os = platformToOs[process.platform] ?? 'linux'

  // Get IANA timezone (e.g., "America/New_York")
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get locale (e.g., "en-US")
  const locale = Intl.DateTimeFormat().resolvedOptions().locale

  return { os, timezone, locale }
}

/**
 * Useragent string passed to ad providers. Carbon (BuySellAds) requires a
 * plausible browser useragent for targeting and fraud screening. We send a
 * stable desktop Chrome-on-{os} UA per platform so targeting is consistent
 * across users on the same platform without sharing anything identifying.
 *
 * Chrome version needs bumping periodically — stale UAs look bot-ish to ad
 * networks. Last bumped: 2026-04-21. Revisit roughly every 6 months.
 */
const AD_CHROME_VERSION = '124.0.0.0'
export function getAdUserAgent(): string {
  const osUA: Record<string, string> = {
    darwin: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${AD_CHROME_VERSION} Safari/537.36`,
    win32: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${AD_CHROME_VERSION} Safari/537.36`,
    linux: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${AD_CHROME_VERSION} Safari/537.36`,
  }
  return osUA[process.platform] ?? osUA.linux
}

export function getCliAdRequestUserAgent(): string {
  const product = IS_SAVANT_FREE ? 'SavantFree-CLI' : 'SavantCode-CLI'
  const version = getCliEnv().SAVANT_CODE_CLI_VERSION ?? 'dev'
  return `${product}/${version}`
}

// The store selector is used by the ad-network layer; re-exported so the hook
// shim keeps a single source of truth for "has the user messaged yet".
export function useHasUserMessaged(): boolean {
  return useChatStore((s) => s.messages.some((m) => m.variant === 'user'))
}
