/**
 * FID-2026-0806-005 — condensed ECHO protocol summary, critical-context
 * sentinel, and refresh interval for the session-init gate (Layer 1), the
 * 15-turn refresh (Layer 2), and compaction protection (Layer 3).
 *
 * FID-2026-0810-003: the refresh body is GENERATED from ECHO.md facts +
 * framing by scripts/generate-protocol-bundle.ts (see protocol-refresh.generated.ts).
 * The sentinel/cadence/helpers below are code, not protocol content, and stay
 * hand-written.
 */
import { PROTOCOL_REFRESH_CONTENT } from './protocol-refresh.generated'

/** Marker placed in protocol-bearing messages; compaction must never drop them. */
export const ECHO_CRITICAL_SENTINEL = '<!--echo-critical-->'

/**
 * Compatibility export for callers that previously imported the refresh
 * interval. The runtime now measures cadence in completed logical user turns.
 */
export const PROTOCOL_REFRESH_INTERVAL = 5

export function isCriticalContextText(text: string): boolean {
  return text.includes(ECHO_CRITICAL_SENTINEL)
}

/**
 * Condensed protocol summary (~500 tokens) re-injected on the adaptive
 * grounding cadence so the
 * governing laws survive context compaction. The full protocol is always read
 * 0-EOF at session start; this is the refresh, not the source of truth.
 */
export function buildProtocolRefreshSummary(): string {
  return `${ECHO_CRITICAL_SENTINEL}\n${PROTOCOL_REFRESH_CONTENT}`
}
