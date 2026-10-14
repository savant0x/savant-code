#!/usr/bin/env bun
import * as fs from 'node:fs'
import * as path from 'node:path'

import { z } from 'zod/v4'

import {
  experienceRecordSchema,
  type ExperienceRecord,
  type ExposureByClass,
  type ExposureSession,
} from '@savant-code/common/types/experience'
import {
  EXPERIENCE_CLUSTER_GAP_MS,
  classCensusLine,
  experienceClassIdentity,
  pushUnownedClassIssue,
  summarizeExperienceClasses,
} from '@savant-code/common/util/experience-classes'

import { closedOwnerIssues, parseRecurrenceArgs } from './experiences-probe'
import { inspectBoundaryEvidence } from './experiences-proof'

const DAY = 86_400_000
export const OBSERVATION_DAYS = 14
export const OBSERVATION_SESSIONS = 3
const timestamp = z.iso.datetime({ offset: true })
export const fixBoundarySchema = z.object({
  classKey: z.string().min(1),
  commit: z.string().regex(/^[a-f0-9]{40}$/),
  fixedAt: timestamp,
  captureVerified: z.boolean(),
  implementationEvidence: z.string().min(1),
  captureEvidence: z.string().min(1),
})
export type FixBoundary = z.infer<typeof fixBoundarySchema>
export type HorizonState =
  'unresolved' | 'incomplete-observation' | 'recurred' | 'observed'
export interface ClassHorizon {
  state: HorizonState
  postFixFailures: number
  exercisedSessions: number
  elapsedDays: number
}

/** Strict inspection for assertions; capture itself remains fail-open. */
export function inspectLedger(
  content: string,
  now = Date.now(),
): {
  records: ExperienceRecord[]
  issues: string[]
} {
  const records: ExperienceRecord[] = []
  const issues: string[] = []
  content.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return
    try {
      const parsed = experienceRecordSchema.safeParse(JSON.parse(line))
      if (!parsed.success) throw new Error('invalid record schema')
      const record = parsed.data
      if (
        !timestamp.safeParse(record.ts).success ||
        Date.parse(record.ts) > now
      )
        throw new Error('invalid or future timestamp')
      if (
        record.classKey &&
        record.classKey !== experienceClassIdentity(record).key
      )
        throw new Error('stored class identity disagrees with cause')
      records.push(record)
    } catch (error) {
      issues.push(
        `line ${index + 1}: ${error instanceof Error ? error.message : 'invalid JSON'}`,
      )
    }
  })
  if (records.length === 0 && issues.length === 0)
    issues.push('ledger has no valid records')
  return { records, issues }
}

/** A boundary is a hypothesis until reliable capture and real exposure support it. */
export function evaluateClassHorizon(
  records: readonly ExperienceRecord[],
  classKey: string,
  boundary: FixBoundary | undefined,
  exposure: readonly ExposureSession[],
  now = Date.now(),
): ClassHorizon {
  if (!boundary)
    return {
      state: 'unresolved',
      postFixFailures: 0,
      exercisedSessions: 0,
      elapsedDays: 0,
    }
  const fixedAt = Date.parse(boundary.fixedAt)
  const elapsedDays = (now - fixedAt) / DAY
  const postFixFailures = records.filter(
    (record) =>
      experienceClassIdentity(record).key === classKey &&
      Date.parse(record.ts) >= fixedAt,
  ).length
  const exercisedSessions = new Set(
    exposure
      .filter((entry) => {
        const ts = Date.parse(entry.exercisedAt)
        return (
          Number.isFinite(ts) &&
          ts >= fixedAt &&
          ts <= now &&
          entry.evidence.trim() !== ''
        )
      })
      .map((entry) => entry.sessionId),
  ).size
  const complete =
    boundary.classKey === classKey &&
    boundary.captureVerified &&
    Number.isFinite(elapsedDays) &&
    elapsedDays >= OBSERVATION_DAYS &&
    exercisedSessions >= OBSERVATION_SESSIONS
  return {
    state:
      postFixFailures > 0
        ? 'recurred'
        : complete
          ? 'observed'
          : 'incomplete-observation',
    postFixFailures,
    exercisedSessions,
    elapsedDays,
  }
}

export const ownerManifestSchema = z.object({
  version: z.literal(1),
  owners: z.array(
    z.object({
      classKey: z.string().min(1),
      fid: z.string().regex(/^FID-\d{4}-\d{4}-\d{3}$/),
    }),
  ),
})
export const boundaryManifestSchema = z.object({
  version: z.literal(1),
  boundaries: z.array(fixBoundarySchema),
})

