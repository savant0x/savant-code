import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import z from 'zod/v4'

import { lessonSpans } from './learnings-locator.js'
import { removeLessonSpans } from './learnings-retirement-spans.js'

import type { LearningsMoveRecord, RetireResult } from './learnings-retire'

export const RETIREMENT_PENDING_PATH = path.join(
  'dev',
  'learnings-retirement.pending.json',
)
export const RETIREMENT_LOCK_PATH = path.join(
  'dev',
  'learnings-retirement.lock',
)
const ARTIFACTS = {
  archive: path.join('dev', 'LEARNINGS-RETIRED.md'),
  ledger: path.join('dev', 'LEARNINGS.md'),
  receipts: path.join('dev', 'learnings-move-log.jsonl'),
} as const
type Artifact = keyof typeof ARTIFACTS
export type RetirementFileWriter = (file: string, content: string) => void
const snapshot = z.object({ before: z.string().nullable(), after: z.string() })
const moveRecordSchema = z.object({
  title: z.string(),
  date: z.string(),
  reason: z.string(),
  destination: z.string(),
  retiredAt: z.iso.datetime({ offset: true }),
  linesBefore: z.number().int().nonnegative(),
  linesAfter: z.number().int().nonnegative(),
})
const journalSchema = z.object({
  version: z.literal(1),
  ownerPid: z.number().int().positive(),
  archive: snapshot,
  ledger: snapshot,
  receipts: snapshot,
  records: z.array(moveRecordSchema).min(1),
})
type Journal = z.infer<typeof journalSchema>
interface RetirementPlan {
  root: string
  ledgerBefore: string
  ledgerAfter: string
  archiveBody: string
  records: LearningsMoveRecord[]
  write?: RetirementFileWriter
}

function archiveAfter(before: string | null, body: string): string {
  const head =
    before ??
    '# Retired Learnings (FID-2026-0824-012 S3-C — move-only archive)\n\n' +
      '> Entries retired from dev/LEARNINGS.md are appended here verbatim.\n' +
      '> Rules are never deleted — this archive is append-only.\n\n'
  const separator = head.endsWith('\n\n')
    ? ''
    : head.endsWith('\n')
      ? '\n'
      : '\n\n'
  return `${head}${separator}${body}\n`
}

function receiptsAfter(
  before: string | null,
  records: LearningsMoveRecord[],
): string {
  const head = before ?? ''
  return (
    head +
    (head && !head.endsWith('\n') ? '\n' : '') +
    records.map((record) => JSON.stringify(record)).join('\n') +
    '\n'
  )
}

/** A readable journal still must describe this exact move-only transformation. */
function validateJournal(journal: Journal): void {
  const before = journal.ledger.before
  if (before === null)
    throw new Error('Retirement journal has no source ledger')
  const titles = new Set(journal.records.map((record) => record.title))
  const entries = lessonSpans(before).filter((entry) => titles.has(entry.title))
  const body = entries.map((entry) => entry.block.trimEnd()).join('\n\n---\n\n')
  if (
    entries.length !== journal.records.length ||
    removeLessonSpans(before, titles) !== journal.ledger.after ||
    archiveAfter(journal.archive.before, body) !== journal.archive.after ||
    receiptsAfter(journal.receipts.before, journal.records) !==
      journal.receipts.after
  )
    throw new Error(
      'Retirement journal does not describe a move-only transaction',
    )
  for (const record of journal.records)
    if (
      record.destination !== ARTIFACTS.archive ||
      record.date !==
        entries.find((entry) => entry.title === record.title)?.entry.date ||
      record.linesBefore !== before.split(/\r?\n/).length ||
      record.linesAfter !== journal.ledger.after.split(/\r?\n/).length
    )
      throw new Error('Retirement journal receipt disagrees with its source')
}

function artifactPath(root: string, name: string): string {
  const file = path.join(root, name)
  const relative = path.relative(
    fs.realpathSync(root),
    fs.realpathSync(path.dirname(file)),
  )
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error('Retirement artifact parent escapes the repository')
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink())
    throw new Error('Retirement artifacts must not be symlinks')
  return file
}

