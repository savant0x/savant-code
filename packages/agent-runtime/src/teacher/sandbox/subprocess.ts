/**
 * Subprocess sandbox backend — FID-2026-0813-013.
 *
 * The narrowest supported backend for the target platform: a stripped
 * subprocess (`node:vm` restricted context) with an honest capability report.
 * A worker thread alone is never a security claim; OS-boundary dimensions that
 * language-level isolation cannot prove are reported `not_enforced`, and any
 * policy requiring them fails closed to `unavailable` with no execution.
 */
import { spawn, type ChildProcessByStdio } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { RESTRICTED_VM_CAPABILITIES, missingCapabilities } from './capabilities'

import type { SandboxBackend, SandboxRunInput } from './backend'
import type {
  SandboxResult,
  SandboxStatus,
  TestSummary,
} from '@savant-code/common/teacher'
import type { Readable } from 'node:stream'

export const RUNNER_VERSION = 'teacher-sandbox-v1'
const KILL_MARGIN_MS = 2_000
const MAX_STDERR_BYTES = 2_000
const MAX_CHILD_RESULT_BYTES = 64 * 1024

type ChildResult = {
  status: 'passed' | 'failed' | 'timed_out'
  testSummary: TestSummary
  error: string
  stdout: string
  outputOverflowed: boolean
}

/** Thrown when the caller's signal aborts a run; cleanup is already done. */
export class SandboxCancelledError extends Error {
  constructor() {
    super('sandbox run cancelled')
    this.name = 'SandboxCancelledError'
  }
}

function emptyTestSummary(): TestSummary {
  return { total: 0, passed: 0, failed: 0, failedNames: [] }
}

function sha256(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
}

function boundedStderr(text: string): string {
  return text.slice(0, MAX_STDERR_BYTES)
}

function runnerPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'runner.ts')
}

function readChildResult(workspace: string): ChildResult | null {
  const resultPath = path.join(workspace, 'result.json')
  try {
    const stat = fs.statSync(resultPath)
    if (!stat.isFile() || stat.size > MAX_CHILD_RESULT_BYTES) return null
    const raw = fs.readFileSync(resultPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<ChildResult>
    if (
      (parsed.status === 'passed' ||
        parsed.status === 'failed' ||
        parsed.status === 'timed_out') &&
      typeof parsed.testSummary === 'object' &&
      parsed.testSummary !== null &&
      typeof parsed.testSummary.total === 'number' &&
      typeof parsed.testSummary.passed === 'number' &&
      typeof parsed.testSummary.failed === 'number' &&
      Array.isArray(parsed.testSummary.failedNames) &&
      parsed.testSummary.failedNames.every(
        (name) => typeof name === 'string',
      ) &&
      typeof parsed.error === 'string' &&
      typeof parsed.stdout === 'string' &&
      typeof parsed.outputOverflowed === 'boolean'
    ) {
      return parsed as ChildResult
    }
    return null
  } catch {
    return null
  }
}

export class SubprocessSandboxBackend implements SandboxBackend {
  readonly runnerVersion = RUNNER_VERSION
  readonly capabilities = RESTRICTED_VM_CAPABILITIES

  async run(input: SandboxRunInput): Promise<SandboxResult> {
    const { solutionSource, testsSource, policy, signal } = input

    if (signal?.aborted) throw new SandboxCancelledError()

    // Policy gate: any required capability this backend cannot prove fails
    // closed to `unavailable` before any untrusted code is executed.
    const missing = missingCapabilities(policy, RESTRICTED_VM_CAPABILITIES)
    if (missing.length > 0) {
      return {
        status: 'unavailable',
        exitCode: null,
        testSummary: emptyTestSummary(),
        stdoutHash: sha256(''),
        stderrSummary: `missing capabilities: ${missing.join(', ')}`,
        durationMs: 0,
        policyVersion: policy.policyVersion,
        runnerVersion: RUNNER_VERSION,
        capabilities: RESTRICTED_VM_CAPABILITIES,
      }
    }

    const startedAt = Date.now()
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-sandbox-'))
    let stdout = ''
    let stderr = ''
    let exitCode: number | null = null
    let child: ChildProcessByStdio<null, Readable, Readable> | null = null
    let timedOut = false

    try {
      fs.writeFileSync(
        path.join(workspace, 'policy.json'),
        JSON.stringify({ limits: policy.limits }),
        'utf8',
      )
      fs.writeFileSync(
        path.join(workspace, 'solution.js'),
        solutionSource,
        'utf8',
      )
      fs.writeFileSync(path.join(workspace, 'tests.js'), testsSource, 'utf8')

      child = spawn(process.execPath, [runnerPath(), workspace], {
        cwd: workspace,
        env: {},
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      const kill = (): void => {
        if (child && child.exitCode === null && !child.killed) child.kill()
      }
      const onAbort = (): void => kill()
      signal?.addEventListener('abort', onAbort, { once: true })

      const exitPromise = new Promise<number | null>((resolve) => {
        child?.once('exit', (code) => resolve(code))
        child?.once('error', () => resolve(null))
      })

      const timeoutMs = policy.limits.timeLimitMs + KILL_MARGIN_MS
      let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        timedOut = true
        kill()
      }, timeoutMs)

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })

      exitCode = await exitPromise
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)

      if (signal?.aborted) throw new SandboxCancelledError()

      const childResult = readChildResult(workspace)
      const childStatus: SandboxStatus = timedOut
        ? 'timed_out'
        : childResult
          ? childResult.status
          : 'failed'
      const testSummary = childResult
        ? childResult.testSummary
        : emptyTestSummary()
      const capturedStdout = childResult ? childResult.stdout : stdout
      const errorText =
        childResult && childResult.error ? childResult.error : ''
      const stderrSummary = boundedStderr(
        [errorText, stderr].filter(Boolean).join('\n'),
      )

      return {
        status: childStatus,
        exitCode,
        testSummary,
        stdoutHash: sha256(capturedStdout),
        stderrSummary,
        durationMs: Date.now() - startedAt,
        policyVersion: policy.policyVersion,
        runnerVersion: RUNNER_VERSION,
        capabilities: RESTRICTED_VM_CAPABILITIES,
      }
    } finally {
      if (child && child.exitCode === null && !child.killed) child.kill()
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  }
}

export const subprocessSandboxBackend: SandboxBackend =
  new SubprocessSandboxBackend()
