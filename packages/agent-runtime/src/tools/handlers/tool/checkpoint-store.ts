import * as fs from 'node:fs'
import * as path from 'node:path'

import { resolveAndContain } from '@savant-code/common/util/paths'

/**
 * FID-2026-0803-004 — persistent per-turn file checkpoint store (CKR-1/CKR-2).
 *
 * Evolves the previously unwired in-memory `file-snapshot-store.ts` (zero
 * callers) into a durable, turn-scoped store that survives process death:
 *
 *   - One JSON file per user turn under a checkpoint directory.
 *   - `openTurn` / `captureSnapshot` / `closeTurn` bracket a turn; captures
 *     dedupe per path so the FIRST write to a file in a turn records the
 *     pre-edit original (the correct "rewind to before this turn" state even
 *     when the agent edits the same file repeatedly).
 *   - `content: null` means the file did not exist at capture time — restoring
 *     deletes it (created during the turn).
 *   - `restoreTurn` re-validates every path with `resolveAndContain` against
 *     the project root and skips anything that escapes (tampered/foreign
 *     checkpoint files can never write outside the project).
 *   - Bounded retention: `closeTurn` prunes to the most recent 20 turns.
 *
 * Crash semantics: only closed turns survive process death. A turn killed
 * mid-run drops its in-memory buffer (semantically correct — an incomplete
 * turn is never restorable), and `openTurn` resets any stale buffer for the
 * same (dir, turnId), so a re-run never inherits orphaned captures.
 *
 * Design notes:
 *   - The store is a module-level singleton (matching the prior store) but
 *     every call takes the checkpoint directory explicitly so hosts (the CLI)
 *     and tests can point it at arbitrary locations — DI over module state.
 *   - Turn identity is provided by the caller (the CLI's aiMessageId, which is
 *     also threaded into the runtime so subagent writes land in the same turn).
 */

export type CheckpointFileEntry = {
  path: string
  /** Pre-edit content; `null` when the file did not exist (created this turn). */
  content: string | null
}

export type TurnCheckpoint = {
  turnId: string
  startedAt: number
  endedAt: number
  prompt: string | undefined
  /** CLI message count at turn start — conversation-rewind boundary (CKR-4). */
  messageCount: number | undefined
  /** SDK messageHistory length at turn start — conversation-rewind boundary. */
  historyLength: number | undefined
  files: CheckpointFileEntry[]
}

export type TurnSummary = {
  turnId: string
  startedAt: number
  endedAt: number
  prompt: string | undefined
  fileCount: number
  paths: string[]
}

/** Bounded retention: keep the most recent 20 turns per checkpoint dir. */
export const CHECKPOINT_RETENTION = 20

const CHECKPOINT_FILE_SUFFIX = '.json'

/** In-flight buffer entry: captures + turn metadata recorded at open. */
type OpenTurnBuffer = {
  startedAt: number
  files: Map<string, string | null>
  /** Paths whose pre-edit content could not be captured (non-ENOENT read
   *  failure). Never re-captured this turn and never restored — recording
   *  them as `null` would make restore DELETE an existing file (C3 in
   *  FID-2026-0803-005). */
  skippedPaths: Set<string>
  prompt: string | undefined
  messageCount: number | undefined
  historyLength: number | undefined
}

/**
 * Open-turn buffers: `${checkpointDir}\u0000${turnId}` → buffer.
 * The files map is flushed to disk by `closeTurn` and cleared from memory.
 */
const openTurns = new Map<string, OpenTurnBuffer>()

function bufferKey(checkpointDir: string, turnId: string): string {
  return `${checkpointDir}\u0000${turnId}`
}

function checkpointFilePath(checkpointDir: string, turnId: string): string {
  // turnId is host-provided (the CLI's aiMessageId). basename-guard so a
  // path-like id (`../`, absolute path) can never write outside the dir.
  return path.join(
    checkpointDir,
    `${path.basename(turnId)}${CHECKPOINT_FILE_SUFFIX}`,
  )
}

/**
 * Opens a turn. Resets any previous in-memory buffer for the same
 * (dir, turnId) so a re-run of a turn never inherits stale captures.
 * No-op when `checkpointDir` is unset (checkpointing disabled).
 */
