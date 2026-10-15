import * as fs from 'fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

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
export type AtomicWriteOptions = {
  onDurabilityUnverified?: () => void
}

export type AtomicWriteResult = {
  durability: 'verified' | 'unverified'
}

function createDurabilityTracker(onDurabilityUnverified?: () => void): {
  markUnverified: () => void
  result: () => AtomicWriteResult
} {
  let unverified = false
  return {
    markUnverified: () => {
      if (unverified) return
      unverified = true
      try {
        onDurabilityUnverified?.()
      } catch {
        // Durability telemetry must never turn a committed write into a
        // reported write failure.
      }
    },
    result: () => ({ durability: unverified ? 'unverified' : 'verified' }),
  }
}

function isUnsupportedDurabilityError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  return (
    code === 'EPERM' ||
    code === 'ENOTSUP' ||
    code === 'EOPNOTSUPP' ||
    code === 'EINVAL' ||
    code === 'EISDIR'
  )
}

function flushFile(
  filePath: string,
  onDurabilityUnverified?: () => void,
): void {
  const descriptor = fs.openSync(filePath, 'r')
  try {
    try {
      fs.fsyncSync(descriptor)
    } catch (error) {
      // Bun/Windows filesystems can reject fsync even though same-directory
      // rename remains atomic. Preserve the write and classify durability as
      // unverified; propagate all other I/O failures.
      if (!isUnsupportedDurabilityError(error)) throw error
      try {
        onDurabilityUnverified?.()
      } catch {
        // Durability telemetry must never turn a committed write into a
        // reported write failure.
      }
    }
  } finally {
    fs.closeSync(descriptor)
  }
}

function flushDirectory(
  directory: string,
  onDurabilityUnverified?: () => void,
): void {
  // Directory fsync is supported on POSIX filesystems. Windows may reject
  // opening a directory; the rename is still atomic there, so treat that
  // platform-specific durability step as best effort.
  try {
    const descriptor = fs.openSync(directory, 'r')
    try {
      fs.fsyncSync(descriptor)
    } finally {
      fs.closeSync(descriptor)
    }
  } catch (error) {
    if (!isUnsupportedDurabilityError(error)) throw error
    // The file's contents were flushed; directory-handle durability is not
    // available on every supported platform/filesystem.
    try {
      onDurabilityUnverified?.()
    } catch {
      // Durability telemetry is non-fatal.
    }
  }
}

export function writeFileAtomic(
  filePath: string,
  data: string,
  options: AtomicWriteOptions = {},
): AtomicWriteResult {
  const tmpPath = tempPathFor(filePath)
  const durability = createDurabilityTracker(options.onDurabilityUnverified)
  try {
    fs.writeFileSync(tmpPath, data)
    flushFile(tmpPath, durability.markUnverified)
    fs.renameSync(tmpPath, filePath)
    flushDirectory(path.dirname(filePath), durability.markUnverified)
  } catch (error) {
    try {
      fs.unlinkSync(tmpPath)
    } catch {
      // Ignore cleanup errors; the original error is what matters
    }
    throw error
  }
  return durability.result()
}

/**
 * Async counterpart to writeFileAtomic. Used by the in-flight checkpoint writer
 * so serializing + flushing a multi-MB transcript doesn't block the CLI's
 * render/input thread. Same tmp-then-rename atomicity guarantee.
 */
const asyncWriteQueues = new Map<string, Promise<AtomicWriteResult>>()

/**
 * Test isolation: clears the per-path async write lanes — process-lifetime
 * state `bun test` shares across files (FID-2026-1007-002).
 */
export function resetAsyncWriteQueues(): void {
  asyncWriteQueues.clear()
}

async function renameAsyncWithWindowsReplacement(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  try {
    await fs.promises.rename(sourcePath, targetPath)
    return
  } catch (error) {
    const code =
      error && typeof error === 'object'
        ? (error as { code?: unknown }).code
        : undefined
    if (!['EPERM', 'EACCES', 'EEXIST'].includes(String(code))) throw error
  }
  if (fs.existsSync(targetPath)) {
    const targetStat = await fs.promises.lstat(targetPath)
    if (targetStat.isDirectory())
      throw new Error('Cannot atomically replace a directory')
  }

  const backupPath = `${targetPath}.${process.pid}.${randomUUID()}.old`
  let backedUp = false
  try {
    try {
      await fs.promises.rename(targetPath, backupPath)
      backedUp = true
    } catch (error) {
      const code =
        error && typeof error === 'object'
          ? (error as { code?: unknown }).code
          : undefined
      if (code !== 'ENOENT') throw error
    }
    await fs.promises.rename(sourcePath, targetPath)
    if (backedUp) {
      try {
        await fs.promises.rm(backupPath, { force: true })
      } catch {
        // The new target is committed; a stale backup is safer than reporting
        // a failed write after commit.
      }
    }
  } catch (error) {
    if (backedUp) {
      try {
        await fs.promises.rm(targetPath, { force: true })
      } catch {
        // Preserve the original failure; the backup remains repairable.
      }
      try {
        await fs.promises.rename(backupPath, targetPath)
      } catch {
        // Preserve the original failure; the backup remains repairable.
      }
    }
    throw error
  }
}

async function writeFileAtomicAsyncOnce(
  filePath: string,
  data: string,
  options: AtomicWriteOptions = {},
): Promise<AtomicWriteResult> {
  const durability = createDurabilityTracker(options.onDurabilityUnverified)
  const tmpPath = tempPathFor(filePath)
  try {
    await fs.promises.writeFile(tmpPath, data)
    let fileHandle: fs.promises.FileHandle | undefined
    try {
      fileHandle = await fs.promises.open(tmpPath, 'r')
      await fileHandle.sync()
    } catch (error) {
      if (!isUnsupportedDurabilityError(error)) throw error
      durability.markUnverified()
    } finally {
      await fileHandle?.close()
    }
    await renameAsyncWithWindowsReplacement(tmpPath, filePath)
    // Async directory durability is intentionally not claimed by this API;
    // callers receive an explicit unverified result after the atomic rename.
    durability.markUnverified()
  } catch (error) {
    try {
      await fs.promises.unlink(tmpPath)
    } catch {
      // Ignore cleanup errors; the original error is what matters
    }
    throw error
  }
  return durability.result()
}

export function writeFileAtomicAsync(
  filePath: string,
  data: string,
  options: AtomicWriteOptions = {},
): Promise<AtomicWriteResult> {
  // Windows can briefly hold the destination during rename. Serialize writes
  // targeting the same file while retaining parallelism across different files.
  const previous = asyncWriteQueues.get(filePath) ?? Promise.resolve()
  const next = previous
    .catch(() => undefined)
    .then(() => writeFileAtomicAsyncOnce(filePath, data, options))
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
