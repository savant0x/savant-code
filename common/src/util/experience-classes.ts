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
  // The pre-fix constant line (FID-2026-0909-005). The capture stored a
  // *rendering* of the failure, so the cause was never recorded: this bucket is
  // named for what it means. The seven tool-scoped classes behind it are one
  // semantic finding — "the cause was not recorded" — not seven diagnoses, and
  // the name must not read as "we tried and could not classify" (which is what
  // the distinct-identity fallback below is) (FID-2026-1012-024 Step 4).
  [/^tool result contains an error$/, 'cause-not-recorded'],
  [/^Command timed out after\b|^Code search timed out\b/, 'timeout'],
  [/^Tool call aborted:|^Command cancelled:/, 'cancelled'],
  // FID-2026-1012-024: a guard REFUSAL is a validation decision, not an execution
  // outcome. The readonly producer declares one on its own channel (`stderr`
  // starting with the refusal, exitCode 1 — the envelope shape FID-2026-0908-001
  // keeps for command-class tools), and the walker now renders the refusal
  // itself instead of "Command exited with code 1: …".
  //
  // This pattern deliberately does NOT match that older rendering: rows already
  // in the ledger store it, and `inspectLedger` rejects any row whose stored
  // classKey disagrees with its re-derived cause. Taxonomy changes are additive
  // for that reason — a pattern may claim only lines that no stored row carries.
  [/^run_readonly_command rejected:/, 'refused'],
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
  // A message that matches no known cause keeps its OWN identity: over-merging
  // unknown causes is the defect this table exists to avoid, and a hash suffix
  // is what makes the unknown reproducible instead of anonymous.
  return `unrecognised-${createHash('sha256').update(line).digest('hex')}`
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

/**
 * FID-2026-1012-024 Loop 12: an expected outcome is correct behaviour — the
 * harness's own validation decision, such as a guard refusal that steers the
 * agent — never a defect. Its class owes no owner, sits outside the recurrence
 * bar and is rendered as `EXPECTED` instead of as an unowned defect. One
 * authority: the census, its report and the coverage gate all ask here.
 */
export function isExpectedClass(entry: {
  expectedness?: ExperienceExpectedness
}): boolean {
  return entry.expectedness === 'expected'
}

/**
 * Record the issue for a class nobody owns. An expected class is exempt: it is
 * correct behaviour, so there is no repair for an owner to make.
 */
export function pushUnownedClassIssue(
  issues: string[],
  summary: { key: string; expectedness?: ExperienceExpectedness },
): void {
  if (isExpectedClass(summary)) return
  issues.push(`unowned class: ${summary.key}`)
}

/**
 * The canonical rendering of one census class: attribution, horizon state and
 * the descriptive counts, in the order the probe has always printed them.
 */
export function classCensusLine(entry: {
  key: string
  owner?: string
  expectedness?: ExperienceExpectedness
  state: string
  count: number
  timeClusters: number
  largestTimeCluster: number
  clusterGapMs: number
}): string {
  const attribution =
    entry.owner ?? (isExpectedClass(entry) ? 'EXPECTED' : 'UNOWNED')
  return (
    `${attribution} ${entry.state} ${entry.count} rows, ` +
    `${entry.timeClusters} time clusters, largest ` +
    `${entry.largestTimeCluster} rows, gap ${entry.clusterGapMs}ms ${entry.key}`
  )
}

/**
 * FID-2026-1021-001 — the canonical rendering of a COUNTED unit.
 *
 * A recurrence counts a CLASS; a message is one exemplar inside that class.
 * Printing the count beside the message without marking it made one specimen
 * read as the tally: measured 2026-10-20, `head: command not found` (5 real
 * rows) rendered as "69×" because the count was the class total. Every
 * surface that prints a counted unit renders it through this authority, so
 * the counted unit is named the same way everywhere and no surface can
 * silently reintroduce the conflation.
 *
 * `scope` is set when the count spans more than one class (a rule-level
 * aggregate): the span is stated and the top class is named, so the number is
 * never read as one class's tally.
 */
