import { shouldTrackAnalyticsEvent } from '@savant-code/common/util/analytics-sampling'

import { clearClientLogs } from '../log-shipper'
import { mirrorAnalyticsEventToAxiom } from './axiom-mirror'
import { resolveDeps, type AnalyticsDeps } from './contracts'
import {
  AnalyticsErrorStage,
  logAnalyticsError,
  type AnalyticsErrorContext,
} from './errors'
import { emitIdentifyUser, emitTrackEvent } from './event-emitters'

// Public contract re-export — the analytics surface (cli/src/utils/
// analytics.ts and test fixtures) has always exposed AnalyticsDeps from
// this module.
export type { AnalyticsDeps } from './contracts'

import type { AnalyticsClientWithIdentify } from '@savant-code/common/analytics-core'
import type { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Analytics module state + internal helpers.
 * (FID-2026-0809-016: extracted from `cli/src/utils/analytics.ts`.)
 * (FID-2026-0819-005 Loop 148: contracts → ./contracts, debug logger →
 * ./debug-log, Axiom mirror → ./axiom-mirror, error plumbing → ./errors.
 * All public API is re-exported from here so the module surface is
 * unchanged.)
 */

export { setAnalyticsErrorLogger } from './errors'
export type { AnalyticsErrorLogger } from './errors'

// Anonymous ID used before user identification (for PostHog alias)
let anonymousId: string | undefined
// Real user ID after identification
let currentUserId: string | undefined
let client: AnalyticsClientWithIdentify | undefined
let analyticsEnabled = true

// Store injected dependencies (for testing)
let injectedDeps: AnalyticsDeps | undefined

export let identified: boolean = false
let consentChangeListener: ((enabled: boolean) => void) | undefined

/** Get current distinct ID (real user ID if identified, otherwise anonymous ID) */
function getDistinctId(): string | undefined {
  return currentUserId ?? anonymousId
}

/** Bridge the module's mutable session state into the emitter context. */
function emitterContext() {
  if (!client) {
    throw new Error('Analytics client not initialized')
  }
  return {
    client,
    isProd: resolveDeps(injectedDeps).isProd,
    mirrorAnalyticsEventToAxiom,
  }
}

/** Reset analytics state - for testing only */
export function resetAnalyticsState(deps?: AnalyticsDeps) {
  anonymousId = undefined
  currentUserId = undefined
  client = undefined
  analyticsEnabled = true
  clearClientLogs()
  injectedDeps = deps
  identified = false
}

/** Disable remote analytics and clear any buffered remote events. */
export function disableAnalytics(): void {
  // Close the synchronous consent boundary before touching the SDK. This
  // prevents any caller from capturing while asynchronous client teardown is
  // in progress.
  analyticsEnabled = false
  const previousClient = client
  client = undefined
  anonymousId = undefined
  currentUserId = undefined
  identified = false
  clearClientLogs()
  consentChangeListener?.(false)

  // PostHog's disable() does not flush its queue. It is intentionally
  // best-effort because consent has already been withdrawn locally.
  if (previousClient?.disable) {
    void Promise.resolve()
      .then(() => previousClient.disable?.())
      .catch(() => {
        // Never make disabling telemetry fail the CLI.
      })
  }
}

function updateAnalyticsEnabled(enabled: boolean): void {
  analyticsEnabled = enabled
  consentChangeListener?.(enabled)
}

/** Return whether remote analytics and error reporting are enabled. */
export function isAnalyticsEnabled(): boolean {
  return analyticsEnabled
}

export function registerAnalyticsConsentListener(
  listener: (enabled: boolean) => void,
): void {
  consentChangeListener = listener
}

export function initAnalytics(enabled = true) {
  if (!enabled) {
    disableAnalytics()
    return
  }

  // Repeated startup/enable calls must not orphan a live client. A disabled
  // client is cleared synchronously by disableAnalytics before re-enable.
  if (analyticsEnabled && client) {
    return
  }

  const { env, isProd, createClient, generateAnonymousId } =
    resolveDeps(injectedDeps)

  if (!env.NEXT_PUBLIC_POSTHOG_API_KEY || !env.NEXT_PUBLIC_POSTHOG_HOST_URL) {
    const error = new Error(
      'NEXT_PUBLIC_POSTHOG_API_KEY or NEXT_PUBLIC_POSTHOG_HOST_URL is not set',
    )
    anonymousId = undefined
    currentUserId = undefined
    client = undefined
    identified = false
    disableAnalytics()
    logAnalyticsError(error, {
      stage: AnalyticsErrorStage.Init,
      missingEnv: true,
    } as AnalyticsErrorContext)
    throw error
  }

  try {
    const nextAnonymousId = generateAnonymousId()
    const nextClient = createClient(env.NEXT_PUBLIC_POSTHOG_API_KEY, {
      host: env.NEXT_PUBLIC_POSTHOG_HOST_URL,
      enableExceptionAutocapture: isProd,
    })

    // Commit the new remote-analytics session only after client construction
    // succeeds. A failed enable must never leave the global gate half-open.
    anonymousId = nextAnonymousId
    currentUserId = undefined
    client = nextClient
    identified = false
    updateAnalyticsEnabled(true)
  } catch (error) {
    disableAnalytics()
    logAnalyticsError(error, { stage: AnalyticsErrorStage.Init })
    throw error
  }
}

export async function flushAnalytics() {
  if (!analyticsEnabled || !client) {
    return
  }
  try {
    await client.flush()
  } catch (error) {
    // Silently handle PostHog network errors - don't log to console or logger
    // This prevents PostHog errors from cluttering the user's console
    logAnalyticsError(error, { stage: AnalyticsErrorStage.Flush })
  }
}

export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, JSONValue>,
) {
  if (!analyticsEnabled) {
    return
  }

  const { isProd } = resolveDeps(injectedDeps)
  const distinctId = getDistinctId()

  if (!client) {
    if (isProd) {
      const error = new Error('Analytics client not initialized')
      logAnalyticsError(error, {
        stage: AnalyticsErrorStage.Track,
        event,
        properties: properties ?? null,
      } as AnalyticsErrorContext)
      throw error
    }
    return
  }

  if (!distinctId) {
    // This shouldn't happen if initAnalytics was called, but handle gracefully
    return
  }

  if (!shouldTrackAnalyticsEvent({ event, distinctId, properties })) {
    return
  }

  // Capture + Axiom mirroring extracted to ./event-emitters
  // (FID-2026-0819-005 Loop 166).
  emitTrackEvent(emitterContext(), {
    event,
    distinctId,
    properties,
    anonymousId,
    currentUserId,
  })
}

