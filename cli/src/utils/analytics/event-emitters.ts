// FID-2026-0819-005 Loop 166: the capture/identify emitters, extracted from
// analytics/state.ts. They operate on a small injected context (the module's
// mutable session state plus the client) so the behavior is verbatim while
// the parent stays under the size ceiling.
import { DEBUG_ANALYTICS } from '@savant-code/common/env'

import { logAnalyticsDebug } from './debug-log'
import {
  AnalyticsErrorStage,
  logAnalyticsError,
  type AnalyticsErrorContext,
} from './errors'

import type { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import type { JSONValue } from '@savant-code/common/types/json'

export interface EmitterContext {
  client: {
    capture: (input: {
      distinctId: string
      event: AnalyticsEvent
      properties?: Record<string, JSONValue>
    }) => void
    alias: (input: { distinctId: string; alias: string }) => void
    identify: (input: {
      distinctId: string
      properties?: Record<string, JSONValue>
    }) => void
  }
  isProd: boolean
  mirrorAnalyticsEventToAxiom: (input: {
    event: AnalyticsEvent
    anonymousId: string | undefined
    currentUserId: string | undefined
    properties: Record<string, JSONValue> | undefined
  }) => void
}

export function emitTrackEvent(
  ctx: EmitterContext,
  input: {
    event: AnalyticsEvent
    distinctId: string
    properties?: Record<string, JSONValue>
    anonymousId: string | undefined
    currentUserId: string | undefined
  },
): void {
  const { event, distinctId, properties, anonymousId, currentUserId } = input

  if (!ctx.isProd) {
    if (DEBUG_ANALYTICS) {
      logAnalyticsDebug(`[analytics] ${event}`, {
        event,
        properties: properties ?? null,
        distinctId,
      })
    }
    return
  }

  try {
    ctx.client.capture({
      distinctId,
      event,
      properties,
    })
  } catch (error) {
    logAnalyticsError(error, {
      stage: AnalyticsErrorStage.Track,
      event,
      properties: properties ?? null,
    } as AnalyticsErrorContext)
  }

  // Mirror analytics events into the Axiom logs sink (extracted to
  // ./axiom-mirror, FID-2026-0819-005 Loop 148; rationale comment there).
  ctx.mirrorAnalyticsEventToAxiom({
    event,
    anonymousId,
    currentUserId,
    properties,
  })
}

export function emitIdentifyUser(
  ctx: EmitterContext,
  input: {
    userId: string
    previousAnonymousId: string | undefined
    properties?: Record<string, JSONValue>
  },
): void {
  const { userId, previousAnonymousId, properties } = input

  if (!ctx.isProd) {
    if (DEBUG_ANALYTICS) {
      logAnalyticsDebug('[analytics] user identified', {
        userId,
        previousAnonymousId: previousAnonymousId ?? null,
        properties: properties ?? null,
      })
    }
    return
  }

  try {
    // If we had an anonymous ID, alias it FIRST to the real user ID
    // This must be called BEFORE identify to properly merge the event histories
    // See: https://posthog.com/docs/libraries/node
    if (previousAnonymousId) {
      ctx.client.alias({
        distinctId: userId,
        alias: previousAnonymousId,
      })
    }

    // Then identify the user with their properties
    ctx.client.identify({
      distinctId: userId,
      properties,
    })
  } catch (error) {
    logAnalyticsError(error, {
      stage: AnalyticsErrorStage.Identify,
      properties: properties ?? null,
    } as AnalyticsErrorContext)
  }
}