export type CountedUnit = {
  /** The class the count belongs to (or the top class of an aggregate). */
  cause: string
  /** The count itself. */
  count: number
  /** What the count spans, when it is not exactly one class. */
  scope?: string
}

/**
 * The scope label for a RULE-level aggregate: the count spans every class
 * the canonical rule covers, so it is not one class's tally. Shared by the
 * lesson-draft and proposal surfaces so the span is worded identically.
 * FID-2026-1021-001.
 */
export const COUNT_SCOPE_RULE_AGGREGATE = 'across the classes this rule covers'

/**
 * The counted unit's HEAD — the class and the count, never the exemplar.
 *
 * Split from the full form because a column-budgeted surface must be able to
 * truncate the EXEMPLAR (one sample message) without ever truncating the
 * class name: a cause can be a 78-character `unrecognised-<64 hex>`, and a
 * truncated class name is not a reproducible identity.
 */
export function countedUnitHead(unit: CountedUnit): string {
  return unit.scope === undefined
    ? `${unit.cause} ×${unit.count}`
    : `${unit.count}× ${unit.scope} (top class: ${unit.cause})`
}

/** The full counted unit: the head plus the exemplar, explicitly marked. */
export function formatCountedUnit(
  unit: CountedUnit & { exemplar: string },
): string {
  return `${countedUnitHead(unit)}; e.g. ${unit.exemplar}`
}

export interface ExperienceClassSummary extends ExperienceClassIdentity {
  toolName: string
  count: number
  timeClusters: number
  largestTimeCluster: number
  clusterGapMs: number
  sessions: string[]
  firstSeen: string
  lastSeen: string
  legacyKeys: string[]
  state: 'unresolved'
}

/** Descriptive timing only: historical rows have no response or call identity. */
export const EXPERIENCE_CLUSTER_GAP_MS = 60_000

function summarizeTimeClusters(sessions: ReadonlyMap<string, number[]>): {
  timeClusters: number
  largestTimeCluster: number
} {
  let timeClusters = 0
  let largestTimeCluster = 0
  for (const timestamps of sessions.values()) {
    const sorted = timestamps.filter(Number.isFinite).sort((a, b) => a - b)
    const invalid = timestamps.length - sorted.length
    timeClusters += invalid
    if (invalid) largestTimeCluster = Math.max(largestTimeCluster, 1)
    let previous: number | undefined
    let size = 0
    for (const timestamp of sorted) {
      if (
        previous === undefined ||
        timestamp - previous >= EXPERIENCE_CLUSTER_GAP_MS
      ) {
        timeClusters += 1
        size = 0
      }
      size += 1
      largestTimeCluster = Math.max(largestTimeCluster, size)
      previous = timestamp
    }
  }
  return { timeClusters, largestTimeCluster }
}

function appendClusterTime(
  classes: Map<string, Map<string, number[]>>,
  key: string,
  record: ExperienceRecord,
): void {
  const sessions = classes.get(key) ?? new Map<string, number[]>()
  const timestamps = sessions.get(record.sessionId) ?? []
  timestamps.push(Date.parse(record.ts))
  sessions.set(record.sessionId, timestamps)
  classes.set(key, sessions)
}

/** All rows remain visible, including old and undetermined classes. */
export function summarizeExperienceClasses(
  records: readonly ExperienceRecord[],
): ExperienceClassSummary[] {
  const groups = new Map<string, ExperienceClassSummary>()
  const clusterTimes = new Map<string, Map<string, number[]>>()
  for (const record of records) {
    const identity = experienceClassIdentity(record)
    appendClusterTime(clusterTimes, identity.key, record)
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
        timeClusters: 0,
        largestTimeCluster: 0,
        clusterGapMs: EXPERIENCE_CLUSTER_GAP_MS,
        sessions: [record.sessionId],
        firstSeen: record.ts,
        lastSeen: record.ts,
        legacyKeys: [legacyKey],
        state: 'unresolved',
      })
    }
  }
  return [...groups.values()]
    .map((summary) => ({
      ...summary,
      ...summarizeTimeClusters(clusterTimes.get(summary.key) ?? new Map()),
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}
