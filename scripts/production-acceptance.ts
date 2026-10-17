/**
 * FID-2026-1016-016 (LF-005) — production acceptance recorded separately from
 * agent tool success.
 *
 * The agent's own report confirms that tool calls returned; it cannot see
 * terminal rendering, focus, resize, folding, clipboard or resumed history.
 * `cli/src/components/__tests__/transcript-recovery.render.test.tsx` proves the
 * DELIBERATE-error path, which is a different claim from "this run rendered
 * correctly for a person".
 *
 * So acceptance is a run-bound record: `dev/tracking/acceptance/<runId>.json`
 * carries the exact run identifier, the session that binds the call ledger
 * (`dev/experiences/raw-traces.jsonl` — the same file that holds failures and
 * fallback steps), and ONE outcome per UI surface. The three evidence kinds are
 * separate fields and never merged:
 *
 * - `modelObservations` — what the tool calls reported (NOT acceptance);
 * - `operatorUiChecks` — native observations made by a person (acceptance);
 * - `automatedRegression` — test files that must exist (regression only).
 *
 * The rules that make the separation real: a surface claiming `observed` or
 * `regressed` must carry its observation and resolvable evidence, a surface
 * marked `unverified` may carry no acceptance claim at all, and a record with
 * any acceptance claim must have at least one operator check — otherwise the
 * run's tool success would be standing in for human observation.
 */

import fs from 'node:fs'
import path from 'node:path'

import { z } from 'zod/v4'

export const ACCEPTANCE_DIR = 'dev/tracking/acceptance'
/** The UI surfaces LF-005 requires to be recorded as SEPARATE outcomes. */
export const UI_SURFACES = [
  'resize',
  'input-responsiveness',
  'folding',
  'copy-export',
  'resumed-history',
] as const

const text = z.string().trim().min(1)

export const acceptanceRecordSchema = z.strictObject({
  version: z.literal(1),
  runId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/),
  recordedAt: text,
  /** The session whose call ledger entries this record binds. */
  sessionId: text,
  /** Repo-relative call ledger (the same file carrying failures/fallbacks). */
  callLedger: text,
  surfaces: z
    .array(
      z.strictObject({
        surface: z.enum(UI_SURFACES),
        outcome: z.enum(['observed', 'unverified', 'regressed']),
        /** Required for observed/regressed; refused for unverified. */
        observation: text.optional(),
        /** A repo-relative path, or `run:<runId>` for an in-run observation. */
        evidence: text.optional(),
      }),
    )
    .min(1),
  modelObservations: z.array(text),
  operatorUiChecks: z.array(text),
  automatedRegression: z.array(text),
  fallbackSteps: z.array(text),
})

export type AcceptanceRecord = z.infer<typeof acceptanceRecordSchema>

/** Resolve a repo-relative evidence path, refusing traversal/absolute paths. */
function insideRepo(root: string, relative: string): boolean {
  if (path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) return false
  const resolved = path.resolve(root, relative)
  const within = path.relative(root, resolved)
  return (
    within !== '' &&
    within !== '..' &&
    !within.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(within) &&
    fs.existsSync(resolved)
  )
}

function fileContains(root: string, relative: string, needle: string): boolean {
  try {
    return fs
      .readFileSync(path.resolve(root, relative), 'utf8')
      .includes(needle)
  } catch {
    return false
  }
}

/** Test-file paths inside one automated-regression entry. */
function testPaths(entry: string): string[] {
  return [...entry.matchAll(/[A-Za-z0-9._/-]+\.test\.tsx?/g)].map(
    (match) => match[0],
  )
}

/**
 * Validate one record against the tree it claims. Pure: it reads files, never
 * writes, and never upgrades an unverified surface.
 */
