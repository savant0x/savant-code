// FID-2026-0905-007 — public-release decomposition: command runner.
//
// The allowlisted spawn primitive with transcript capture, timeout handling
// (owned-tree termination on Windows), and the classification helpers.
// Verbatim moves from scripts/public-release.ts.

import { spawnSync } from 'child_process'
import { closeSync, mkdtempSync, openSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

import { fail } from './fail'
import { readCapturedOutput } from './output'
import { terminateOwnedProcessTree } from './process-tree'

import type { CommandFailureClass } from './catalog'

export type ProcessResult = {
  pid?: number
  status: number | null
  signal: NodeJS.Signals | null
  error?: Error & { code?: string }
  timedOut?: boolean
  cleanupFailure?: string
  stdout: string
  stderr: string
}

const COMMAND_TIMEOUT_MS = 30 * 60 * 1_000
const ALLOWED_RELEASE_COMMANDS = new Set([
  'bun',
  'bun.exe',
  'npm',
  'git',
  'gh',
  'powershell.exe',
  'taskkill',
])

export function validateReleaseCommand(command: string): void {
  const executable = path.basename(command).toLowerCase()
  if (!ALLOWED_RELEASE_COMMANDS.has(executable)) {
    throw new Error(`Release command is not allowlisted: ${command}`)
  }
}

export function run(
  command: string,
  args: string[],
  cwd: string,
  capture = false,
  extraEnv?: Record<string, string>,
  replaceEnv = false,
): ProcessResult {
  validateReleaseCommand(command)
  let temporaryDirectory: string | undefined
  let stdoutPath: string | undefined
  let stderrPath: string | undefined
  let stdoutFd: number | undefined
  let stderrFd: number | undefined
  try {
    let stdio: 'inherit' | ['ignore', number, number] = 'inherit'
    if (capture) {
      temporaryDirectory = mkdtempSync(
        path.join(os.tmpdir(), 'savant-release-run-'),
      )
      stdoutPath = path.join(temporaryDirectory, 'stdout.log')
      stderrPath = path.join(temporaryDirectory, 'stderr.log')
      stdoutFd = openSync(stdoutPath, 'w')
      stderrFd = openSync(stderrPath, 'w')
      stdio = ['ignore', stdoutFd, stderrFd]
    }
    const hasCustomEnv = Boolean(extraEnv)
    const result = spawnSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio,
      windowsHide: true,
      timeout: COMMAND_TIMEOUT_MS,
      killSignal: 'SIGTERM',
      // On Windows, Bun's spawnSync cannot resolve .cmd shims (bun.cmd,
      // npm.cmd) when env is an explicit object — even process.env.
      // When no extraEnv is set, omit env entirely to inherit the parent
      // environment at the OS level. When extraEnv is set (e.g. sanitized
      // gate env with secrets stripped), we must create a new env object;
      // on Windows, enable shell:true so cmd.exe can resolve .cmd shims.
      // The command allowlist (validateReleaseCommand) gates which commands
      // can reach this code path.
      shell: hasCustomEnv && process.platform === 'win32',
      env: extraEnv
        ? replaceEnv
          ? { ...extraEnv }
          : { ...process.env, ...extraEnv }
        : undefined,
    })
    if (stdoutFd !== undefined) closeSync(stdoutFd)
    if (stderrFd !== undefined) closeSync(stderrFd)
    stdoutFd = undefined
    stderrFd = undefined
    const resultError = result.error as (Error & { code?: string }) | undefined
    const timedOut = resultError?.code === 'ETIMEDOUT'
    const cleanupFailure = timedOut
      ? terminateOwnedProcessTree(result.pid)
      : undefined
    return {
      pid: result.pid,
      status: result.status,
      signal: result.signal,
      error: result.error,
      timedOut,
      cleanupFailure,
      stdout: readCapturedOutput(stdoutPath),
      stderr: readCapturedOutput(stderrPath),
    }
  } catch (error) {
    if (stdoutFd !== undefined) closeSync(stdoutFd)
    if (stderrFd !== undefined) closeSync(stderrFd)
    return {
      status: null,
      signal: null,
      error: error instanceof Error ? error : new Error(String(error)),
      timedOut:
        error instanceof Error && 'code' in error && error.code === 'ETIMEDOUT',
      stdout: '',
      stderr: '',
    }
  } finally {
    if (temporaryDirectory)
      rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

export function classifyCommandResult(result: {
  status: number | null
  signal?: NodeJS.Signals | null
  error?: Error & { code?: string }
  timedOut?: boolean
}): CommandFailureClass {
  if (result.timedOut || result.error?.code === 'ETIMEDOUT') return 'timeout'
  if (result.error) return 'spawn-error'
  if (result.status === 0) return 'success'
  if (result.signal) return 'signal'
  if (typeof result.status === 'number') return 'exit'
  return 'malformed'
}

export function requireCommand(
  command: string,
  mutationMode: boolean,
): string | undefined {
  const result = run(command, ['--version'], repositoryRoot(), true)
  if (result.status === 0) return undefined
  const message = `Required command unavailable: ${command}`
  if (mutationMode) fail(message)
  return message
}

export function runRequired(
  command: string,
  args: string[],
  cwd: string,
  extraEnv?: Record<string, string>,
): void {
  const result = run(command, args, cwd, false, extraEnv)
  if (classifyCommandResult(result) !== 'success') {
    const details = result.signal
      ? ` signal=${result.signal}`
      : result.error
        ? ` error=${result.error.name}`
        : ''
    fail(`Stage command failed: ${command} ${args.join(' ')}${details}`)
  }
}

function repositoryRoot(): string {
  // Moved one directory deeper by the FID-007 decomposition; see
  // local-state.ts repositoryRoot for the same fix rationale.
  return path.resolve(import.meta.dir, '..', '..')
}