export function openTurn(params: {
  checkpointDir?: string
  turnId: string
  prompt?: string
  messageCount?: number
  historyLength?: number
}): void {
  const { checkpointDir, turnId } = params
  if (!checkpointDir) {
    return
  }
  openTurns.set(bufferKey(checkpointDir, turnId), {
    startedAt: Date.now(),
    files: new Map(),
    skippedPaths: new Set(),
    prompt: params.prompt,
    messageCount: params.messageCount,
    historyLength: params.historyLength,
  })
}

/**
 * Captures the pre-write content of `filePath` for the open turn.
 * Dedupes per path: the first capture wins, so later edits to the same file in
 * the same turn never overwrite the original (restore-to-turn-start stays
 * correct). Reads the file synchronously — capture happens on the write hot
 * path immediately before the handler dispatches, matching the prior store's
 * `fs.readFileSync` behavior.
 */
export function captureSnapshot(params: {
  checkpointDir?: string
  turnId: string
  filePath: string
}): void {
  const { checkpointDir, turnId, filePath } = params
  if (!checkpointDir || !filePath) {
    return
  }
  const buffer = openTurns.get(bufferKey(checkpointDir, turnId))
  if (
    !buffer ||
    buffer.files.has(filePath) ||
    buffer.skippedPaths.has(filePath)
  ) {
    return
  }
  try {
    buffer.files.set(filePath, fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    // Only ENOENT means "file didn't exist yet" — record null so restore
    // deletes it (created this turn). ANY other read failure (EACCES,
    // EISDIR, EMFILE, …) must NOT be recorded as `null`: restore would then
    // DELETE a file that exists but simply couldn't be read at capture time.
    // The path is skipped for the rest of the turn instead (FID-2026-0803-005
    // P1a). Error-code narrowing follows common/src/util/paths.ts.
    const code =
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined
    if (code === 'ENOENT') {
      buffer.files.set(filePath, null)
    } else {
      buffer.skippedPaths.add(filePath)
    }
  }
}

/**
 * Flushes the open turn's captures to `<checkpointDir>/<turnId>.json`,
 * prunes to the most recent `CHECKPOINT_RETENTION` turns, and clears the
 * in-memory buffer. No-op (writes nothing) when the turn was never opened.
 * Best-effort: persistence failures are swallowed so a checkpoint problem can
 * never fail the host's run-settle path.
 */
export function closeTurn(params: {
  checkpointDir?: string
  turnId: string
  prompt?: string
  messageCount?: number
  historyLength?: number
}): TurnCheckpoint | null {
  const { checkpointDir, turnId } = params
  if (!checkpointDir) {
    return null
  }
  const key = bufferKey(checkpointDir, turnId)
  const buffer = openTurns.get(key)
  if (!buffer) {
    return null
  }
  openTurns.delete(key)

  const now = Date.now()
  const checkpoint: TurnCheckpoint = {
    turnId,
    startedAt: buffer.startedAt,
    endedAt: now,
    // closeTurn params win; fall back to what openTurn recorded so hosts that
    // only pass the boundary at open still get a complete checkpoint.
    prompt: params.prompt ?? buffer.prompt,
    messageCount: params.messageCount ?? buffer.messageCount,
    historyLength: params.historyLength ?? buffer.historyLength,
    files: Array.from(buffer.files.entries()).map(([p, content]) => ({
      path: p,
      content,
    })),
  }
  try {
    fs.mkdirSync(checkpointDir, { recursive: true })
    fs.writeFileSync(
      checkpointFilePath(checkpointDir, turnId),
      JSON.stringify(checkpoint, null, 2),
      'utf8',
    )
    prune(checkpointDir)
  } catch {
    // Best-effort persistence — never fail the run-settle path.
  }
  return checkpoint
}

/** Removes all but the most recent CHECKPOINT_RETENTION checkpoints (by startedAt). */
function prune(checkpointDir: string): void {
  try {
    const entries = fs
      .readdirSync(checkpointDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(CHECKPOINT_FILE_SUFFIX))
      .map((e) => path.join(checkpointDir, e.name))
      .map((file) => {
        try {
          const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
            startedAt?: number
          }
          return { file, startedAt: parsed.startedAt ?? 0 }
        } catch {
          return { file, startedAt: 0 }
        }
      })
      .sort((a, b) => b.startedAt - a.startedAt)
    for (const entry of entries.slice(CHECKPOINT_RETENTION)) {
      fs.rmSync(entry.file, { force: true })
    }
  } catch {
    // Best-effort pruning.
  }
}

