import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { z } from 'zod/v4'

import type { FidLedgerIssue } from './fid-ledger-types'

export const TASK_ID_LEDGER_PATH = 'dev/task-id-ledger.json'

const allocationSchema = z
  .object({
    id: z.string().regex(/^T[1-9]\d*(?:-[A-Za-z0-9-]+)?$/),
    title: z.string().trim().min(1),
  })
  .strict()
const ledgerSchema = z
  .object({
    version: z.literal(1),
    reservedThrough: z.number().int().nonnegative().safe(),
    allocations: z.array(allocationSchema),
  })
  .strict()

type TaskAllocation = z.infer<typeof allocationSchema>
type TaskLedger = z.infer<typeof ledgerSchema>

function taskNumber(id: string): number {
  return Number(id.match(/^T(\d+)/)?.[1])
}

function normalizedTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim()
}

function readLedger(content: string): TaskLedger {
  return ledgerSchema.parse(JSON.parse(content))
}

/** Parse only declarations, never task mentions inside prose or write targets. */
export function scopeTaskAllocations(scope: string): TaskAllocation[] {
  const items = [
    ...scope.matchAll(
      /^- \[[ x]\] \*\*(T\d+(?:-[A-Za-z0-9-]+)?)\.([^*]*?)\*\*/gm,
    ),
  ].map((match) => ({
    id: match[1]!,
    title: normalizedTitle(match[2]!) || match[1]!,
  }))
  const headings = [
    ...scope.matchAll(/^## Task (\d+)\s*(?:[—:-]\s*)?([^\n]*)/gm),
  ].map((match) => ({
    id: `T${match[1]!}`,
    title: normalizedTitle(match[2]!) || `T${match[1]!}`,
  }))
  return [...items, ...headings]
}

function issue(message: string): FidLedgerIssue {
  return { code: 'scope.task-id-ledger', message }
}

function allocationIssues(ledger: TaskLedger): FidLedgerIssue[] {
  const issues: FidLedgerIssue[] = []
  const numbers = new Set<number>()
  for (const entry of ledger.allocations) {
    const number = taskNumber(entry.id)
    if (!Number.isSafeInteger(number) || numbers.has(number)) {
      issues.push(issue(`Duplicate or unsafe task number: ${entry.id}.`))
    }
    numbers.add(number)
  }
  return issues
}

function appendOnlyIssues(
  current: TaskLedger,
  previous: TaskLedger,
): FidLedgerIssue[] {
  const issues: FidLedgerIssue[] = []
  if (current.reservedThrough !== previous.reservedThrough) {
    issues.push(issue('The legacy task reservation cannot be changed.'))
  }
  const existing = new Map(
    previous.allocations.map((entry) => [entry.id, entry.title]),
  )
  const now = new Map(
    current.allocations.map((entry) => [entry.id, entry.title]),
  )
  for (const [id, title] of existing) {
    if (now.get(id) !== title)
      issues.push(issue(`Committed allocation ${id} was removed or renamed.`))
  }
  const highWater = previous.allocations.reduce(
    (maximum, entry) => Math.max(maximum, taskNumber(entry.id)),
    previous.reservedThrough,
  )
  for (const entry of current.allocations) {
    if (!existing.has(entry.id) && taskNumber(entry.id) <= highWater) {
      issues.push(
        issue(
          `${entry.id} reuses a reserved number; allocate above ${highWater}.`,
        ),
      )
    }
  }
  return issues
}

/** Pure contract check, also usable without a git checkout in fixture tests. */
export function validateTaskIdLedger(
  scope: string,
  content: string,
  previousContent?: string,
): FidLedgerIssue[] {
  try {
    const ledger = readLedger(content)
    const issues = allocationIssues(ledger)
    const allocations = new Map(
      ledger.allocations.map((entry) => [entry.id, entry.title]),
    )
    const live = new Set<string>()
    for (const entry of scopeTaskAllocations(scope)) {
      if (live.has(entry.id))
        issues.push(issue(`Duplicate live task declaration ${entry.id}.`))
      live.add(entry.id)
      if (allocations.get(entry.id) !== entry.title) {
        issues.push(
          issue(
            `${entry.id} has no matching permanent allocation for "${entry.title}".`,
          ),
        )
      }
    }
    if (previousContent !== undefined) {
      const previous = readLedger(previousContent)
      issues.push(
        ...allocationIssues(previous),
        ...appendOnlyIssues(ledger, previous),
      )
    }
    return issues
  } catch {
    return [
      issue(
        'Task-ID ledger is missing or malformed; preserve its allocation history.',
      ),
    ]
  }
}

function committedLedger(root: string): string | undefined {
  if (!fs.existsSync(path.join(root, '.git'))) return undefined
  const options = { cwd: root, encoding: 'utf8' as const, windowsHide: true }
  const listed = spawnSync(
    'git',
    ['ls-tree', '--name-only', 'HEAD', '--', TASK_ID_LEDGER_PATH],
    options,
  )
  if (listed.error || listed.status !== 0)
    throw new Error('Cannot inspect committed task ledger')
  if (listed.stdout.trim() === '') return undefined
  const previous = spawnSync(
    'git',
    ['show', `HEAD:${TASK_ID_LEDGER_PATH}`],
    options,
  )
  if (previous.error || previous.status !== 0)
    throw new Error('Cannot read committed task ledger')
  return previous.stdout
}

/** Standing scope/repository probe; never writes or renumbers tasks. */
export function collectTaskIdLedgerIssues(root: string): FidLedgerIssue[] {
  try {
    return validateTaskIdLedger(
      fs.readFileSync(path.join(root, 'SCOPE.md'), 'utf8'),
      fs.readFileSync(path.join(root, TASK_ID_LEDGER_PATH), 'utf8'),
      committedLedger(root),
    )
  } catch {
    return [
      issue(
        'Cannot read scope or permanent task-ID history; validation fails closed.',
      ),
    ]
  }
}
