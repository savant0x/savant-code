import { createHash } from 'node:crypto'

import { normalizeErrorFirstLine } from './experiences'

import type {
  ExperienceErrorClass,
  ExperienceExpectedness,
  ExperienceRecord,
} from '../types/experience'

export interface ExperienceClassIdentity {
  key: string
  cause: string
  expectedness: ExperienceExpectedness
}

/** Templates are causes; quoted payloads, counts and timeout budgets are instances. */
const CAUSE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^Incomplete arguments for tool\b/, 'incomplete-arguments'],
  [/^Tool .* is not available to this agent:/, 'tool-unavailable'],
  [/^tool result contains an error$/, 'unclassified'],
  [/^Command timed out after\b|^Code search timed out\b/, 'timeout'],
  [/^Tool call aborted:/, 'cancelled'],
  [/^Command exited with code\b/, 'command-exit'],
  [/^File read did not complete:/, 'read-incomplete'],
  [/^The old string .* was not found/, 'edit-target-missing'],
  [/^No change to the file$/, 'edit-noop'],
  [/^Found \d+ occurrences of/, 'edit-target-ambiguous'],
  [/^Attempted to assign to readonly property\./, 'immutable-result'],
  [/^Failed to apply patch/, 'patch-failed'],
  [/^Failed to execute ripgrep.*ENOENT/, 'search-executable-missing'],
  [/^Code search anomaly:/, 'search-incomplete'],
  // FID-2026-1012-019 renamed the exhaustion message from an empty-result
  // claim to a named degradation. New rows key on the new lead; the legacy
  // pattern stays so the rows already in the capture keep their identity
  // instead of splitting into a second class.
  [/^No web search results were returned\. Add/, 'research-unavailable'],
  [/^Web search (?:is unavailable|did not complete)/, 'research-unavailable'],
  [/^No readable text found at URL$/, 'fetch-unextractable'],
  [/^Response (?:exceeded|is too large)/, 'fetch-oversized'],
  [/^Unsupported content type:/, 'fetch-unsupported'],
  [/^Host .* resolves to a private or reserved address/, 'fetch-blocked'],
  [/^Could not resolve host/, 'fetch-dns'],
  [/^Failed to list directory:.*ENOENT/, 'directory-missing'],
]

function failureCause(line: string, errorClass?: ExperienceErrorClass): string {
  if (errorClass === 'native-incomplete') return 'incomplete-arguments'
  if (errorClass === 'tool-unavailable') return 'tool-unavailable'
  const status = line.match(/^Failed to fetch URL: (\d{3})\b|^HTTP (\d{3})\b/)
  if (status) return `http-${status[1] ?? status[2]}`
  const known = CAUSE_PATTERNS.find(([pattern]) => pattern.test(line))
  if (known) return known[1]
  // Unknown messages retain distinct identities rather than merging unknown causes.
  return `unclassified-${createHash('sha256').update(line).digest('hex')}`
}

/** Derive old rows without rewriting them; never infer repair or dormancy. */
export function experienceClassIdentity(
  record: Pick<
    ExperienceRecord,
    'toolName' | 'errorFirstLine' | 'errorClass' | 'expectedness'
  >,
): ExperienceClassIdentity {
  const line = normalizeErrorFirstLine(record.errorFirstLine)
  const cause = failureCause(line, record.errorClass)
  const expectedness =
    record.expectedness ??
    (cause === 'incomplete-arguments' || cause === 'tool-unavailable'
      ? 'unexpected'
      : 'undetermined')
  return {
    key: `v1:${encodeURIComponent(record.toolName)}:${cause}:${expectedness}`,
    cause,
    expectedness,
  }
}

export interface ExperienceClassSummary extends ExperienceClassIdentity {
  toolName: string
  count: number
  sessions: string[]
  firstSeen: string
  lastSeen: string
  legacyKeys: string[]
  state: 'unresolved'
}

/** All rows remain visible, including old and undetermined classes. */
export function summarizeExperienceClasses(
  records: readonly ExperienceRecord[],
): ExperienceClassSummary[] {
  const groups = new Map<string, ExperienceClassSummary>()
  for (const record of records) {
    const identity = experienceClassIdentity(record)
    const legacyKey = `${record.toolName}|${record.errorFirstLine.slice(0, 70)}`
    const existing = groups.get(identity.key)
    if (existing) {
      existing.count += 1
      if (!existing.sessions.includes(record.sessionId))
        existing.sessions.push(record.sessionId)
      if (!existing.legacyKeys.includes(legacyKey))
        existing.legacyKeys.push(legacyKey)
      if (Date.parse(record.ts) < Date.parse(existing.firstSeen))
        existing.firstSeen = record.ts
      if (Date.parse(record.ts) > Date.parse(existing.lastSeen))
        existing.lastSeen = record.ts
    } else {
      groups.set(identity.key, {
        ...identity,
        toolName: record.toolName,
        count: 1,
        sessions: [record.sessionId],
        firstSeen: record.ts,
        lastSeen: record.ts,
        legacyKeys: [legacyKey],
        state: 'unresolved',
      })
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key),
  )
}
