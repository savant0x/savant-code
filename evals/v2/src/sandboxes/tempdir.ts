import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import type { Sandbox, CommandOptions, CommandResult } from '../sandbox'

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

    const isWindows = process.platform === 'win32'
    const child = spawn(command, [], {
      cwd: resolvedCwd,
      shell: options.shell ?? true,
      env: this.buildEnv(options.env),
      stdio: ['ignore', 'pipe', 'pipe'],
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
          ?          setTimeout(() => {
              killed = true
              // Best-effort termination. On Windows this only kills the shell
              // process; a future Docker/Firecracker sandbox should be used for
              // stronger isolation.
              try {
                child.kill()
              } catch {
                // Process may have already exited naturally.
              }
            }, timeout)
          : undefined

      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId)
        reject(error)
      })

      child.on('close', (exitCode) => {
        if (timeoutId) clearTimeout(timeoutId)
        resolve({
          exitCode: exitCode ?? (killed ? 124 : 1),
          stdout,
          stderr,
          timedOut: killed,
        })
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

  private buildEnv(overrides: Record<string, string> | undefined): NodeJS.ProcessEnv {
    // MVP: inherit the host environment. This leaks host env variables, but it
    // keeps temp-dir sandbox simple. Use Docker/Firecracker for real isolation.
    return {
      ...process.env,
      ...(overrides ?? {}),
    }
  }
}
