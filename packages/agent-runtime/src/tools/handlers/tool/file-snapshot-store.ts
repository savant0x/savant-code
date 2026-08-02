import fs from 'fs'

/**
 * In-memory store for pre-execution file snapshots.
 * Maps runId → Map<path, originalContent>.
 * Used by the Perfection Loop to restore files on self_correct→green.
 */
const snapshots = new Map<string, Map<string, string>>()

/**
 * Captures the original content of a file before modification.
 * Only captures if the file exists and hasn't been snapshotted yet for this run.
 */
export function captureSnapshot(runId: string, filePath: string): void {
  let runSnapshots = snapshots.get(runId)
  if (!runSnapshots) {
    runSnapshots = new Map()
    snapshots.set(runId, runSnapshots)
  }

  // Don't re-snapshot if already captured
  if (runSnapshots.has(filePath)) {
    return
  }

  // Only snapshot existing files
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    runSnapshots.set(filePath, content)
  } catch {
    // File doesn't exist yet (new file creation) — no snapshot needed
  }
}

/**
 * Restores all snapshotted files for a run to their original content.
 * Used on self_correct→green transition.
 */
export function restoreSnapshots(runId: string): string[] {
  const runSnapshots = snapshots.get(runId)
  if (!runSnapshots) {
    return []
  }

  const restored: string[] = []
  for (const [filePath, originalContent] of runSnapshots) {
    try {
      fs.writeFileSync(filePath, originalContent, 'utf8')
      restored.push(filePath)
    } catch {
      // Best effort — file may have been deleted
    }
  }

  return restored
}

/**
 * Clears all snapshots for a run.
 * Used on audit→complete transition.
 */
export function clearSnapshots(runId: string): void {
  snapshots.delete(runId)
}
