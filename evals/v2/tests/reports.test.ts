import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { rm, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { writeJsonReport, writeMarkdownReport } from '../src/reports'
import type { HarnessResult } from '../src/harness'
import type { TaskDefinition } from '../src/schema'

function makeTask(): TaskDefinition {
  return {
    schema_version: '2.0',
    task_id: 'report-test-001',
    category: 'pure_coding',
    difficulty: 'easy',
    environment: {
      setup_script: 'echo setup',
      network_disabled: true,
    },
    inputs: { prompt: 'fix it' },
    validation: {
      timeout_seconds: 60,
      deterministic_checks: [],
    },
  }
}

function makeResult(overrides: Partial<HarnessResult> = {}): HarnessResult {
  return {
    results: [
      {
        task_id: 'report-test-001',
        task: makeTask(),
        status: 'PASS',
        verification: {
          task_id: 'report-test-001',
          passed: true,
          status: 'PASS',
          checks: [],
          duration_ms: 123,
        },
      },
    ],
    total: 1,
    passed: 1,
    failed: 0,
    errors: 0,
    timeouts: 0,
    duration_ms: 456,
    ...overrides,
  } as any
}

describe('writeJsonReport', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = path.join(import.meta.dir, `.test-reports-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {})
  })

  it('writes a JSON report', async () => {
    const result = makeResult()
    const filePath = path.join(testDir, 'report.json')
    await writeJsonReport(result, filePath)

    const content = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed.total).toBe(1)
    expect(parsed.passed).toBe(1)
    expect(parsed.results[0].task_id).toBe('report-test-001')
  })

  it('round-trips the report data', async () => {
    const result = makeResult()
    const filePath = path.join(testDir, 'report.json')
    await writeJsonReport(result, filePath)

    const content = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content)
    expect(parsed).toEqual(result)
  })
})

describe('writeMarkdownReport', () => {
  let testDir: string

  beforeEach(async () => {
    testDir = path.join(import.meta.dir, `.test-reports-md-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {})
  })

  it('writes a markdown report with summary headers', async () => {
    const result = makeResult()
    const filePath = path.join(testDir, 'report.md')
    await writeMarkdownReport(result, filePath)

    const content = await readFile(filePath, 'utf-8')
    expect(content).toContain('# Savant-Code Benchmark v2 Results')
    expect(content).toContain('**Total:** 1')
    expect(content).toContain('**Passed:** 1')
    expect(content).toContain('report-test-001')
  })

  it('includes a failure section when tasks fail', async () => {
    const result = makeResult({
      passed: 0,
      failed: 1,
      results: [
        {
          task_id: 'report-test-001',
          task: makeTask(),
          status: 'FAIL',
          verification: {
            task_id: 'report-test-001',
            passed: false,
            status: 'FAIL',
            checks: [
              {
                command: 'echo ok',
                expected_exit_code: 0,
                attempts: 1,
                status: 'FAIL',
                result: { exitCode: 1, stdout: '', stderr: 'bad' },
                retries: 0,
                flaky: false,
              },
            ],
            duration_ms: 123,
          },
        },
      ],
    } as any)

    const filePath = path.join(testDir, 'report.md')
    await writeMarkdownReport(result, filePath)

    const content = await readFile(filePath, 'utf-8')
    expect(content).toContain('## Failures')
    expect(content).toContain('### report-test-001')
  })
})
