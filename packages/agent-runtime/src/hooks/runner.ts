import { spawn, spawnSync } from 'node:child_process'

import type { HookInputData, HookRunResult } from './types'
import type { HookConfig } from '@savant-code/common/types/hooks'

/**
 * FID-2026-0814-003 — bounded external-command runner for lifecycle hooks.
 *
 * Contract (fail-open by default — a hook can never brick a session):
 *   - spawn failure (missing binary, bad args)  → allow
 *   - timeout (default 30 s)                    → kill + allow
 *   - malformed output                          → allow
 *   - exit code 2                               → block
 *   - stdout/stderr contains `permissionDecision: "deny"` → block
 *   - anything else                             → allow
 *
 * The hook receives its payload as JSON on stdin. Output capture is bounded so
 * a chatty hook cannot balloon memory.
 */

export const HOOK_DEFAULT_TIMEOUT_MS = 30_000
export const HOOK_MAX_OUTPUT_CHARS = 10_000
/** Grace period between the graceful kill and the forced tree kill. */
const KILL_GRACE_MS = 100

/**
 * Tokenize a command string into argv (respecting single/double quotes,
 * no shell interpolation — the command is executed directly).
 */
export function tokenizeCommand(command: string): string[] {
  const tokens: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(command)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3])
  }
  return tokens
}

/**
 * Run one hook command. Never rejects — every failure path resolves to an
 * allow (fail-open), and the only block paths are exit code 2 and the JSON
 * deny decision.
 */
export function runHookCommand(
  config: HookConfig,
  input: HookInputData,
): Promise<HookRunResult> {
  return new Promise((resolve) => {
    const argv = tokenizeCommand(config.command)
    if (argv.length === 0) {
      resolve({ outcome: 'allowed', spawnError: 'empty command' })
      return
    }

    const timeoutMs =
      config.timeout !== undefined && config.timeout > 0
        ? config.timeout * 1000
        : HOOK_DEFAULT_TIMEOUT_MS

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(argv[0], argv.slice(1), {
        cwd: config.cwd ?? input.cwd,
        env: config.env ? { ...process.env, ...config.env } : process.env,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error) {
      // Fail-open: a hook that cannot even spawn must not block execution.
      resolve({ outcome: 'allowed', spawnError: String(error) })
      return
    }

    let settled = false
    let timedOut = false
    let output = ''

    const appendOutput = (chunk: Buffer | string): void => {
      if (output.length >= HOOK_MAX_OUTPUT_CHARS) return
      output += chunk.toString()
      if (output.length > HOOK_MAX_OUTPUT_CHARS) {
        output = output.slice(0, HOOK_MAX_OUTPUT_CHARS)
      }
    }

    const settle = (result: HookRunResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const timer = setTimeout(() => {
      timedOut = true
      killHookProcess(child, true)
    }, timeoutMs)
    timer.unref?.()

    child.stdout?.on('data', appendOutput)
    child.stderr?.on('data', appendOutput)

    child.on('error', (error) => {
      // Fail-open: ENOENT / EACCES etc. must never block the tool.
      settle({ outcome: 'allowed', spawnError: error.message })
    })

    child.on('close', (code) => {
      if (timedOut) {
        settle({ outcome: 'allowed', timedOut: true })
        return
      }
      settle(interpretHookExit(code, output))
    })

    try {
      child.stdin?.write(JSON.stringify(input, null, 2))
      child.stdin?.end()
    } catch {
      // The hook exited before reading stdin — treat as a normal close.
    }
  })
}

/** Interpret the hook's exit code + captured output per the block protocol. */
export function interpretHookExit(
  code: number | null,
  output: string,
): HookRunResult {
  // Exit code 2 is the documented hard-block signal.
  if (code === 2) {
    return {
      outcome: 'blocked',
      reason: 'hook exited with code 2 (block protocol)',
    }
  }
  const deny = parseDenyDecision(output)
  if (deny) {
    return {
      outcome: 'blocked',
      reason: deny.reason ?? 'hook denied the action',
    }
  }
  return { outcome: 'allowed' }
}

/**
 * Extract a deny decision from hook output. Tolerates surrounding text and
 * both top-level and `hookSpecificOutput`-nested JSON shapes.
 */
export function parseDenyDecision(output: string): {
  decision: 'deny'
  reason?: string
} | null {
  const decisionMatch = output.match(/"permissionDecision"\s*:\s*"deny"/)
  if (!decisionMatch) return null
  const reasonMatch = output.match(/"permissionDecisionReason"\s*:\s*"([^"]*)"/)
  return {
    decision: 'deny',
    ...(reasonMatch ? { reason: reasonMatch[1] } : {}),
  }
}

/**
 * Kill a hook process with grace: SIGTERM first, then after KILL_GRACE_MS a
 * forced SIGKILL; on Windows additionally taskkill the whole process tree
 * (`taskkill /T /F`), mirroring kimi's `killProcessTreeWindows`.
 */
export function killHookProcess(
  child: ReturnType<typeof spawn>,
  forced = false,
): void {
  const pid = child.pid
  try {
    child.kill()
  } catch {
    // Already dead.
  }
  if (!pid) return
  if (forced) {
    const forceTimer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        // Already dead.
      }
      if (process.platform === 'win32') {
        try {
          spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
            windowsHide: true,
          })
        } catch {
          // Best-effort tree kill.
        }
      }
    }, KILL_GRACE_MS)
    forceTimer.unref?.()
  } else if (process.platform === 'win32') {
    // Graceful kill on Windows does not traverse the tree; terminate it.
    try {
      child.kill()
    } catch {
      // Already dead.
    }
  }
}
