/**
 * @module echo/scope-register-completeness
 *
 * FID-2026-0919-025 — a register line for every tracked item.
 *
 * FID-2026-0919-024 removed the *label* an agent used to trim scope. It could
 * not remove the quiet path: an item that never gets a line in `SCOPE.md` is
 * invisible in the register, so it can be dropped without an operator decision
 * and without writing any forbidden token. That is the same failure (Law 2
 * scope reduction with no approval) with nothing to grep for.
 *
 * This module is the single authority for that half. Two decidable legs:
 *
 * 1. **FID coverage** — every record in the active queue (`dev/fids/FID-*.md`)
 *    must be named in `SCOPE.md`. A FID is a work item by definition, so a FID
 *    the register has never heard of is unreachable policy.
 * 2. **Task coverage** — every task an active FID or a current session summary
 *    cites (`Task NN`, `TNN-X`) must exist in the register as a `## Task NN`
 *    heading or a `TNN-X` item id.
 *
 * A reference written in inline code is a *quotation* — a historical id or the
 * rule being restated — while a bare one is a claim on current scope. That is
 * the same distinction the disposition guard makes for its tokens, shared
 * through `withoutInlineCode`, so both halves of the scope guard agree.
 *
 * Boundaries, stated because they are real and not because they are deferred:
 * what this cannot read is prose. A session that does work and files neither a
 * FID nor a task reference writes nothing to match, and no text check can
 * decide that from the summary alone — that is what the register discipline
 * itself is for. Historical records are not rewritten: the same effective date
 * the disposition guard uses (`SCOPE_GUARD_EFFECTIVE_DATE`) windows the
 * narrative surfaces, while the active queue and the register are always live.
 */

import fs from 'node:fs'
import path from 'node:path'

import {
  SCOPE_GUARD_EFFECTIVE_DATE,
  withoutInlineCode,
} from './scope-disposition-guard'

/** One tracked item that the register does not account for. */
export type RegisterCompletenessIssue = {
  file: string
  line: number
  subject: string
  message: string
}

/** What `SCOPE.md` accounts for. */
export type RegisteredTasks = {
  /** `## Task 74 — ...` */
  taskNumbers: Set<number>
  /** `- [x] **T74-A. ...**` */
  itemIds: Set<string>
}

const REGISTER_PATH = 'SCOPE.md'

const TASK_HEADING = /^##\s+Task\s+(\d+)/
const TASK_ITEM_ID = /\*\*T(\d+)-([A-Z])\./
const TASK_NUMBER_REFERENCE = /\bTask\s+(\d+)\b/g
const TASK_ITEM_REFERENCE = /\bT(\d+)-([A-Z])\b/g
const ACTIVE_FID_FILE = /^FID-[\w.-]+\.md$/
const FID_ID = /\bFID-\d{4}-\d{4}-\d{3}\b/

/** The task numbers and item ids a register body accounts for. */
export function collectRegisteredTasks(scopeContent: string): RegisteredTasks {
  const taskNumbers = new Set<number>()
  const itemIds = new Set<string>()
  for (const line of scopeContent.split('\n')) {
    const heading = line.match(TASK_HEADING)
    if (heading?.[1]) taskNumbers.add(Number(heading[1]))
    const item = line.match(TASK_ITEM_ID)
    if (item?.[1] && item[2]) {
      itemIds.add(`T${item[1]}-${item[2]}`)
      // An item id is itself a register line for its task.
      taskNumbers.add(Number(item[1]))
    }
  }
  return { taskNumbers, itemIds }
}

/**
 * Task references in one document that the register does not account for. A
 * reference is satisfied by either the task's number or the specific item id.
 */