/** A declared repair fails on recurrence, missing capture, or an elapsed window. */
function repairClaimIssues(
  classKey: string,
  boundary: FixBoundary,
  horizon: ClassHorizon,
): string[] {
  if (horizon.state === 'recurred')
    return [`unsupported repair: ${classKey} (recurred)`]
  if (!boundary.captureVerified)
    return [`repair declared without capture coverage: ${classKey}`]
  if (
    horizon.state === 'incomplete-observation' &&
    horizon.elapsedDays >= OBSERVATION_DAYS
  )
    return [`repair window elapsed without qualified exposure: ${classKey}`]
  return []
}

export function recurrenceReport(
  records: readonly ExperienceRecord[],
  owners: z.infer<typeof ownerManifestSchema>,
  boundaries: z.infer<typeof boundaryManifestSchema>,
  exposure: ExposureByClass = new Map(),
  now = Date.now(),
) {
  const issues: string[] = []
  const ownerMap = new Map<string, string>()
  for (const owner of owners.owners) {
    if (ownerMap.has(owner.classKey))
      issues.push(`duplicate owner: ${owner.classKey}`)
    ownerMap.set(owner.classKey, owner.fid)
  }
  const boundaryMap = new Map<string, FixBoundary>()
  for (const boundary of boundaries.boundaries) {
    if (boundaryMap.has(boundary.classKey))
      issues.push(`duplicate boundary: ${boundary.classKey}`)
    if (!ownerMap.has(boundary.classKey))
      issues.push(`unowned boundary: ${boundary.classKey}`)
    boundaryMap.set(boundary.classKey, boundary)
  }
  const classes = summarizeExperienceClasses(records).map((summary) => {
    const owner = ownerMap.get(summary.key)
    if (!owner) pushUnownedClassIssue(issues, summary)
    const boundary = boundaryMap.get(summary.key)
    const horizon = evaluateClassHorizon(
      records,
      summary.key,
      boundary,
      exposure.get(summary.key) ?? [],
      now,
    )
    if (boundary)
      issues.push(...repairClaimIssues(summary.key, boundary, horizon))
    return { ...summary, owner, ...horizon }
  })
  for (const key of boundaryMap.keys()) {
    if (!classes.some((entry) => entry.key === key))
      issues.push(`boundary has no recorded class: ${key}`)
  }
  return { classes, issues }
}

/** CLI does not mutate the immutable ledger or manufacture repair boundaries. */
if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..')
  try {
    const options = parseRecurrenceArgs(process.argv.slice(2))
    const directory = path.join(root, 'dev/experiences')
    const ledger = inspectLedger(
      fs.readFileSync(path.join(directory, 'raw-traces.jsonl'), 'utf8'),
    )
    const owners = ownerManifestSchema.parse(
      JSON.parse(
        fs.readFileSync(path.join(directory, 'class-owners.json'), 'utf8'),
      ),
    )
    const boundaries = boundaryManifestSchema.parse(
      JSON.parse(
        fs.readFileSync(path.join(directory, 'fix-boundaries.json'), 'utf8'),
      ),
    )
    const exposures = new Map<string, readonly ExposureSession[]>()
    const boundaryIssues = new Map<string, number>()
    const proofIssues: string[] = []
    for (const boundary of boundaries.boundaries) {
      const inspection = inspectBoundaryEvidence(root, boundary)
      proofIssues.push(...inspection.issues)
      boundaryIssues.set(boundary.classKey, inspection.issues.length)
      exposures.set(boundary.classKey, inspection.exposure)
    }
    const report = recurrenceReport(
      ledger.records,
      owners,
      boundaries,
      exposures,
    )
    const issues = [...ledger.issues, ...report.issues, ...proofIssues]
    for (const entry of report.classes) {
      if (
        (boundaryIssues.get(entry.key) ?? 0) > 0 &&
        entry.state === 'observed'
      )
        entry.state = 'incomplete-observation'
    }
    issues.push(
      ...closedOwnerIssues(
        root,
        owners.owners.map((owner) => owner.fid),
        report.classes,
      ),
    )
    const assertion = options.assertion
    if (assertion !== undefined) {
      const owned = report.classes.filter((entry) => entry.owner === assertion)
      if (owned.length === 0)
        issues.push(`repair assertion has no owned classes: ${assertion}`)
      for (const entry of owned) {
        if (entry.state !== 'observed')
          issues.push(`repair is unproved: ${entry.key} (${entry.state})`)
      }
    }
    if (options.json) {
      console.log(
        JSON.stringify(
          { records: ledger.records.length, ...report, issues },
          null,
          2,
        ),
      )
    } else {
      console.log(
        `recurrence probe: ${ledger.records.length} records, ${report.classes.length} stable classes, ${issues.length} issues`,
      )
      console.log(
        `Time clusters group rows by class and session with a consecutive gap < ${EXPERIENCE_CLUSTER_GAP_MS}ms; they are not response or failure counts.`,
      )
      for (const entry of report.classes) console.log(classCensusLine(entry))
      for (const issue of issues) console.error(issue)
    }
    process.exitCode = issues.length ? 1 : 0
  } catch (error) {
    console.error(
      `recurrence probe: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  }
}