export function validateAcceptanceRecord(
  root: string,
  fileName: string,
  value: unknown,
): string[] {
  const parsed = acceptanceRecordSchema.safeParse(value)
  if (!parsed.success)
    return [
      `${fileName}: record is invalid — ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')}`,
    ]
  const record = parsed.data
  const issues: string[] = []
  const expectedRunId = fileName.replace(/\.json$/, '')
  if (record.runId !== expectedRunId)
    issues.push(
      `${fileName}: runId '${record.runId}' does not match the record file name`,
    )

  // One outcome per surface: an aggregate "it works" claim cannot stand in for
  // the surfaces that were never looked at.
  const seen = new Map<string, number>()
  for (const surface of record.surfaces)
    seen.set(surface.surface, (seen.get(surface.surface) ?? 0) + 1)
  for (const surface of UI_SURFACES) {
    const count = seen.get(surface) ?? 0
    if (count !== 1)
      issues.push(
        `${record.runId}: surface '${surface}' has ${count} outcomes; each surface needs exactly one`,
      )
  }

  // The call ledger binds the run to its failures and fallback steps.
  if (!insideRepo(root, record.callLedger))
    issues.push(
      `${record.runId}: call ledger '${record.callLedger}' does not resolve inside the repository`,
    )
  else if (!fileContains(root, record.callLedger, record.sessionId))
    issues.push(
      `${record.runId}: session '${record.sessionId}' does not appear in ${record.callLedger}`,
    )

  const claimed = record.surfaces.filter(
    (surface) => surface.outcome !== 'unverified',
  )
  for (const surface of claimed) {
    if (surface.observation === undefined)
      issues.push(
        `${record.runId}: '${surface.surface}' claims ${surface.outcome} with no observation`,
      )
    if (surface.evidence === undefined)
      issues.push(
        `${record.runId}: '${surface.surface}' claims ${surface.outcome} with no evidence`,
      )
    else if (
      surface.evidence !== `run:${record.runId}` &&
      !insideRepo(root, surface.evidence)
    )
      issues.push(
        `${record.runId}: '${surface.surface}' evidence '${surface.evidence}' does not resolve inside the repository`,
      )
  }
  for (const surface of record.surfaces.filter(
    (entry) => entry.outcome === 'unverified',
  ))
    if (surface.observation !== undefined || surface.evidence !== undefined)
      issues.push(
        `${record.runId}: '${surface.surface}' is unverified but carries an acceptance claim`,
      )

  // Tool success is not acceptance: an observed surface needs a native check.
  if (claimed.length > 0 && record.operatorUiChecks.length === 0)
    issues.push(
      `${record.runId}: ${claimed.length} surface(s) claim acceptance with no operator/native check — model observations are not acceptance`,
    )

  for (const entry of record.automatedRegression) {
    const paths = testPaths(entry)
    if (paths.length === 0) {
      issues.push(
        `${record.runId}: automated regression '${entry}' names no test file`,
      )
      continue
    }
    for (const testPath of paths)
      if (!insideRepo(root, testPath))
        issues.push(
          `${record.runId}: automated regression test '${testPath}' does not exist`,
        )
  }
  return issues
}

/**
 * Repo-gate collector. A repository with no acceptance directory is lawful (no
 * run has been recorded yet); an unreadable or malformed record is not.
 */
export function collectAcceptanceIssues(root: string): string[] {
  const directory = path.join(root, ACCEPTANCE_DIR)
  if (!fs.existsSync(directory)) return []
  const issues: string[] = []
  for (const name of fs.readdirSync(directory).sort()) {
    if (!name.endsWith('.json')) continue
    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))
    } catch {
      issues.push(`${name}: acceptance record is not readable JSON`)
      continue
    }
    issues.push(...validateAcceptanceRecord(root, name, raw))
  }
  return issues
}

/** An unfilled record for one run: every surface starts unverified. */
export function acceptanceTemplate(runId: string, sessionId: string): string {
  return `${JSON.stringify(
    {
      version: 1,
      runId,
      recordedAt: new Date(0).toISOString(),
      sessionId: sessionId === '' ? '<session id from the run>' : sessionId,
      callLedger: 'dev/experiences/raw-traces.jsonl',
      surfaces: UI_SURFACES.map((surface) => ({
        surface,
        outcome: 'unverified',
      })),
      modelObservations: [],
      operatorUiChecks: [],
      automatedRegression: [],
      fallbackSteps: [],
    },
    null,
    2,
  )}\n`
}
