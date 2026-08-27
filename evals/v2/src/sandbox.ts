/**
 * Sandbox abstraction for the Savant-Code benchmark v2.
 *
 * A sandbox provides an isolated working directory and a way to run shell
 * commands inside it. The harness uses this to prepare task repositories,
 * execute agent runs, and run deterministic verification checks.
 */

export interface CommandOptions {
  /** Timeout in milliseconds. */
  timeout?: number
  /** Extra environment variables merged over the sandbox defaults. */
  env?: Record<string, string>
  /** Current working directory inside the sandbox (relative or absolute). */
  cwd?: string
  /** If true, run the command through the system shell. */
  shell?: boolean
  /**
   * FID-2026-0824-015: optional durable log file. Combined stdout+stderr is
   * written here (bounded to maxLogBytes) once the command settles, so
   * assertions can read full output even where in-memory capture truncates.
   */
  logFile?: string
  /** Upper bound for the log file in bytes (default 1_000_000). */
  maxLogBytes?: number
}

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
  /** True if the command was killed because it exceeded its timeout. */
  timedOut?: boolean
}

export interface Sandbox {
  /** Stable identifier for this sandbox instance. */
  id: string
  /** Create the isolated environment. */
  prepare(): Promise<void>
  /** Absolute path to the sandbox working directory. */
  getWorkingDir(): string
  /** Run a command inside the sandbox and return its result. */
  runCommand(
    command: string,
    options?: Partial<CommandOptions>,
  ): Promise<CommandResult>
  /** Destroy the isolated environment. */
  teardown(): Promise<void>
}
