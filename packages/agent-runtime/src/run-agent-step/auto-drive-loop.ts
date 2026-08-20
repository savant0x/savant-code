import fs from 'node:fs'
import path from 'node:path'

import {
  buildDriveStatusRecord,
  buildPhaseDirective,
  evaluateFidPhase,
  loadDriveQueue,
  nextPhaseAfter,
  readDriveFid,
  readMasterFidContent,
  selectActiveFid,
} from './auto-drive-driver'
import { loopAgentSteps } from './loop'

import type { LoopAgentStepsParams, LoopAgentStepsResult } from './types'
import type { FidPhase } from '@savant-code/common/types/auto-drive'

/**
 * FID-2026-0818-004: Auto Drive drive-loop supervisor (steps 4-5) + COMPLETE
 * archive move.
 *
 * `driveAutoTurns` owns the FID queue: it scans `dev/fids/`, selects the next
 * non-closed FID in dependency order, injects the phase directive into the
 * STRICT agent's turn, then re-reads the FID file from disk (the agents wrote
 * to it during the turn) and validates phase completion from the file — never
 * the agent's self-report. On COMPLETE it archives the FID and appends the
 * CHANGELOG entry. It stops on the zero-open-FID condition (certification is
 * child 006), a terminal block, an abort, or the turn cap. The supervisor is
 * read-only over FIDs (it parses, never authors evidence) except for the
 * mechanical archive move + CHANGELOG append at COMPLETE.
 *
 * `loopFn` is a dependency-injection seam for tests (preferred over module
 * mocking — AGENTS.md); production callers always use the default.
 */

/** Hard stop on drive turns across all FIDs — bounds a runaway drive. */
export const MAX_DRIVE_TURNS = 200

/** Turn-cap exceeded → terminal block (ladder rung 7). */
export function markDriveBlocked(
  drive: NonNullable<LoopAgentStepsParams['agentState']['drive']>,
  reason: string,
): void {
  drive.status = 'blocked'
}

/** Derive the kebab title from a FID filename (for the CHANGELOG entry). */
export function fidKebabTitle(fileName: string): string {
  return fileName.replace(/^FID-\d{4}-\d{4}-\d{3}-/, '').replace(/\.md$/, '')
}

/** Build a CHANGELOG entry line set for a completed+archived FID. */
export function buildChangelogEntry(fidId: string, fileName: string): string {
  const today = new Date().toISOString().slice(0, 10)
  const title = fidKebabTitle(fileName)
  return (
    `## ${today} — ${fidId}: ${title} (closed)\n\n` +
    `Auto Drive completed \`${fidId}\` through the Perfection Loop\n` +
    `(RED → GREEN → AUDIT → ADVERSARIAL → COMPLETE) and archived it with\n` +
    `mechanical phase-evidence validation.`
  )
}

/**
 * Move a COMPLETE FID from `dev/fids/` to `dev/fids/archive/` and append its
 * CHANGELOG entry. Idempotent by construction: the source must still exist
 * (a missing source is a no-op). Returns the archive path + the appended
 * entry for callers/tests.
 */
export function archiveCompletedFid(
  root: string,
  fid: { id: string; fileName: string },
): { archivePath: string; changelogEntry: string } {
  const src = path.join(root, 'dev', 'fids', fid.fileName)
  const archiveDir = path.join(root, 'dev', 'fids', 'archive')
  fs.mkdirSync(archiveDir, { recursive: true })
  const dest = path.join(archiveDir, fid.fileName)

  let archivePath = dest
  if (fs.existsSync(src) && !fs.existsSync(dest)) {
    fs.renameSync(src, dest)
    archivePath = dest
  } else if (fs.existsSync(dest)) {
    archivePath = dest
  }

  const entry = buildChangelogEntry(fid.id, fid.fileName)
  const changelogPath = path.join(root, 'CHANGELOG.md')
  if (!fs.existsSync(changelogPath)) {
    fs.writeFileSync(changelogPath, `# Changelog\n\n${entry}\n`, 'utf8')
  } else {
    const existing = fs.readFileSync(changelogPath, 'utf8')
    if (!existing.includes(fid.id)) {
      const marker = existing.match(/^## [^\n]*$/m)?.[0]
      const next =
        marker === undefined
          ? `${existing.trimEnd()}\n\n${entry}\n`
          : existing.replace(marker, `${entry}\n${marker}`)
      fs.writeFileSync(changelogPath, next, 'utf8')
    }
  }
  return { archivePath, changelogEntry: entry }
}

/**
 * Drive the FID queue to completion. Runs only when a durable drive record is
 * `active`; otherwise it delegates straight to `loopFn` (the ordinary path).
 */
export async function driveAutoTurns(
  params: LoopAgentStepsParams,
  loopFn: typeof loopAgentSteps = loopAgentSteps,
): Promise<LoopAgentStepsResult> {
  const { agentState, logger, signal, fileContext } = params
  const drive = agentState.drive
  if (!drive || drive.status !== 'active') {
    return loopFn(params)
  }

  const root = fileContext.projectRoot ?? fileContext.cwd
  let result: LoopAgentStepsResult | undefined
  let turns = 0

  while (
    drive.status === 'active' &&
    !signal.aborted &&
    turns < MAX_DRIVE_TURNS
  ) {
    const queue = loadDriveQueue(root)
    const active = selectActiveFid(queue)
    if (!active) break

    const phase: FidPhase = drive.expectPhase ?? 'red'
    drive.activeFid = active.id
    drive.expectPhase = phase

    // FID-2026-0818-007: the open-count baseline is captured on the first
    // loop pass so the queue-growth trend is a true delta since drive start.
    if (drive.initialOpenCount === undefined) {
      drive.initialOpenCount = queue.filter((f) => f.status !== 'closed').length
    }

    const directive = buildPhaseDirective({
      fid: active.id,
      phase,
      goal: drive.goal,
    })
    result = await loopFn({
      ...params,
      prompt: directive,
      content: undefined,
      spawnParams: undefined,
    })

    const refreshed = readDriveFid(
      path.join(root, 'dev', 'fids', active.fileName),
    )
    const { done } = evaluateFidPhase(refreshed.content, phase)
    const next = nextPhaseAfter(phase, done)

    if (next === null) {
      archiveCompletedFid(root, refreshed)
      drive.expectPhase = undefined
      drive.activeFid = null
      // FID-2026-0818-007 step 5: the FID boundary is the deterministic
      // compaction checkpoint — flag it for the next step's context prep.
      agentState.fidBoundaryDue = true
      logger.info({ fid: refreshed.id }, 'Auto Drive: FID archived at COMPLETE')
    } else if (next !== phase) {
      drive.expectPhase = next
    }
    // else: evidence incomplete → same phase (ladder rung 1 mechanical retry).

    // FID-2026-0818-007: refresh the observable status mirror each pass.
    agentState.driveStatus = buildDriveStatusRecord({
      drive,
      queue: loadDriveQueue(root),
      masterContent: readMasterFidContent(root, queue),
    })
    turns += 1
  }

  if (drive.status === 'active' && turns >= MAX_DRIVE_TURNS) {
    markDriveBlocked(drive, `drive turn cap reached (${MAX_DRIVE_TURNS})`)
    logger.warn(
      { driveId: drive.driveId },
      'Auto Drive terminal block — turn cap reached',
    )
  }

  return result ?? (await loopFn(params))
}
