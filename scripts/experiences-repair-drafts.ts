import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import z from 'zod/v4'

import { findUnownedEligibleClasses } from './experiences-coverage'
import { inspectLedger, ownerManifestSchema } from './experiences-recurrence'

const PROPOSALS_PATH = 'dev/experiences/repair-proposals.jsonl'
const proposalSchema = z.object({
  classKey: z.string(),
  fid: z.string().regex(/^FID-\d{4}-\d{4}-\d{3}$/),
  proposalSha: z.string(),
  document: z.string(),
})
export type RepairDraft = z.infer<typeof proposalSchema>

function existingDrafts(root: string): RepairDraft[] {
  const file = path.join(root, PROPOSALS_PATH)
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => proposalSchema.parse(JSON.parse(line)))
}

function nextNumber(
  root: string,
  date: string,
  drafts: readonly RepairDraft[],
): number {
  const ids = drafts.map((draft) => draft.fid)
  for (const directory of ['dev/fids', 'dev/fids/archive']) {
    const folder = path.join(root, directory)
    if (fs.existsSync(folder)) ids.push(...fs.readdirSync(folder))
  }
  const pattern = new RegExp(`^FID-${date}-(\\d{3})(?:-|$)`)
  return (
    Math.max(0, ...ids.map((id) => Number(id.match(pattern)?.[1] ?? 0))) + 1
  )
}

/** A complete proposed record is durable, but grants no active owner or write authority. */
export function planRepairDrafts(
  root: string,
  now = Date.now(),
): RepairDraft[] {
  const directory = path.join(root, 'dev/experiences')
  if (!fs.existsSync(path.join(directory, 'class-owners.json'))) return []
  const ledger = inspectLedger(
    fs.readFileSync(path.join(directory, 'raw-traces.jsonl'), 'utf8'),
    now,
  )
  if (ledger.issues.length)
    throw new Error(`Repair drafting refused: ${ledger.issues.join('; ')}`)
  const owners = ownerManifestSchema.parse(
    JSON.parse(
      fs.readFileSync(path.join(directory, 'class-owners.json'), 'utf8'),
    ),
  )
  const existing = existingDrafts(root)
  const alreadyDrafted = new Set(existing.map((draft) => draft.classKey))
  const date = new Date(now)
    .toISOString()
    .slice(0, 10)
    .replace(/-(\d\d)$/, '$1')
  let number = nextNumber(root, date, existing)
  return findUnownedEligibleClasses({
    records: ledger.records,
    owners: owners.owners.map((owner) => owner.classKey),
    now,
  })
    .filter((issue) => !alreadyDrafted.has(issue.classKey))
    .map((issue) => {
      if (number > 999)
        throw new Error(
          'Repair draft allocation exhausted; operator routing required.',
        )
      const fid = `FID-${date}-${String(number++).padStart(3, '0')}`
      const document = [
        '# FID: Investigate an unowned recurring failure class',
        '',
        `**Filename:** \`${fid}-unowned-failure-class.md\``,
        `**ID:** ${fid}`,
        '**Severity:** medium',
        '**Status:** created',
        `**Created:** ${new Date(now).toISOString()}`,
        '**Automation level:** 1',
        '**YAGNI-Compliance:** Pending',
        '**Master FID:** FID-2026-1012-022',
        '',
        '## Summary',
        '',
        'A recurring class needs investigated cause, an owning repair and qualified observation.',
        '',
        '## Evidence',
        '',
        `Class identity: ${JSON.stringify(issue.classKey)}.`,
        `${issue.count} records; ${issue.sessions} distinct sessions in 14 days; last seen ${issue.lastSeen}.`,
        'Source: dev/experiences/raw-traces.jsonl; stable identity and eligibility use the shared authorities.',
        '',
        '## Proposed Solution',
        '',
        'Investigate the production producer and capture path before proposing code.',
        'Converge RED, GREEN and AUDIT; declare deterministic gates and a qualified observation window.',
        'Write the lesson only after observed repair. This proposed document grants no source-write authority.',
        '',
        '## Resolution',
        '',
        'Operator routing into the active register, master child list and owner manifest is required.',
        '',
      ].join('\n')
      return {
        classKey: issue.classKey,
        fid,
        document,
        proposalSha: crypto.createHash('sha256').update(document).digest('hex'),
      }
    })
}

export function writeRepairDrafts(
  root: string,
  now = Date.now(),
): RepairDraft[] {
  if (!fs.existsSync(path.join(root, 'dev/experiences/class-owners.json')))
    return []
  const lockPath = path.join(root, 'dev/experiences/repair-drafts.lock')
  let lock: number
  try {
    lock = fs.openSync(lockPath, 'wx')
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EEXIST'
    )
      return []
    throw error
  }
  try {
    const drafts = planRepairDrafts(root, now)
    if (drafts.length)
      fs.appendFileSync(
        path.join(root, PROPOSALS_PATH),
        drafts.map((draft) => JSON.stringify(draft)).join('\n') + '\n',
      )
    return drafts
  } finally {
    fs.closeSync(lock)
    fs.unlinkSync(lockPath)
  }
}

/** SessionEnd remains fail-open and can never approve the proposed records. */
export function repairDraftRoutingNotes(
  root: string,
  now = Date.now(),
): string[] {
  try {
    return writeRepairDrafts(root, now).map(
      (draft) =>
        `REPAIR-DRAFT: ${draft.fid}; operator routing required (${PROPOSALS_PATH}).`,
    )
  } catch {
    return [
      'REPAIR-DRAFT: evidence could not be validated; run bun scripts/experiences-repair-drafts.ts.',
    ]
  }
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..')
  const drafts = process.argv.includes('--write')
    ? writeRepairDrafts(root)
    : planRepairDrafts(root)
  console.log(
    `repair drafts: PASS (${drafts.length} new proposed records; operator routing required before ownership)`,
  )
}
