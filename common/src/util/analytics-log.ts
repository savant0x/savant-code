import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'

import type { AnalyticsProperties } from '../types/contracts/analytics'
import type { JSONValue } from '../types/json'

// Build PostHog payloads from log data in a single, shared place
export type AnalyticsLogData = {
  eventId?: JSONValue
  userId?: JSONValue
  user_id?: JSONValue
  user?: { id?: JSONValue }
  [key: string]: JSONValue | undefined
}

export type TrackableAnalyticsPayload = {
  event: AnalyticsEvent
  userId: string
  properties: AnalyticsProperties
}

const analyticsEvents = new Set<AnalyticsEvent>(Object.values(AnalyticsEvent))

function isAnalyticsLogData(v: unknown): v is AnalyticsLogData {
  return typeof v === 'object' && v !== null
}

const toStringOrNull = (value: JSONValue | undefined): string | null =>
  typeof value === 'string' ? value : null

const getUserId = (
  record: AnalyticsLogData,
  fallbackUserId?: string,
): string | null =>
  toStringOrNull(record.userId) ??
  toStringOrNull(record.user_id) ??
  toStringOrNull(record.user?.id) ??
  toStringOrNull(fallbackUserId)

export function getAnalyticsEventId(data: unknown): AnalyticsEvent | null {
  if (!isAnalyticsLogData(data)) {
    return null
  }
  const eventId = data.eventId
  return analyticsEvents.has(eventId as AnalyticsEvent)
    ? (eventId as AnalyticsEvent)
    : null
}

export function toTrackableAnalyticsPayload({
  data,
  level,
  msg,
  fallbackUserId,
}: {
  data: unknown
  level: string
  msg: string
  fallbackUserId?: string
}): TrackableAnalyticsPayload | null {
  if (!isAnalyticsLogData(data)) {
    return null
  }

  const eventId = getAnalyticsEventId(data)
  if (!eventId) {
    return null
  }

  const userId = getUserId(data, fallbackUserId)

  if (!userId) {
    return null
  }

  return {
    event: eventId,
    userId,
    properties: {
      ...data,
      level,
      msg,
    } as AnalyticsProperties,
  }
}
