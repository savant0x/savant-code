import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { shouldMirrorAnalyticsEvent } from '@savant-code/common/util/log-mirror'

import { enqueueClientLog } from '../log-shipper'

import type { JSONValue } from '@savant-code/common/types/json'

// FID-2026-0819-005 Loop 148: Axiom mirror for analytics events, extracted
// from analytics/state.ts.

/**
 * Mirror analytics events into the Axiom logs sink too (PostHog stays the
 * product-analytics source of truth). The shipper batches and ships even
 * before login (anonymously), so pre-auth events like app_launched reach
 * Axiom — making install→login funnels queryable in APL. We correlate on the
 * anonymous/run id so pre- and post-login events join. CLI_LOG is excluded
 * because the logger already mirrors log rows to Axiom (avoids double-ship).
 */
export function mirrorAnalyticsEventToAxiom(params: {
  event: AnalyticsEvent
  anonymousId: string | undefined
  currentUserId: string | undefined
  properties: Record<string, JSONValue> | undefined
}): void {
  const { event, anonymousId, currentUserId, properties } = params
  if (event === AnalyticsEvent.CLI_LOG || !shouldMirrorAnalyticsEvent(event)) {
    return
  }
  try {
    enqueueClientLog({
      level: 'info',
      event,
      message: event,
      client_session_id: anonymousId ?? currentUserId,
      data: properties,
    })
  } catch {
    // Best-effort mirror; never let it affect analytics or the app.
  }
}
