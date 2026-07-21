/* eslint-disable savant/no-unknown-in-signatures -- analytics logger trust boundary: log payloads arrive schema-less from the CLI/agent runtime; `data: unknown` is the only honest shape. 3-condition AND-gate: (i.1) caller type cannot be discovered without coupling to every logger call site; (i.2) narrowing to `JsonValue`/concrete breaks callers that pass LLM response objects and Error instances; (i.3) runtime narrowing via `isAnalyticsLogData` + `analyticsEvents.has()` preserves existing event filtering behavior. */
import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'

// Build PostHog payloads from log data in a single, shared place
export type AnalyticsLogData = {
  eventId?: unknown
  userId?: unknown
  user_id?: unknown
  user?: { id?: unknown }
  [key: string]: unknown
}

export type TrackableAnalyticsPayload = {
  event: AnalyticsEvent
  userId: string
  properties: Record<string, unknown>
}

const analyticsEvents = new Set<AnalyticsEvent>(Object.values(AnalyticsEvent))

function isAnalyticsLogData(v: unknown): v is AnalyticsLogData {
  return typeof v === 'object' && v !== null
}

const toStringOrNull = (value: unknown): string | null =>
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
    },
  }
}
