import * as fs from 'fs'
import { randomUUID } from 'node:crypto'

// Unique per-write temp suffix. A plain `${pid}.tmp` collides when a sync
// exit-flush and an async checkpoint write target the same file concurrently
// (both share the pid): they'd write and rename the SAME temp path, tearing
// each other's output. A random component makes every write self-contained.
function tempPathFor(filePath: string): string {
  return `${filePath}.${process.pid}.${randomUUID()}.tmp`
}

/**
 * Write a file atomically: write to a temp file in the same directory, then
 * rename over the target. Chat files grow to multiple MB and are rewritten on
 * every agent step, so a plain writeFileSync interrupted by a crash/kill
 * leaves truncated JSON that hides the chat from /history.
 */
export function writeFileAtomic(filePath: string, data: string): void {
  const tmpPath = tempPathFor(filePath)
  try {
    fs.writeFileSync(tmpPath, data)
    fs.renameSync(tmpPath, filePath)
  } catch (error) {
    try {
      fs.unlinkSync(tmpPath)
    } catch {
      // Ignore cleanup errors; the original error is what matters
    }
    throw error
  }
}

/**
 * Async counterpart to writeFileAtomic. Used by the in-flight checkpoint writer
 * so serializing + flushing a multi-MB transcript doesn't block the CLI's
 * render/input thread. Same tmp-then-rename atomicity guarantee.
 */
const asyncWriteQueues = new Map<string, Promise<void>>()

async function writeFileAtomicAsyncOnce(
  filePath: string,
  data: string,
): Promise<void> {
  const tmpPath = tempPathFor(filePath)
  try {
    await fs.promises.writeFile(tmpPath, data)
    await fs.promises.rename(tmpPath, filePath)
  } catch (error) {
    try {
      await fs.promises.unlink(tmpPath)
    } catch {
      // Ignore cleanup errors; the original error is what matters
    }
    throw error
  }
}

export function writeFileAtomicAsync(
  filePath: string,
  data: string,
): Promise<void> {
  // Windows can briefly hold the destination during rename. Serialize writes
  // targeting the same file while retaining parallelism across different files.
  const previous = asyncWriteQueues.get(filePath) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(() => writeFileAtomicAsyncOnce(filePath, data))
  asyncWriteQueues.set(filePath, next)
  void next.then(
    () => {
      if (asyncWriteQueues.get(filePath) === next) {
        asyncWriteQueues.delete(filePath)
      }
    },
    () => {
      if (asyncWriteQueues.get(filePath) === next) {
        asyncWriteQueues.delete(filePath)
      }
    },
  )
  return next
}
