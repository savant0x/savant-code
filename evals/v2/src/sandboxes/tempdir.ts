import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { killProcessTree } from './process-tree'

import type { Sandbox, CommandOptions, CommandResult } from '../sandbox'

/**
 * FID-2026-0824-015: deny-by-default environment allowlist. Host secrets
 * never reach eval commands unless explicitly passed via overrides.
 */
const ENV_ALLOWLIST = [
  'PATH',
  'PATHEXT',
  'COMSPEC',
  'SystemRoot',
  'SYSTEMROOT',
  'SystemDrive',
  'SYSTEMDRIVE',
  'TEMP',
  'TMP',
  'APPDATA',
  'LOCALAPPDATA',
  'HOME',
] as const

export const DEFAULT_MAX_LOG_BYTES = 1_000_000

/**
 * Build an eval-command environment from an allowlist over `base` plus
 * explicit overrides (overrides always win). Pure + exported for tests.
 */
export function buildAllowlistedEnv(
  base: NodeJS.ProcessEnv,
  overrides?: Record<string, string>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const key of ENV_ALLOWLIST) {
    const value = base[key]
    if (value !== undefined) {
      env[key] = value
    }
  }
  return { ...env, ...(overrides ?? {}) }
}

/** Bound combined output, keeping head and tail around a truncation marker. */
function truncateBounded(
  stdout: string,
  stderr: string,
  maxBytes: number,
): string {
  const combined = `--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}\n`
  const totalBytes = Buffer.byteLength(combined, 'utf8')
  if (totalBytes <= maxBytes) {
    return combined
  }
  const half = Math.floor(maxBytes / 2)
  const head = combined.slice(0, half)
  const tail = combined.slice(-half)
  return `${head}\n…[truncated ${totalBytes - maxBytes} bytes]…\n${tail}`
}

export interface TempDirSandboxOptions {
  /** Optional prefix for the temp directory name. */
  prefix?: string
  /** If true, preserve the directory after teardown (useful for debugging). */
  preserve?: boolean
}

/**
 * Lightweight sandbox that creates a temporary directory on the local
 * filesystem. This is the default on Windows; on Linux/macOS/CI it can be
 * swapped for the Docker sandbox.
 */
export class TempDirSandbox implements Sandbox {
  public readonly id: string
  private workingDir: string = ''
  private readonly prefix: string
  private readonly preserve: boolean

  constructor(options: TempDirSandboxOptions = {}) {
    this.id = `tempdir-${crypto.randomUUID()}`
    this.prefix = options.prefix ?? 'savant-bench-'
    this.preserve = options.preserve ?? false
  }

  async prepare(): Promise<void> {
    this.workingDir = await mkdtemp(path.join(tmpdir(), this.prefix))
  }

  getWorkingDir(): string {
    if (!this.workingDir) {
      throw new Error('Sandbox has not been prepared. Call prepare() first.')
    }
    return this.workingDir
  }

  async runCommand(
    command: string,
    options: Partial<CommandOptions> = {},
  ): Promise<CommandResult> {
    const cwd = this.getWorkingDir()
    const resolvedCwd = options.cwd ? path.join(cwd, options.cwd) : cwd

    const logFile = options.logFile
      ? path.isAbsolute(options.logFile)
        ? options.logFile
        : path.join(resolvedCwd, options.logFile)
      : undefined
    if (logFile) {
      await mkdir(path.dirname(logFile), { recursive: true })
    }

    const child = spawn(command, [], {
      cwd: resolvedCwd,
      shell: options.shell ?? true,
      env: buildAllowlistedEnv(process.env, options.env),
      stdio: ['ignore', 'pipe', 'pipe'],
      // POSIX: own process group so the pgid kill reaches grandchildren.
      detached: process.platform !== 'win32',
      windowsHide: true,
    })

    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      let killed = false
      const timeout = options.timeout

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
      })
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      const timeoutId =
        timeout && timeout > 0
          ? setTimeout(() => {
              killed = true
              // FID-2026-0824-015: end the WHOLE tree via the capability-
              // probed mechanism (taskkill /T /F on Windows, process-group
              // SIGKILL on POSIX). The old child.kill() orphaned grandchildren.
              void killProcessTree(child.pid ?? -1).catch(() => {})
            }, timeout)
          : undefined

      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId)
        reject(error)
      })

      child.on('close', (exitCode) => {
        if (timeoutId) clearTimeout(timeoutId)

        // FID-2026-0824-015: flush the bounded log BEFORE resolving so a
        // caller that awaits runCommand sees the durable file immediately
        // (fire-and-forget raced existsSync in the gate test).
        const finalize = async () => {
          if (logFile) {
            try {
              const bounded = truncateBounded(
                stdout,
                stderr,
                options.maxLogBytes ?? DEFAULT_MAX_LOG_BYTES,
              )
              await writeFile(logFile, bounded, 'utf8')
            } catch {
              // Log capture is best-effort; never mask the command result.
            }
          }
          resolve({
            exitCode: exitCode ?? (killed ? 124 : 1),
            stdout,
            stderr,
            timedOut: killed,
          })
        }
        void finalize()
      })
    })
  }

  async teardown(): Promise<void> {
    if (!this.workingDir || this.preserve) {
      return
    }
    await rm(this.workingDir, { recursive: true, force: true })
    this.workingDir = ''
  }
}
