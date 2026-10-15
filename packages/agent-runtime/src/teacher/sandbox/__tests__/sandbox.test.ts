import fs from 'node:fs'
import os from 'node:os'

import { describe, expect, test } from 'bun:test'

import { SandboxCancelledError, subprocessSandboxBackend } from '../index'

import type { SandboxPolicy, SandboxResult } from '@savant-code/common/teacher'

const DEFAULT_POLICY: SandboxPolicy = {
  policyVersion: 'sandbox-test-v1',
  required: [
    'temp_workspace',
    'stripped_environment',
    'output_cap',
    'timeout',
    'deterministic_runtime',
    'cancellation',
    'cleanup',
  ],
  limits: { timeLimitMs: 200, maxOutputBytes: 1024 },
}

const KNOWN_GOOD = `
function solution(a, b) { return a + b }
`
const KNOWN_GOOD_TESTS = `
recordTest('adds positive', () => solution(1, 2) === 3)
recordTest('adds negative', () => solution(-1, -2) === -3)
`
const BROKEN = `
function solution(a, b) { return a * b }
`

function run(
  solutionSource: string,
  testsSource: string = KNOWN_GOOD_TESTS,
  policy: SandboxPolicy = DEFAULT_POLICY,
): Promise<SandboxResult> {
  return subprocessSandboxBackend.run({ solutionSource, testsSource, policy })
}

function tempSandboxDirs(): string[] {
  return fs
    .readdirSync(os.tmpdir())
    .filter((name) => name.startsWith('teacher-sandbox-'))
}

describe('subprocess sandbox backend', () => {
  test('known-good solution passes deterministically', async () => {
    const first = await run(KNOWN_GOOD)
    const second = await run(KNOWN_GOOD)

    expect(first.status).toBe('passed')
    expect(first.testSummary).toEqual({
      total: 2,
      passed: 2,
      failed: 0,
      failedNames: [],
    })
    expect(second.status).toBe('passed')
    expect(second.testSummary).toEqual(first.testSummary)
  })

  test('broken solution fails with the failing test named', async () => {
    const result = await run(BROKEN)

    expect(result.status).toBe('failed')
    expect(result.testSummary.failed).toBe(2)
    expect(result.testSummary.failedNames).toContain('adds positive')
  })

  test('infinite loop times out', async () => {
    const result = await run(`
function solution(a, b) {
  while (true) { /* spin */ }
  return a + b
}
`)

    expect(result.status).toBe('timed_out')
  })

  test('require access is contained', async () => {
    const result = await run(`
const fs = require('fs')
function solution(a, b) { return fs.readFileSync('/etc/passwd', 'utf8') }
`)

    expect(result.status).toBe('failed')
  })

  test('process/environment access is contained', async () => {
    const result = await run(`
function solution(a, b) { return process.env.HOME }
`)

    expect(result.status).toBe('failed')
  })

  test('network access is contained', async () => {
    const result = await run(`
function solution(a, b) { return fetch('http://example.com') }
`)

    expect(result.status).toBe('failed')
  })

  test('Function-constructor escape is contained', async () => {
    const result = await run(`
function solution(a, b) {
  const F = this.constructor.constructor
  return F('return process')()
}
`)

    expect(result.status).toBe('failed')
  })

  test('output flooding is capped without crashing', async () => {
    const result = await run(
      `
function solution(a, b) {
  for (let i = 0; i < 100000; i++) console.log('x'.repeat(1000))
  return a + b
}
`,
      `
recordTest('adds', () => solution(1, 2) === 3)
`,
    )

    expect(result.status).toBe('passed')
    expect(result.stdoutHash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  test('missing solution function fails closed', async () => {
    const result = await run('var notAFunction = 1\n')

    expect(result.status).toBe('failed')
  })

  test('policy requiring an unproven OS boundary is unavailable, no run', async () => {
    const result = await run(KNOWN_GOOD, KNOWN_GOOD_TESTS, {
      ...DEFAULT_POLICY,
      required: ['no_network'],
    })

    expect(result.status).toBe('unavailable')
    expect(result.testSummary.total).toBe(0)
    expect(result.durationMs).toBe(0)
    expect(result.stderrSummary).toContain('no_network')
  })

  test('cancellation aborts the child and throws', async () => {
    const controller = new AbortController()
    const pending = subprocessSandboxBackend.run({
      solutionSource: `
function solution(a, b) { while (true) { /* spin */ } }
`,
      testsSource: KNOWN_GOOD_TESTS,
      policy: DEFAULT_POLICY,
      signal: controller.signal,
    })

    setTimeout(() => controller.abort(), 50)
    await expect(pending).rejects.toBeInstanceOf(SandboxCancelledError)
  })

  test('temporary workspaces are cleaned up on every exit path', async () => {
    await run(KNOWN_GOOD)
    await run(BROKEN)
    await run(`
function solution(a, b) { while (true) {} }
`)

    expect(tempSandboxDirs()).toEqual([])
  })
})