export function identifyUser(
  userId: string,
  properties?: Record<string, JSONValue>,
) {
  if (!analyticsEnabled) {
    return
  }

  if (!client) {
    const error = new Error('Analytics client not initialized')
    logAnalyticsError(error, {
      stage: AnalyticsErrorStage.Identify,
      properties: properties ?? null,
    } as AnalyticsErrorContext)
    throw error
  }

  const previousAnonymousId = anonymousId

  // Store the real user ID for future events
  currentUserId = userId
  identified = true

  // Alias + identify extracted to ./event-emitters
  // (FID-2026-0819-005 Loop 166).
  emitIdentifyUser(emitterContext(), {
    userId,
    previousAnonymousId,
    properties,
  })
}

export function logError(
  error: Error,
  userId?: string,
  properties?: Record<string, JSONValue>,
) {
  if (!analyticsEnabled || !client) {
    return
  }

  try {
    client.captureException(
      error,
      userId ?? currentUserId ?? 'unknown',
      properties,
    )
  } catch (postHogError) {
    // Silently handle PostHog errors - don't log them to console
    // This prevents PostHog connection issues from cluttering the user's console
    logAnalyticsError(postHogError, {
      stage: AnalyticsErrorStage.CaptureException,
      properties: properties ?? null,
    } as AnalyticsErrorContext)
  }
}
