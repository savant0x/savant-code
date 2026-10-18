/**
 * Exit provenance (FID-2026-1018-008).
 *
 * The observed failure ends with exit code 0, no signal, no stderr text and a
 * wiped screen, so the process either called `process.exit(0)` from somewhere
 * or its event loop drained and Bun exited on its own. Those two are
 * indistinguishable from the outside, and the difference decides whether the
 * fix belongs to a call site or to a lost handle.
 *
 * This module records the fact at the moment it happens: `process.exit` is
 * wrapped once so the first call site is captured, and the exit breadcrumb
 * reports `process.exit@<file:line>` when it exists or `drain` when it does
 * not. The wrapper is fail-open — a diagnostic failure must never change what
 * the program does.
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

import { getProjectRoot } from '../project-files'

let installed = false
let exitCaller: string | null = null

/** First stack frame outside this module, as `file:line`. */
function captureCaller(): string | null {
  const stack = new Error().stack
  if (!stack) return null
  for (const line of stack.split('\n')) {
    const match = /\(?([^()\s]+):(\d+):(\d+)\)?\s*$/.exec(line)
    if (!match) continue
    const file = match[1]!
    if (file.includes('exit-provenance')) continue
    const relative = path.isAbsolute(file)
      ? path.relative(process.cwd(), file)
      : file
    return `${relative}:${match[2]}`
  }
  return null
}

/**
 * Append one durable breadcrumb line. Synchronous and fail-open on purpose:
 * it must survive a process death that runs no other handler, and a
 * diagnostics failure must never change behaviour.
 */
export function writeProcessBreadcrumb(
  event: string,
  fields: Record<string, unknown> = {},
  debugDir: string = path.join(getProjectRoot(), 'debug'),
): void {
  try {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ...fields,
    })
    mkdirSync(debugDir, { recursive: true })
    appendFileSync(path.join(debugDir, 'cli.exit.log'), `${line}\n`)
  } catch {
    // Diagnostics only.
  }
}

/** `process.exit@file:line` when an explicit exit happened, else `drain`. */
export function getExitReason(): string {
  return exitCaller ? `process.exit@${exitCaller}` : 'drain'
}

/** Install the wrapper once, at startup, before any exit path can run. */
export function installExitProvenance(): void {
  if (installed) return
  installed = true

  const originalExit: typeof process.exit = process.exit
  process.exit = ((code?: number) => {
    // Keep the FIRST call site: later calls are usually cleanup cascades.
    exitCaller ??= captureCaller()
    originalExit(code)
  }) as typeof process.exit
}

/** Test isolation — the wrapper and this flag live for the process lifetime. */
export function resetExitProvenanceState(): void {
  installed = false
  exitCaller = null
}
