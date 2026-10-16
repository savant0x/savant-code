import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'fs'
import path, { dirname } from 'path'

import { pino } from 'pino'

import { getProjectRoot } from '../../project-files'

/** Name of the per-chat debug log file written in production builds */
export const CHAT_LOG_FILENAME = 'log.jsonl'

/**
 * One cap for every diagnostic log file the CLI writes (FID-2026-1016-011).
 * Older CLI versions logged the full conversation per step, leaving multi-GB
 * files; with summary-only logging healthy logs stay far below this.
 */
export const MAX_LOG_FILE_BYTES = 10 * 1024 * 1024

/**
 * Only reclaim log files untouched for this long, so debug logs for recent
 * work stay available.
 */
export const MIN_LOG_AGE_MS = 14 * 24 * 60 * 60 * 1000

/** Single rotation generation: a bounded file pair is capped at 2× the cap. */
const ROTATION_SUFFIX = '.1'

/**
 * Size check cadence for {@link rotateIfOversized}: size is re-stat'ed only
 * after this much new growth, so the write path never pays a stat per line.
 * It is also the maximum overshoot past the cap, so a bounded file pair is at
 * most `2 × MAX_LOG_FILE_BYTES + LOG_CHECK_INTERVAL_BYTES`.
 */
export const LOG_CHECK_INTERVAL_BYTES = 1024 * 1024

/** Next file size at which `rotateIfOversized` should look again, per path. */
const nextCheckBytes = new Map<string, number>()

let logPath: string | undefined = undefined
let pinoLogger: pino.Logger | undefined = undefined

export function setLogPath(nextLogPath: string): void {
  if (nextLogPath === logPath) return

  logPath = nextLogPath
  mkdirSync(dirname(nextLogPath), { recursive: true })

  const fileStream = pino.destination({
    dest: nextLogPath,
    mkdir: true,
    sync: true,
  })

  pinoLogger = pino(
    {
      level: 'debug',
      formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    },
    fileStream,
  )
}

export function getLogPath(): string | undefined {
  return logPath
}

export function getPinoLogger(): pino.Logger | undefined {
  return pinoLogger
}

/**
 * The dev-mode diagnostic files under `<projectRoot>/debug/`. In dev the CLI
 * logs to `cli.jsonl` (logger sink) and appends agent traces to `trace.jsonl`
 * (trace writer); both sit beside each other so one directory holds the
 * session's diagnostics.
 */
export function debugLogPaths(projectRoot: string): {
  cliLog: string
  traceLog: string
} {
  const debugDir = path.join(projectRoot, 'debug')
  return {
    cliLog: path.join(debugDir, 'cli.jsonl'),
    traceLog: path.join(debugDir, 'trace.jsonl'),
  }
}

/** Rotate `target` to `<target>.1`, replacing any previous generation. */
function rotate(target: string): void {
  const previous = `${target}${ROTATION_SUFFIX}`
  try {
    if (existsSync(previous)) unlinkSync(previous)
    renameSync(target, previous)
  } catch {
    // A rotation failure must never break a run; the file simply keeps growing.
  }
  nextCheckBytes.set(target, 0)
}

/**
 * Rotate `filePath` once it reaches {@link MAX_LOG_FILE_BYTES}, keeping one
 * `.1` generation (so a bounded pair is at most 2× the cap) — a diagnostic
 * file must not grow without limit while the process that writes it runs.
 *
 * The size check is throttled to one `stat` per {@link LOG_CHECK_INTERVAL_BYTES}
 * of growth, which bounds both the overhead and the overshoot. Diagnostic failures
 * are swallowed by design: logging must never break a user run
 * (`FID-2026-1016-011`).
 */
export function rotateIfOversized(filePath: string): void {
  try {
    const stats = statSync(filePath, { throwIfNoEntry: false })
    if (!stats) return
    if (stats.size < (nextCheckBytes.get(filePath) ?? 0)) return
    nextCheckBytes.set(filePath, stats.size + LOG_CHECK_INTERVAL_BYTES)
    if (stats.size < MAX_LOG_FILE_BYTES) return
    rotate(filePath)
  } catch {
    // Ignore: an unreadable or locked file keeps appending unbounded rather
    // than failing the caller.
  }
}

function removeIfOversizedAndIdle(target: string, deleteBefore: number): void {
  try {
    const stats = statSync(target, { throwIfNoEntry: false })
    if (
      stats &&
      stats.size > MAX_LOG_FILE_BYTES &&
      stats.mtimeMs < deleteBefore
    ) {
      unlinkSync(target)
      nextCheckBytes.delete(target)
    }
  } catch {
    // Ignore errors for individual files
  }
}

/**
 * Reclaim the dev diagnostic files when they are oversized AND idle — the
 * sibling of `trimOversizedChatLogs`, which covers the production per-chat
 * `log.jsonl` but never reached `debug/*.jsonl` (FID-2026-1016-011 step 2).
 *
 * Both generations are considered, and the same age gate applies: a file being
 * written right now is never deleted, which is safe because
 * {@link rotateIfOversized} bounds live files at 2× the cap anyway.
 */
export function trimOversizedDebugLogs(): void {
  let projectRoot: string
  try {
    projectRoot = getProjectRoot()
  } catch {
    return // No project root set yet
  }

  const deleteBefore = Date.now() - MIN_LOG_AGE_MS
  const { cliLog, traceLog } = debugLogPaths(projectRoot)
  for (const target of [cliLog, traceLog]) {
    removeIfOversizedAndIdle(target, deleteBefore)
    removeIfOversizedAndIdle(`${target}${ROTATION_SUFFIX}`, deleteBefore)
  }
}

export function clearLogFile(): void {
  const projectRoot = getProjectRoot()
  const debugDir = path.join(projectRoot, 'debug')
  const targets = new Set<string>()

  if (logPath) {
    targets.add(logPath)
  }
  for (const target of [debugDir + '/cli.jsonl', debugDir + '/trace.jsonl']) {
    targets.add(target)
    targets.add(`${target}${ROTATION_SUFFIX}`)
  }

  for (const target of targets) {
    try {
      if (existsSync(target)) {
        unlinkSync(target)
        nextCheckBytes.delete(target)
      }
    } catch {
      // Ignore errors when clearing logs
    }
  }

  logPath = undefined
  pinoLogger = undefined
}

/**
 * Test isolation: drops the cached debug-log path and its pino logger —
 * process-lifetime state `bun test` shares across files (FID-2026-1007-002).
 * `clearLogFile()` clears the same two bindings but also deletes log files;
 * this seam touches no filesystem state.
 */
export function resetFileSinkState(): void {
  logPath = undefined
  pinoLogger = undefined
  nextCheckBytes.clear()
}

/**
 * Append a diagnostic line through the bounded writer. Kept here so the dev log
 * sink and the trace writer share ONE size policy rather than each
 * re-implementing it (FID-2026-1016-011).
 *
 * Creates the parent directory, so this is self-sufficient: the previous dev
 * path only worked because `setLogPath()` happened to `mkdir` first.
 */
export function appendBoundedSync(filePath: string, text: string): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true })
  } catch {
    // Ignore: appendFileSync will surface a genuinely unwritable path.
  }
  rotateIfOversized(filePath)
  appendFileSync(filePath, text)
}