/**
 * Lists all persisted turns for a checkpoint directory, newest first.
 * Returns an empty array when the directory is missing or unreadable.
 */
export function listTurns(checkpointDir?: string): TurnSummary[] {
  if (!checkpointDir) {
    return []
  }
  try {
    return (
      fs
        .readdirSync(checkpointDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(CHECKPOINT_FILE_SUFFIX))
        .map((e) => {
          try {
            return JSON.parse(
              fs.readFileSync(path.join(checkpointDir, e.name), 'utf8'),
            ) as TurnCheckpoint
          } catch {
            return null
          }
        })
        .filter((c): c is TurnCheckpoint => c !== null)
        // Newest first; turnId tiebreaker keeps same-millisecond opens deterministic.
        .sort(
          (a, b) =>
            b.startedAt - a.startedAt || b.turnId.localeCompare(a.turnId),
        )
        .map((c) => ({
          turnId: c.turnId,
          startedAt: c.startedAt,
          endedAt: c.endedAt,
          prompt: c.prompt,
          fileCount: c.files.length,
          paths: c.files.map((f) => f.path),
        }))
    )
  } catch {
    return []
  }
}

/** Loads a single turn checkpoint, or null when missing/corrupt. */
export function getTurn(
  checkpointDir?: string,
  turnId?: string,
): TurnCheckpoint | null {
  if (!checkpointDir || !turnId) {
    return null
  }
  try {
    return JSON.parse(
      fs.readFileSync(checkpointFilePath(checkpointDir, turnId), 'utf8'),
    ) as TurnCheckpoint
  } catch {
    return null
  }
}

/**
 * Restores every file in a turn checkpoint to its pre-edit content.
 *
 * Path safety (CKR security invariant): each path is re-validated with
 * `resolveAndContain` against `projectRoot`. Paths that reject (escape the
 * project, symlink escapes, tampered checkpoint data) are skipped — a
 * checkpoint file can never write outside the project, even if hand-edited.
 *
 * `content: null` entries delete the file (it was created during the turn).
 *
 * Returns the list of successfully restored paths.
 */
export function restoreTurn(params: {
  checkpointDir?: string
  turnId: string
  projectRoot: string
}): string[] {
  const { checkpointDir, turnId, projectRoot } = params
  const checkpoint = getTurn(checkpointDir, turnId)
  if (!checkpoint) {
    return []
  }
  const restored: string[] = []
  for (const entry of checkpoint.files) {
    const pathCheck = resolveAndContain(entry.path, { projectRoot })
    if (pathCheck.kind === 'reject') {
      continue
    }
    try {
      if (entry.content === null) {
        fs.rmSync(pathCheck.resolved, { force: true })
      } else {
        fs.writeFileSync(pathCheck.resolved, entry.content, 'utf8')
      }
      restored.push(entry.path)
    } catch {
      // Best-effort per-file restore.
    }
  }
  return restored
}

/**
 * Fork-from-here: restores the turn's file state (same as `restoreTurn`) and
 * returns the checkpoint data so the host can seed a new session with the
 * truncated conversation. Returns null when the turn doesn't exist.
 */
export function forkFrom(params: {
  checkpointDir?: string
  turnId: string
  projectRoot: string
}): TurnCheckpoint | null {
  const checkpoint = getTurn(params.checkpointDir, params.turnId)
  if (!checkpoint) {
    return null
  }
  restoreTurn(params)
  return checkpoint
}

/** Test-only: clears all in-memory open-turn buffers. */
export function clearOpenTurnsForTesting(): void {
  openTurns.clear()
}
