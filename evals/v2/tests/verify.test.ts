import { describe, it, expect, beforeEach } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DeterministicVerifier } from '../src/verify'
import { TempDirSandbox } from '../src/sandboxes/tempdir'
import type { Sandbox, CommandResult } from '../src/sandbox'
import type { TaskDefinition } from '../src/schema'

function makeTask(overrides: Partial<TaskDefinition> = {}): TaskDefinition {
  return {
    schema_version: '2.0',
    task_id: 'verify-test-001',
    category: 'pure_coding',
    difficulty: 'easy',
    environment: {
      setup_script: 'echo setup',
      network_disabled: true,
    },
    inputs: { prompt: 'fix it' },
    validation: {
      timeout_seconds: 60,
      deterministic_checks: [
        {
          command: 'echo ok',
          expected_exit_code: 0,
          retry_count: 0,
          retry_condition: 'infra',
        },
      ],
    },
    ...overrides,
  }
}

class MockSandbox implements Sandbox {
  public id = 'mock'
  public calls: { command: string; options?: unknown }[] = []
  private responses: CommandResult[] = []

  setResponses(responses: CommandResult[]) {
    this.responses = responses
  }

  async prepare(): Promise<void> {}
  getWorkingDir(): string {
    return '/tmp/mock'
  }
  async runCommand(command: string, options?: unknown): Promise<CommandResult> {
    this.calls.push({ command, options })
    if (this.responses.length === 0) {
      throw new Error('No mock response configured')
    }
    return this.responses.shift()!
  }
  async teardown(): Promise<void> {}
}

describe('DeterministicVerifier', () => {
  let sandbox: MockSandbox
  let verifier: DeterministicVerifier

  beforeEach(() => {
    sandbox = new MockSandbox()
    verifier = new DeterministicVerifier(sandbox)
  })

  it('passes when all checks pass', async () => {
    sandbox.setResponses([{ exitCode: 0, stdout: 'ok', stderr: '' }])
    const task = makeTask()
    const result = await verifier.verify(task)
    expect(result.passed).toBe(true)
    expect(result.status).toBe('PASS')
    expect(result.checks[0].status).toBe('PASS')
    expect(result.checks[0].retries).toBe(0)
  })

  it('fails when a check fails', async () => {
    sandbox.setResponses([{ exitCode: 1, stdout: '', stderr: 'bad' }])
    const task = makeTask()
    const result = await verifier.verify(task)
    expect(result.passed).toBe(false)
    expect(result.status).toBe('FAIL')
    expect(result.checks[0].status).toBe('FAIL')
  })

  it('retries and marks flaky passes', async () => {
    sandbox.setResponses([
      { exitCode: 1, stdout: '', stderr: 'timeout' },
      { exitCode: 0, stdout: 'ok', stderr: '' },
    ])
    const task = makeTask({
      validation: {
        timeout_seconds: 60,
        deterministic_checks: [
          {
            command: 'echo ok',
            expected_exit_code: 0,
            retry_count: 2,
            retry_condition: 'always',
          },
        ],
      },
    })
    const result = await verifier.verify(task)
    expect(result.passed).toBe(true)
    expect(result.status).toBe('FLAKY')
    expect(result.checks[0].status).toBe('FLAKY_PASS')
    expect(result.checks[0].retries).toBe(1)
    expect(sandbox.calls.length).toBe(2)
  })

  it('does not retry non-infra failures when retry_condition is infra', async () => {
    sandbox.setResponses([{ exitCode: 1, stdout: '', stderr: 'syntax error' }])
    const task = makeTask({
      validation: {
        timeout_seconds: 60,
        deterministic_checks: [
          {
            command: 'echo ok',
            expected_exit_code: 0,
            retry_count: 2,
            retry_condition: 'infra',
          },
        ],
      },
    })
    const result = await verifier.verify(task)
    expect(result.passed).toBe(false)
    expect(result.checks[0].status).toBe('FAIL')
    expect(sandbox.calls.length).toBe(1)
  })

  it('applies the golden patch before checks when requested', async () => {
    const sandbox = new TempDirSandbox({ prefix: 'verify-golden-' })
    await sandbox.prepare()

    try {
      const workingDir = sandbox.getWorkingDir()
      const patchPath = path.join(workingDir, 'golden.patch')
      const filePath = path.join(workingDir, 'data.txt')

      await writeFile(filePath, 'old\n', 'utf-8')
      await writeFile(
        patchPath,
        `--- data.txt
+++ data.txt
@@ -1 +1 @@
-old
+new
`,
        'utf-8',
      )

      const task = makeTask({
        golden_patch: patchPath,
        validation: {
          timeout_seconds: 60,
          deterministic_checks: [
            {
              command: process.platform === 'win32' ? 'type data.txt' : 'cat data.txt',
              expected_exit_code: 0,
              retry_count: 0,
              retry_condition: 'infra',
            },
          ],
        },
      })

      const verifier = new DeterministicVerifier(sandbox, { applyGoldenPatch: true })
      const result = await verifier.verify(task)
      expect(result.passed).toBe(true)
      expect(result.checks[0].status).toBe('PASS')
      expect(result.checks[0].result.stdout).toContain('new')
    } finally {
      await sandbox.teardown()
    }
  })

  it('marks a timed-out check as TIMEOUT', async () => {
    // The actual command string is not executed because we mock the sandbox.
    // The mock returns timedOut:true, which should be classified as TIMEOUT.
    sandbox.setResponses([
      { exitCode: 1, stdout: '', stderr: 'killed', timedOut: true },
    ])
    const task = makeTask({
      validation: {
        timeout_seconds: 60,
        deterministic_checks: [
          {
            command: 'long-running command',
            expected_exit_code: 0,
            retry_count: 0,
            retry_condition: 'infra',
          },
        ],
      },
    })
    const result = await verifier.verify(task)
    expect(result.passed).toBe(false)
    expect(result.checks[0].status).toBe('TIMEOUT')
  })

  it('marks an exception as ERROR', async () => {
    const throwingSandbox: Sandbox = {
      id: 'throw',
      prepare: async () => {},
      getWorkingDir: () => '/tmp',
      runCommand: async () => {
        throw new Error('spawn failure')
      },
      teardown: async () => {},
    }
    const v = new DeterministicVerifier(throwingSandbox)
    const result = await v.verify(makeTask())
    expect(result.checks[0].status).toBe('ERROR')
    expect(result.passed).toBe(false)
  })
})