function readText(file: string): string | null {
  if (!fs.existsSync(file)) return null
  const bytes = fs.readFileSync(file)
  const text = bytes.toString('utf8')
  if (!Buffer.from(text, 'utf8').equals(bytes))
    throw new Error('Retirement artifact is not valid UTF-8')
  return text
}

/** Private sibling then rename prevents an interrupted write truncating evidence. */
export function writeRetirementFile(file: string, content: string): void {
  const temporary = `${file}.retirement-${randomUUID()}`
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' })
    fs.renameSync(temporary, file)
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
  }
}

function refuseLiveOwner(ownerPid: number): void {
  if (ownerPid === process.pid) return
  try {
    process.kill(ownerPid, 0)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH')
      return
    throw new Error('Cannot establish that the pending retirement owner exited')
  }
  throw new Error('Pending retirement belongs to a live process')
}

/** Abrupt process death leaves a conservative lock for confirmed operator clearance. */
function withWriterLock(root: string, run: () => RetireResult): RetireResult {
  const file = artifactPath(root, RETIREMENT_LOCK_PATH)
  const descriptor = fs.openSync(file, 'wx')
  try {
    fs.writeSync(descriptor, String(process.pid))
    return run()
  } finally {
    fs.closeSync(descriptor)
    fs.unlinkSync(file)
  }
}

function finish(
  root: string,
  journal: Journal,
  write: RetirementFileWriter,
): RetireResult {
  validateJournal(journal)
  refuseLiveOwner(journal.ownerPid)
  // Preflight all artifacts before replay so a later conflict changes nothing.
  const pending = (['archive', 'ledger', 'receipts'] as const).filter(
    (kind) => {
      const current = readText(artifactPath(root, ARTIFACTS[kind]))
      if (current === journal[kind].after) return false
      if (current !== journal[kind].before)
        throw new Error(`Retirement recovery conflict: ${kind}`)
      return true
    },
  )
  for (const kind of pending)
    write(artifactPath(root, ARTIFACTS[kind]), journal[kind].after)
  for (const kind of Object.keys(ARTIFACTS) as Artifact[])
    if (readText(artifactPath(root, ARTIFACTS[kind])) !== journal[kind].after)
      throw new Error(`Retirement write did not complete: ${kind}`)
  fs.unlinkSync(artifactPath(root, RETIREMENT_PENDING_PATH))
  return {
    retired: journal.records.map(({ title, reason }) => ({ title, reason })),
    linesBefore: journal.records[0]!.linesBefore,
    linesAfter: journal.records[0]!.linesAfter,
  }
}

/** Recovery precedes any size-based early return; never overwrites conflicting edits. */
export function resumeRetirement(
  root: string,
  write: RetirementFileWriter = writeRetirementFile,
): RetireResult | undefined {
  if (!fs.existsSync(path.join(root, RETIREMENT_PENDING_PATH))) return undefined
  const text = readText(artifactPath(root, RETIREMENT_PENDING_PATH))
  if (text === null) return undefined
  return withWriterLock(root, () =>
    finish(root, journalSchema.parse(JSON.parse(text)), write),
  )
}

export function commitRetirement(params: RetirementPlan): RetireResult {
  return withWriterLock(params.root, () => prepareRetirement(params))
}

function prepareRetirement(params: RetirementPlan): RetireResult {
  const { root, records } = params
  const archiveBefore = readText(artifactPath(root, ARTIFACTS.archive))
  const receiptsBefore = readText(artifactPath(root, ARTIFACTS.receipts))
  const journal: Journal = {
    version: 1,
    ownerPid: process.pid,
    archive: {
      before: archiveBefore,
      after: archiveAfter(archiveBefore, params.archiveBody),
    },
    ledger: { before: params.ledgerBefore, after: params.ledgerAfter },
    receipts: {
      before: receiptsBefore,
      after: receiptsAfter(receiptsBefore, records),
    },
    records,
  }
  validateJournal(journal)
  fs.writeFileSync(
    artifactPath(root, RETIREMENT_PENDING_PATH),
    JSON.stringify(journal),
    { encoding: 'utf8', flag: 'wx' },
  )
  return finish(root, journal, params.write ?? writeRetirementFile)
}
