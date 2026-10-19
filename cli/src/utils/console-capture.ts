/**
 * Console capture (FID-2026-1018-008).
 *
 * OpenTUI installs its own console: everything written with `console.error`
 * after the renderer starts is captured into an overlay the app never opens,
 * so it reaches neither stderr nor `debug/cli.jsonl`. That is how a React
 * commit failure can blank the whole screen and leave no trace — the tree is
 * unmounted, the loop keeps ticking, and the only record of why was written
 * into a buffer nobody reads.
 *
 * This module forwards `console.error` and `console.warn` to the durable
 * logger before the original implementation still runs, so the message exists
 * twice: once wherever the console went, and once on disk. Fail-open and
 * idempotent — a logging failure must never change what the program does.
 */
/* eslint-disable no-console -- this module's whole job is to intercept console */
import { logger } from './logger'

export interface ConsoleCaptureHandlers {
  error: (message: string) => void
  warn: (message: string) => void
  /** Original console methods, kept for diagnostics and tests. */
  passthrough?: boolean
}

let installed = false

/** Render console arguments to one string without throwing on cycles. */
export function formatConsoleArguments(args: readonly unknown[]): string {
  const parts: string[] = []
  for (const arg of args) {
    if (typeof arg === 'string') {
      parts.push(arg)
      continue
    }
    if (arg instanceof Error) {
      parts.push(arg.stack ?? `${arg.name}: ${arg.message}`)
      continue
    }
    if (typeof arg === 'object' && arg !== null) {
      try {
        parts.push(JSON.stringify(arg))
      } catch {
        parts.push(String(arg))
      }
      continue
    }
    parts.push(String(arg))
  }
  return parts.join(' ').slice(0, 8_000)
}

/**
 * Install the forwarding once per process. Returns a disposer that restores
 * the original methods (used by tests; production never disposes).
 */
export function installConsoleCapture(
  handlers?: ConsoleCaptureHandlers,
): () => void {
  if (installed) return () => {}
  installed = true

  const originalError = console.error
  const originalWarn = console.warn
  const passthrough = handlers?.passthrough ?? true

  console.error = (...args: unknown[]) => {
    try {
      if (handlers) handlers.error(formatConsoleArguments(args))
      else logger.error({ source: 'console' }, formatConsoleArguments(args))
    } catch {
      // Diagnostics only.
    }
    if (passthrough) originalError(...args)
  }

  console.warn = (...args: unknown[]) => {
    try {
      if (handlers) handlers.warn(formatConsoleArguments(args))
      else logger.warn({ source: 'console' }, formatConsoleArguments(args))
    } catch {
      // Diagnostics only.
    }
    if (passthrough) originalWarn(...args)
  }

  return () => {
    console.error = originalError
    console.warn = originalWarn
    installed = false
  }
}

/** Test isolation: the console patch lives for the process lifetime. */
export function resetConsoleCaptureState(): void {
  installed = false
}
