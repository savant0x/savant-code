import type { Logger } from './logger'
import type { AnalyticsEvent } from '../../constants/analytics-events'
import type { JSONValue } from '../../types/json'

export type AnalyticsProperties = Record<string, JSONValue>

export type TrackEventFn = (params: {
  event: AnalyticsEvent
  userId: string
  properties?: AnalyticsProperties
  logger: Logger
}) => void
