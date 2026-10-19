import fs from 'node:fs'
import path from 'node:path'

import { z } from 'zod/v4'

import { sessionSummaryReference } from './session-summaries-organize'

export const INTERNAL_FOLLOWUPS = 'dev/tracking/internal-followups.json'
const fid = z.string().regex(/^FID-\d{4}-\d{4}-\d{3}$/)
const text = z.string().trim().min(1)
const base = {
  id: z.string().regex(/^(OBS|LIVE)-\d{3}$/),
  status: z.enum(['open', 'completed']),
  owner: text,
  summary: text,
  nextAction: text,
  evidence: z.array(text).min(1),
  completionEvidence: z.array(text),
}
export const internalFollowupSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...base,
    kind: z.literal('observation'),
    classes: z
      .array(
        z.strictObject({
          classKey: text,
          implementationFid: fid,
          predecessorFid: fid,
        }),
      )
      .min(1),
  }),
  z.strictObject({
    ...base,
    kind: z.literal('live-comparison'),
    sourceFids: z.array(fid),
  }),
])
const manifestSchema = z.strictObject({
  version: z.literal(1),
  followups: z.array(internalFollowupSchema),
})
export type InternalFollowup = z.infer<typeof internalFollowupSchema>

function existingEvidence(root: string, file: string): boolean {
  try {
    const target = fs.realpathSync(path.resolve(root, file))
    const relative = path.relative(fs.realpathSync(root), target)
    return (
      !relative.startsWith('..') &&
      !path.isAbsolute(relative) &&
      fs.statSync(target).isFile()
    )
  } catch {
    return false
  }
}

function fidContent(root: string, id: string): string | undefined {
  const matches = ['dev/fids', 'dev/fids/archive'].flatMap((directory) => {
    const absolute = path.join(root, directory)
    if (!fs.existsSync(absolute)) return []
    return fs
      .readdirSync(absolute)
      .filter((name) => name.startsWith(`${id}-`) && name.endsWith('.md'))
      .map((name) => path.join(absolute, name))
  })
  return matches.length === 1 && matches[0]
    ? fs.readFileSync(matches[0], 'utf8')
    : undefined
}

function observationIssues(
  root: string,
  item: Extract<InternalFollowup, { kind: 'observation' }>,
  owners: Map<string, string>,
): string[] {
  const issues: string[] = []
  for (const entry of item.classes) {
    const content = fidContent(root, entry.implementationFid)
    if (owners.get(entry.classKey) !== entry.implementationFid)
      issues.push(`${item.id}: class ownership mismatch: ${entry.classKey}`)
    if (
      !content ||
      !/^\*\*Status:\*\*\s*(verified|closed)\b/m.test(content) ||
      !/^#{2,3} (?:Implementation Evidence|Code Verification Evidence|Committed repairs)/m.test(
        content,
      )
    )
      issues.push(
        `${item.id}: implementation lacks verification evidence: ${entry.implementationFid}`,
      )
    if (entry.predecessorFid !== entry.implementationFid) {
      const predecessors =
        content
          ?.match(/^\*\*Continues Classes From:\*\*\s*([^\r\n]*)/m)?.[1]
          ?.split(/[,\s]+/) ?? []
      if (!predecessors.includes(entry.predecessorFid))
        issues.push(
          `${item.id}: missing predecessor provenance: ${entry.classKey}`,
        )
    }
    if (!fidContent(root, entry.predecessorFid))
      issues.push(
        `${item.id}: missing predecessor FID: ${entry.predecessorFid}`,
      )
  }
  return issues
}

/** Read-only and fail-closed: invalid entries grant no observation association. */
export function readInternalFollowups(root: string): {
  followups: InternalFollowup[]
  issues: string[]
} {
  if (
    !fs.existsSync(path.join(root, INTERNAL_FOLLOWUPS)) &&
    !fs.existsSync(path.join(root, 'dev/experiences/class-owners.json'))
  )
    return { followups: [], issues: [] }
  try {
    const manifest = manifestSchema.parse(
      JSON.parse(fs.readFileSync(path.join(root, INTERNAL_FOLLOWUPS), 'utf8')),
    )
    const owners = manifest.followups.some(
      (item) => item.kind === 'observation',
    )
      ? z
          .object({ owners: z.array(z.object({ classKey: text, fid })) })
          .parse(
            JSON.parse(
              fs.readFileSync(
                path.join(root, 'dev/experiences/class-owners.json'),
                'utf8',
              ),
            ),
          )
      : { owners: [] }
    const ownerMap = new Map(
      owners.owners.map((entry) => [entry.classKey, entry.fid]),
    )
    const issues: string[] = []
    const ids = new Set<string>()
    const classes = new Set<string>()
    for (const item of manifest.followups) {
      if (ids.has(item.id)) issues.push(`duplicate followup: ${item.id}`)
      ids.add(item.id)
      for (const file of [...item.evidence, ...item.completionEvidence])
        if (!existingEvidence(root, sessionSummaryReference(root, file)))
          issues.push(`${item.id}: missing or unsafe evidence: ${file}`)
      if (item.status === 'completed' && item.completionEvidence.length === 0)
        issues.push(`${item.id}: completed followup lacks evidence`)
      if (item.kind === 'observation') {
        issues.push(...observationIssues(root, item, ownerMap))
        for (const entry of item.classes) {
          if (classes.has(entry.classKey))
            issues.push(`duplicate tracked class: ${entry.classKey}`)
          classes.add(entry.classKey)
        }
      } else {
        for (const source of item.sourceFids)
          if (!fidContent(root, source))
            issues.push(`${item.id}: missing source FID: ${source}`)
      }
    }
    return { followups: issues.length ? [] : manifest.followups, issues }
  } catch (error) {
    return {
      followups: [],
      issues: [
        `internal followup store unavailable or invalid: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
}

/** Association preserves provenance; it does not certify repair or exposure. */
export function observationFollowup(
  followups: readonly InternalFollowup[],
  classKey: string,
  owner: string | undefined,
  predecessor?: string,
): InternalFollowup | undefined {
  return followups.find(
    (item) =>
      item.kind === 'observation' &&
      item.classes.some(
        (entry) =>
          entry.classKey === classKey &&
          entry.implementationFid === owner &&
          (predecessor === undefined || entry.predecessorFid === predecessor),
      ),
  )
}

export function internalFollowupNotes(root: string): string[] {
  if (!fs.existsSync(path.join(root, INTERNAL_FOLLOWUPS))) return []
  const result = readInternalFollowups(root)
  return [
    ...result.issues.map((issue) => `INTERNAL-TRACKING-ERROR: ${issue}`),
    ...result.followups
      .filter((item) => item.status === 'open')
      .map(
        (item) =>
          `INTERNAL: ${item.id} (${item.owner}) — ${item.summary} Next: ${item.nextAction}`,
      ),
  ]
}

export function internalFollowupAgenda(
  notes: readonly string[],
  width: number,
): string[] {
  if (!notes.length) return []
  return [
    '## Internal follow-ups',
    '',
    '`dev/tracking/internal-followups.json` (independent of FID closure).',
    '',
    ...notes.slice(0, 3).map((note) => `- ${note.slice(0, width - 2)}`),
    '',
  ]
}
