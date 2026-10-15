import { describe, it, expect, beforeEach } from 'bun:test'

import { BenchmarkHarness, type HarnessOptions } from '../src/harness'

import type { AgentRunner, TraceDocument } from '../src/runner'
import type { Sandbox, CommandResult } from '../src/sandbox'
import type { TaskDefinition } from '../src/schema'
import type { RunState } from '@savant-code/sdk'

function makeTask(overrides: Partial<TaskDefinition> = {}): TaskDefinition {
  return {
    schema_version: '2.0',
    task_id: 'harness-test-001',
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

class FakeSandbox implements Sandbox {
  public id = 'fake'
  private workingDir = '/tmp/fake'
  private responses: CommandResult[] = []
  public commands: string[] = []
  public prepared = false
  public tornDown = false

  setResponses(responses: CommandResult[]) {
    this.responses = responses
  }

  async prepare(): Promise<void> {
    this.prepared = true
  }

  getWorkingDir(): string {
    return this.workingDir
  }

  async runCommand(command: string): Promise<CommandResult> {
    this.commands.push(command)
    if (this.responses.length === 0) {
      return { exitCode: 0, stdout: '', stderr: '' }
    }
    return this.responses.shift()!
  }

  async teardown(): Promise<void> {
    this.tornDown = true
  }
}

class FakeRunner implements AgentRunner {
  public executed = false
  public fault?: unknown

  async initialize(): Promise<void> {}

  async executePrompt(prompt: string): Promise<RunState> {
    this.executed = true
    return { output: { type: 'text', text: prompt } } as any
  }

  collectTrace(): TraceDocument {
    return {
      task_id: 'harness-test-001',
      run_id: 'run-001',
      started_at: new Date().toISOString(),
      current_phase: 'complete',
      events: [],
      metadata: {
        total_steps: 0,
        subagent_count: 0,
        tool_call_count: 0,
        phase_transition_count: 0,
        final_phase: 'complete',
      },
    }
  }

  async handleInteractivePrompt(_request: string): Promise<string> {
    return 'ok'
  }

  async injectFault(fault: unknown): Promise<void> {
    this.fault = fault
  }
}

describe('BenchmarkHarness', () => {
  let sandbox: FakeSandbox

  beforeEach(() => {
    sandbox = new FakeSandbox()
    sandbox.setResponses([{ exitCode: 0, stdout: 'ok', stderr: '' }])
  })

  it('runs a single task in baseline mode and reports PASS', async () => {
    const options: HarnessOptions = {
      tasks: [makeTask()],
      mode: 'baseline',
      sandboxFactory: () => sandbox,
    }

    const harness = new BenchmarkHarness(options)
    const result = await harness.run()

    expect(result.total).toBe(1)
    expect(result.passed).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.errors).toBe(0)
    expect(result.results[0].status).toBe('PASS')
    expect(sandbox.prepared).toBe(true)
    expect(sandbox.tornDown).toBe(true)
  })

  it('runs a single task in evaluate mode using the agent runner', async () => {
    const runner = new FakeRunner()
    const options: HarnessOptions = {
      tasks: [makeTask()],
      mode: 'evaluate',
      sandboxFactory: () => sandbox,
      agentRunnerFactory: async () => runner,
    }

    const harness = new BenchmarkHarness(options)
    const result = await harness.run()

    expect(result.total).toBe(1)
    expect(result.passed).toBe(1)
    expect(result.failed).toBe(0)
    expect(runner.executed).toBe(true)
  })

  it('reports FAIL when deterministic checks fail', async () => {
    sandbox.setResponses([
      { exitCode: 0, stdout: 'ok', stderr: '' },
      { exitCode: 1, stdout: '', stderr: 'bad' },
    ])
    const options: HarnessOptions = {
      tasks: [makeTask()],
      mode: 'baseline',
      sandboxFactory: () => sandbox,
    }

    const harness = new BenchmarkHarness(options)
    const result = await harness.run()

    expect(result.total).toBe(1)
    expect(result.passed).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.results[0].status).toBe('FAIL')
  })

  it('runs multiple tasks concurrently', async () => {
    const sandboxA = new FakeSandbox()
    sandboxA.setResponses([{ exitCode: 0, stdout: 'ok', stderr: '' }])
    const sandboxB = new FakeSandbox()
    sandboxB.setResponses([{ exitCode: 0, stdout: 'ok', stderr: '' }])

    const sandboxes = [sandboxA, sandboxB]
    const options: HarnessOptions = {
      tasks: [makeTask({ task_id: 'task-a' }), makeTask({ task_id: 'task-b' })],
      mode: 'baseline',
      concurrency: 2,
      sandboxFactory: () => sandboxes.shift()!,
    }

    const harness = new BenchmarkHarness(options)
    const result = await harness.run()

    expect(result.total).toBe(2)
    expect(result.passed).toBe(2)
    expect(sandboxA.prepared).toBe(true)
    expect(sandboxB.prepared).toBe(true)
  })

  it('throws when neither tasksDir nor tasks is provided', async () => {
    const options: HarnessOptions = {
      sandboxFactory: () => sandbox,
    } as any

    const harness = new BenchmarkHarness(options)
    await expect(harness.run()).rejects.toThrow(
      'Either tasksDir or tasks must be provided',
    )
  })
})
