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
  runCommand(command: string, options?: Partial<CommandOptions>): Promise<CommandResult>
  /** Destroy the isolated environment. */
  teardown(): Promise<void>
}
