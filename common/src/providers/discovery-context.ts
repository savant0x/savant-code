/**
 * FID-2026-0914-003 — the agent-context block (MQ5, Layer 2).
 *
 * Sanitized by construction: ONLY host names, model counts, probe verdicts,
 * dates, and the stable report path pass into model context. Feed prose
 * (freeQuota text etc.) is untrusted third-party content and is structurally
 * excluded — the type below has no field for it. Size-capped with a hard
 * ceiling; once-per-candidate-set TTL via a content hash the caller persists.
 *
 * Lives in `common` (not the scripts tree) because the CLI's session
 * bootstrap (`use-chat-bootstrap`) is the production consumer; the harvester
 * script reuses the same builder so the announced surface cannot drift from
 * the surfaced one (Law 13: one truth).
 */
export type ContextCandidate = {
  host: string
  category: string | null
  modelsCount: number | null
  boundary: string
  typosquat: string
  classification: 'new' | 'changed' | 'unchanged' | 'lapsed'
  /** Home-keyed custom provider when a degraded candidate was tracked. */
  removalHintId?: string
}

/**
 * W4 (FID-2026-0915-001) — the better-default nudge input: one candidate
 * shaped for the threshold check (sanitized by construction — host, latency,
 * boundary, model count only).
 */
export type NudgeCandidate = {
  host: string
  boundary: string
  latencyMs: number | null
  modelsCount: number
}

/**
 * W4 (FID-2026-0915-001, MQ2 ruling): when a HEALTH-TRACKED pipeline
 * provider degraded this run AND a boundary-ok candidate exists with
 * latency strictly below HALF the degraded provider's, return ONE capped
 * suggest-line. Never switches anything — the human gate is the product.
 * Null whenever any input is missing or no candidate clears the bar
 * (never nudges on incomplete data or marginal improvements).
 */
export function nudgeLine(input: {
  degradedProvider: {
    host: string
    latencyMs: number | null
    verdict: string
  } | null
  candidates: NudgeCandidate[]
}): string | null {
  const degraded = input.degradedProvider
  if (!degraded || degraded.latencyMs === null) return null
  if (degraded.verdict === 'healthy') return null
  const half = degraded.latencyMs / 2
  const better = input.candidates.find(
    (c) =>
      c.boundary === 'boundary-ok' &&
      c.latencyMs !== null &&
      c.latencyMs < half &&
      c.modelsCount >= 1,
  )
  if (!better) return null
  return `suggestion available: ${better.host} — see report`
}

const MAX_BLOCK_CHARS = 1400
const MAX_LISTED_HOSTS = 12

/** Content hash of the announce-worthy set (persisted by the caller). */
export function candidateSetKey(
  candidates: Array<Pick<ContextCandidate, 'host' | 'classification'>>,
): string {
  const announceWorthy = candidates
    .filter((c) => c.classification !== 'unchanged')
    .map((c) => `${c.host}:${c.classification}`)
    .sort()
  return JSON.stringify(announceWorthy)
}

export function summarizeForContext(input: {
  fetchedAtUtc: string
  candidates: ContextCandidate[]
  reportPath: string
  /** The persisted candidateSetKey from the last announced run (null = never). */
  lastAnnouncedSet: string | null
}): string {
  if (input.lastAnnouncedSet !== null) {
    const current = candidateSetKey(input.candidates)
    if (current === input.lastAnnouncedSet) return ''
  }
  return buildDiscoveryContextBlock({
    fetchedAtUtc: input.fetchedAtUtc,
    candidates: input.candidates,
    reportPath: input.reportPath,
  })
}

export function buildDiscoveryContextBlock(input: {
  fetchedAtUtc: string
  candidates: ContextCandidate[]
  reportPath: string
  /** W4 — the capped better-default suggest-line (null/absent = none). */
  suggestion?: string | null
}): string {
  const announceWorthy = input.candidates.filter(
    (c) => c.classification !== 'unchanged',
  )
  if (announceWorthy.length === 0 && !input.suggestion) return ''

  const lines: string[] = []
  lines.push(
    `[provider-discovery] ${announceWorthy.length} new/changed free-provider candidate(s) from the ${input.fetchedAtUtc} harvest:`,
  )
  const listed = announceWorthy.slice(0, MAX_LISTED_HOSTS)
  for (const c of listed) {
    const models =
      typeof c.modelsCount === 'number'
        ? `${c.modelsCount} models`
        : 'models unverified'
    lines.push(
      `- ${c.host} (${c.category ?? 'uncategorized'}, ${models}, auth-boundary: ${c.boundary}) — ${c.classification}`,
    )
  }
  if (announceWorthy.length > listed.length) {
    lines.push(
      `- (and ${announceWorthy.length - listed.length} more — see the report)`,
    )
  }
  const degraded = announceWorthy.filter((c) => c.removalHintId !== undefined)
  if (degraded.length > 0) {
    for (const c of degraded) {
      lines.push(
        `- ${c.host} failed this run's health check — if the user wants it gone: /provider remove ${c.removalHintId}`,
      )
    }
  }
  // W4 — the ONE capped suggest-line. Suggests only; never switches.
  if (input.suggestion) lines.push(`- ${input.suggestion}`)
  lines.push(
    `Full data-backed report: ${input.reportPath}. Offer to add a candidate via the provider wizard only if the user asks; the user confirms every step. Never add providers unprompted.`,
  )

  let block = lines.join('\n')
  if (block.length > MAX_BLOCK_CHARS) {
    block = `${block.slice(0, MAX_BLOCK_CHARS - 20)}\n…(truncated — see the report)`
  }
  return block
}