export function scanUnregisteredTaskReferences(
  content: string,
  file: string,
  registered: RegisteredTasks,
): RegisterCompletenessIssue[] {
  const issues: RegisterCompletenessIssue[] = []
  for (const [index, rawLine] of content.split('\n').entries()) {
    // Inline code is a quotation, not a claim — the same rule the disposition
    // guard applies to its tokens. Without it a record could not quote a
    // historical task id (or restate this rule) at all; with it, a bare id is
    // still the claim that must be registered.
    const line = withoutInlineCode(rawLine)
    const seen = new Set<string>()
    for (const match of line.matchAll(TASK_NUMBER_REFERENCE)) {
      const number = match[1]
      if (!number) continue
      const subject = `Task ${number}`
      if (seen.has(subject) || registered.taskNumbers.has(Number(number)))
        continue
      seen.add(subject)
      issues.push({
        file,
        line: index + 1,
        subject,
        message:
          `${file}:${String(index + 1)} cites "${subject}", which has no line in ` +
          'SCOPE.md — every tracked item needs a register line (a "## Task NN" ' +
          'section or a "TNN-X" item). Add the line; nothing is out of scope.',
      })
    }
    for (const match of line.matchAll(TASK_ITEM_REFERENCE)) {
      const number = match[1]
      const letter = match[2]
      if (!number || !letter) continue
      const subject = `T${number}-${letter}`
      if (seen.has(subject)) continue
      const known =
        registered.itemIds.has(subject) ||
        registered.taskNumbers.has(Number(number))
      if (known) continue
      seen.add(subject)
      issues.push({
        file,
        line: index + 1,
        subject,
        message:
          `${file}:${String(index + 1)} cites "${subject}", which has no line in ` +
          'SCOPE.md — every tracked item needs a register line (a "## Task NN" ' +
          'section or a "TNN-X" item). Add the line; nothing is out of scope.',
      })
    }
  }
  return issues
}

/** Leading `YYYY-MM-DD` of a session-summary filename. */
function summaryDate(fileName: string): string | undefined {
  return fileName.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
}

function readIfPresent(root: string, relativePath: string): string | undefined {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8')
  } catch {
    return undefined
  }
}

function listDirectory(root: string, relativePath: string): string[] {
  try {
    return fs.readdirSync(path.join(root, relativePath))
  } catch {
    return []
  }
}

/** Line of a FID's own `**ID:**` metadata, for a useful diagnostic. */
function fidIdLine(content: string): number {
  const index = content
    .split('\n')
    .findIndex((line) => line.includes('**ID:**'))
  return index === -1 ? 1 : index + 1
}

/**
 * Every register-completeness gap under `root`: active FIDs the register does
 * not name, and task references in the active queue or in current session
 * summaries that the register does not account for.
 */
export function collectRegisterCompletenessIssues(
  root: string,
): RegisterCompletenessIssue[] {
  const scopeContent = readIfPresent(root, REGISTER_PATH)
  if (scopeContent === undefined) return []
  const registered = collectRegisteredTasks(scopeContent)
  const issues: RegisterCompletenessIssue[] = []

  for (const entry of listDirectory(root, 'dev/fids')) {
    if (!ACTIVE_FID_FILE.test(entry)) continue
    const file = `dev/fids/${entry}`
    const content = readIfPresent(root, file)
    if (content === undefined) continue
    const id = entry.match(FID_ID)?.[0]
    if (id && !scopeContent.includes(id)) {
      issues.push({
        file,
        line: fidIdLine(content),
        subject: id,
        message:
          `${file}: active FID ${id} has no line in SCOPE.md — an item tracked ` +
          'only in the queue is invisible in the register and can be dropped ' +
          'with no operator decision. Add its register line (a "## Task NN" ' +
          'section naming the FID, or a "TNN-X" item).',
      })
    }
    issues.push(...scanUnregisteredTaskReferences(content, file, registered))
  }

  for (const entry of listDirectory(root, 'dev/session-summaries')) {
    if (!entry.endsWith('.md')) continue
    const date = summaryDate(entry)
    if (!date || date < SCOPE_GUARD_EFFECTIVE_DATE) continue
    const file = `dev/session-summaries/${entry}`
    const content = readIfPresent(root, file)
    if (content === undefined) continue
    issues.push(...scanUnregisteredTaskReferences(content, file, registered))
  }

  return issues
}
