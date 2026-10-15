import * as fs from 'node:fs'
import * as path from 'node:path'

/** Bounded retention: keep the most recent 20 turns per checkpoint dir. */
export const CHECKPOINT_RETENTION = 20

const CHECKPOINT_FILE_SUFFIX = '.json'

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

export function checkpointFilePath(
  checkpointDir: string,
  turnId: string,
): string {
  // turnId is host-provided (the CLI's aiMessageId). basename-guard so a
  // path-like id (`../`, absolute path) can never write outside the dir.
  return path.join(
    checkpointDir,
    `${path.basename(turnId)}${CHECKPOINT_FILE_SUFFIX}`,
  )
}

/** Removes all but the most recent CHECKPOINT_RETENTION checkpoints (by startedAt). */
export async function prune(checkpointDir: string): Promise<void> {
  try {
    const dirents = await fs.promises.readdir(checkpointDir, {
      withFileTypes: true,
    })
    const files = dirents
      .filter((e) => e.isFile() && e.name.endsWith(CHECKPOINT_FILE_SUFFIX))
      .map((e) => path.join(checkpointDir, e.name))
    const withStartedAt = await Promise.all(
      files.map(async (file) => {
        try {
          const parsed = JSON.parse(
            await fs.promises.readFile(file, 'utf8'),
          ) as {
            startedAt?: number
          }
          return { file, startedAt: parsed.startedAt ?? 0 }
        } catch {
          return { file, startedAt: 0 }
        }
      }),
    )
    const ordered = withStartedAt.sort((a, b) => b.startedAt - a.startedAt)
    await Promise.all(
      ordered
        .slice(CHECKPOINT_RETENTION)
        .map((entry) => fs.promises.rm(entry.file, { force: true })),
    )
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
