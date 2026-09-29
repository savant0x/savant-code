/**
 * Terminal Color Detection — OSC 10/11 escape-sequence query primitives.
 *
 * OSC 10: Query foreground (text) color
 * OSC 11: Query background color
 * (FID-2026-0809-016: extracted from `terminal-color-detection.ts`.)
 */

import { openSync, closeSync, writeSync, constants } from 'fs'

import { getCliEnv } from '../env'

import type { CliEnv } from '../../types/env'

// Timeout constants
export const OSC_QUERY_TIMEOUT_MS = 500 // Timeout for individual OSC query
export const GLOBAL_OSC_TIMEOUT_MS = 2000 // Global timeout for entire detection process

/**
 * Resolve-value timeout variant — deliberately distinct from the canonical
 * rejecting `withTimeout` in `common/util/promise` (FID-2026-0928-009): this
 * version RESOLVES to `timeoutValue` on timeout instead of rejecting, which
 * is the contract the OSC detection flow (theme fallback) is built on.
 * Different behavior, therefore a different name — not a duplicate body.
 */
export function withTimeoutValue<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutValue: T,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(timeoutValue)
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
}

/**
 * Check if the current terminal supports OSC color queries
 */
export function terminalSupportsOSC(env: CliEnv = getCliEnv()): boolean {
  const term = env.TERM || ''
  const termProgram = env.TERM_PROGRAM || ''

  // Known compatible terminals
  const supportedPrograms = [
    'iTerm.app',
    'Apple_Terminal',
    'WezTerm',
    'Alacritty',
    'kitty',
    'Ghostty',
    'vscode',
  ]

  if (supportedPrograms.some((p) => termProgram.includes(p))) {
    return true
  }

  const supportedTerms = [
    'xterm-256color',
    'xterm-kitty',
    'alacritty',
    'wezterm',
    'ghostty',
  ]

  if (supportedTerms.some((t) => term.includes(t))) {
    return true
  }

  // Check if we have a TTY
  return process.stdin.isTTY === true
}

/**
 * Build OSC query string
 * @param oscCode - The OSC code (10 for foreground, 11 for background)
 */
function buildOscQuery(oscCode: number): string {
  return `\x1b]${oscCode};?\x07`
}

/**
 * Query the terminal for OSC color information.
 *
 * IMPORTANT: This function reads from stdin because OSC responses come through
 * the PTY which appears on stdin. This means it MUST be run BEFORE any other
 * stdin listeners (like OpenTUI) are attached. OSC detection runs at the very
 * start of main() in index.tsx, before OpenTUI is initialized.
 *
 * @param ttyPath - Path to TTY for writing the query
 * @param query - The OSC query string to send
 * @returns The raw response string or null if query failed
 */
async function sendOscQuery(
  ttyPath: string,
  query: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    // Guard: Must have TTY for both reading and writing
    if (!process.stdin.isTTY) {
      resolve(null)
      return
    }

    let ttyWriteFd: number | null = null
    let timeoutId: NodeJS.Timeout | null = null
    let resolved = false
    let response = ''
    let wasRawMode = false
    let dataHandler: ((data: Buffer) => void) | null = null

    const cleanup = () => {
      if (resolved) return
      resolved = true

      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // Remove data handler from stdin
      if (dataHandler) {
        process.stdin.removeListener('data', dataHandler)
        dataHandler = null
      }

      // Restore raw mode state
      if (process.stdin.isTTY && process.stdin.setRawMode) {
        try {
          process.stdin.setRawMode(wasRawMode)
        } catch {
          // Ignore errors restoring raw mode
        }
      }

      // Pause stdin so we leave it non-flowing before other listeners attach
      try {
        process.stdin.pause()
      } catch {
        // Ignore pause errors
      }

      // Close TTY write fd
      if (ttyWriteFd !== null) {
        try {
          closeSync(ttyWriteFd)
        } catch {
          // Ignore close errors
        }
        ttyWriteFd = null
      }
    }

    const resolveWith = (value: string | null) => {
      if (resolved) return
      cleanup()
      resolve(value)
    }

    try {
      // Open TTY for writing the query
      try {
        ttyWriteFd = openSync(ttyPath, constants.O_WRONLY)
      } catch {
        resolveWith(null)
        return
      }

      // Save current raw mode state and enable raw mode to capture escape sequences.
      // Without raw mode, the terminal buffers input line-by-line and OSC responses
      // (which don't end with newlines) would never be delivered.
      wasRawMode = process.stdin.isRaw ?? false
      if (process.stdin.setRawMode) {
        try {
          process.stdin.setRawMode(true)
        } catch {
          // Continue anyway - some terminals might work without raw mode
        }
      }

      // Set up timeout
      timeoutId = setTimeout(() => {
        resolveWith(response.length > 0 ? response : null)
      }, OSC_QUERY_TIMEOUT_MS)

      // Set up event-based reading from stdin.
      // OSC responses come through the PTY which appears on stdin.
      dataHandler = (data: Buffer) => {
        if (resolved) return

        const chunk = data.toString('utf8')
        response += chunk

        // Check for complete response
        const hasBEL = response.includes('\x07')
        const hasST = response.includes('\x1b\\')
        const hasRGB =
          /rgb:[0-9a-fA-F]{2,4}\/[0-9a-fA-F]{2,4}\/[0-9a-fA-F]{2,4}/.test(
            response,
          )

        // A complete response has RGB data AND a terminator (BEL or ST)
        // Some terminals might send RGB without proper terminator, so we accept that too
        if (hasRGB && (hasBEL || hasST || response.length > 30)) {
          resolveWith(response)
        }
      }

      process.stdin.on('data', dataHandler)
      process.stdin.resume()

      // Write the OSC query to TTY
      try {
        writeSync(ttyWriteFd, query)
      } catch {
        resolveWith(null)
        return
      }
    } catch {
      resolveWith(null)
    }
  })
}

/**
 * Query terminal for OSC color
 */
export async function queryTerminalOSC(
  oscCode: number,
): Promise<string | null> {
  const ttyPath = process.platform === 'win32' ? 'CON' : '/dev/tty'
  const query = buildOscQuery(oscCode)
  return sendOscQuery(ttyPath, query)
}
