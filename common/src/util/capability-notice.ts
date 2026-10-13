/**
 * Capability degradation contract (FID-2026-1012-019).
 *
 * A capability that is absent, broken or cut off must never be reported to the
 * agent as a capability that ran and found nothing. This module is the one
 * shape every producer uses for that report, so three rules hold everywhere
 * instead of being re-derived per tool:
 *
 * 1. the notice names the capability and *that it did not run* — the two are
 *    distinguishable from a completed empty result by the first clause alone;
 * 2. it carries the measured reason (what actually happened, not a guess) and
 *    the one action that resolves it;
 * 3. it states what the caller must NOT conclude from it.
 *
 * The rendering is deliberately a single line: tool results are single
 * strings, and the first line is what the failure ledger records as the class
 * identity (`common/src/util/experience-classes.ts`), so keeping the shape
 * stable keeps the class measurable.
 *
 * This module holds no state and touches no I/O — the per-run dedupe lives in
 * `createCapabilityNoticeLog`, which a caller owns and scopes.
 */

export type CapabilityState =
  /** Nothing could run: the capability is not configured or not installed. */
  | 'unavailable'
  /** Something ran but did not finish, so its output is not a complete answer. */
  | 'incomplete'

export interface CapabilityNotice {
  /** The tool name in the agent's terms, e.g. `web_search`, `code_search`. */
  capability: string
  /** How the capability is named in the first clause, e.g. `Web search`. */
  label: string
  state: CapabilityState
  /**
   * What did not happen, with the measured cause. Facts only — a provider that
   * returned nothing must say so; a missing key must say it is missing.
   */
  reason: string
  /** The single action that resolves the notice. */
  action: string
  /** What this result is not evidence of. Omitted when it adds nothing. */
  consequence?: string
}

/** The stable first clause per state — the part class patterns key on. */
export function capabilityNoticeLead(
  notice: Pick<CapabilityNotice, 'label' | 'state'>,
): string {
  return notice.state === 'unavailable'
    ? `${notice.label} is unavailable`
    : `${notice.label} did not complete`
}

/** Render a notice to the single-line string a tool result carries. */
export function renderCapabilityNotice(notice: CapabilityNotice): string {
  const parts = [
    `${capabilityNoticeLead(notice)}: ${notice.reason}`,
    notice.action,
  ]
  if (notice.consequence) parts.push(notice.consequence)
  return parts.join(' ')
}

export interface CapabilityNoticeLog {
  /**
   * Claim the notice for a scope. Returns true the first time this
   * capability+reason is claimed, false afterwards — the caller still reports
   * every failure, and uses this only to drop the repeated advice.
   */
  claim(notice: Pick<CapabilityNotice, 'capability' | 'reason'>): boolean
  /** Keys currently held. */
  size(): number
  clear(): void
}

/**
 * A bounded once-per-scope claim log. It stores nothing but the claim keys and
 * clears wholesale on overflow, so a long-lived process cannot grow it: the
 * cost of an overflow is one repeated advice line, never an unbounded map.
 */
export function createCapabilityNoticeLog(maxKeys = 64): CapabilityNoticeLog {
  const claimed = new Set<string>()
  return {
    claim({ capability, reason }) {
      const key = `${capability}\u0000${reason}`
      if (claimed.has(key)) return false
      if (claimed.size >= maxKeys) claimed.clear()
      claimed.add(key)
      return true
    },
    size: () => claimed.size,
    clear: () => claimed.clear(),
  }
}
