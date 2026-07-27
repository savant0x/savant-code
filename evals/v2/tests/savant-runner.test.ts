import { describe, it, expect, beforeEach } from 'bun:test'
import { SavantAgentRunner } from '../src/runners/savant'
import type { SavantAgentRunnerConfig } from '../src/runners/savant'
import { TempDirSandbox } from '../src/sandboxes/tempdir'
import type { TaskDefinition } from '../src/schema'
import type { RunState, SavantCodeClient } from '@savant-code/sdk'

function makeTask(): TaskDefinition {
  return {
    schema_version: '2.0',
    task_id: 'savant-v2-test-001',
    category: 'pure_coding',
    difficulty: 'easy',
    description: 'Test task',
    environment: {
      setup_script: 'echo setup',
      network_disabled: true,
    },
    inputs: {
      prompt: 'Fix the bug',
    },
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
  }
}

function makeRunState(overrides: Partial<RunState> = {}): RunState {
  return {
    traceSessionId: 'test-trace-id',
    output: { type: 'error', message: 'done' },
    ...overrides,
  }
}

describe('SavantAgentRunner', () => {
  let sandbox: TempDirSandbox
  let config: SavantAgentRunnerConfig

  beforeEach(async () => {
    sandbox = new TempDirSandbox({ prefix: 'runner-test-' })
    await sandbox.prepare()
    config = {
      task: makeTask(),
      sandbox,
      apiKey: 'test-key',
      agentId: 'savant',
      maxAgentSteps: 10,
    }
  })

  it('streams print events into the trace', async () => {
    const runState = makeRunState()
    const fakeClient: Pick<SavantCodeClient, 'run'> = {
      run: async () => runState,
    }
    config.savantClient = fakeClient

    const runner = new SavantAgentRunner()
    await runner.initialize(config)
    const result = await runner.executePrompt('hello')
    expect(result).toBe(runState)

    const trace = runner.collectTrace()
    expect(trace.task_id).toBe('savant-v2-test-001')
    expect(trace.events.length).toBe(0)
    expect(trace.metadata.total_steps).toBe(0)
  })

  it('derives phase transitions from transition_phase tool calls', async () => {
    const runState = makeRunState()
    const fakeClient: Pick<SavantCodeClient, 'run'> = {
      run: async (_options: unknown) => {
        // Simulate the runtime calling handleEvent for a tool_call.
        const typedOptions = _options as { handleEvent?: (event: unknown) => void }
        typedOptions.handleEvent?.({
          type: 'tool_call',
          toolCallId: 'tc-1',
          toolName: 'transition_phase',
          input: { phase: 'red' },
        })
        typedOptions.handleEvent?.({
          type: 'tool_call',
          toolCallId: 'tc-2',
          toolName: 'transition_phase',
          input: { phase: 'green' },
        })
        typedOptions.handleEvent?.({
          type: 'subagent_start',
          agentId: 'agent-1',
          agentType: 'forge',
          displayName: 'Forge',
          onlyChild: false,
        })
        return runState
      },
    }
    config.savantClient = fakeClient

    const runner = new SavantAgentRunner()
    await runner.initialize(config)
    await runner.executePrompt('hello')
    const trace = runner.collectTrace()

    const phaseTransitions = trace.events.filter((e) => e.type === 'phase_transition')
    expect(phaseTransitions.length).toBe(2)
    expect(phaseTransitions[0]).toEqual({
      type: 'phase_transition',
      from: 'idle',
      to: 'red',
      toolCallId: 'tc-1',
    })
    expect(phaseTransitions[1]).toEqual({
      type: 'phase_transition',
      from: 'red',
      to: 'green',
      toolCallId: 'tc-2',
    })

    expect(trace.metadata.subagent_count).toBe(1)
    expect(trace.metadata.tool_call_count).toBe(2)
    expect(trace.metadata.phase_transition_count).toBe(2)
  })

  it('captures stream chunks as trace events', async () => {
    const runState = makeRunState()
    const fakeClient: Pick<SavantCodeClient, 'run'> = {
      run: async (_options: unknown) => {
        const typedOptions = _options as { handleStreamChunk?: (chunk: unknown) => void }
        typedOptions.handleStreamChunk?.({
          type: 'subagent_chunk',
          agentId: 'agent-1',
          agentType: 'forge',
          chunk: 'working...',
        })
        typedOptions.handleStreamChunk?.({
          type: 'reasoning_chunk',
          agentId: 'agent-1',
          ancestorRunIds: [],
          chunk: 'because...',
        })
        return runState
      },
    }
    config.savantClient = fakeClient

    const runner = new SavantAgentRunner()
    await runner.initialize(config)
    await runner.executePrompt('hello')
    const trace = runner.collectTrace()

    expect(trace.events.some((e) => e.type === 'subagent_chunk')).toBe(true)
    expect(trace.events.some((e) => e.type === 'reasoning_chunk')).toBe(true)
  })

  it('records injected faults in the trace', async () => {
    const fakeClient: Pick<SavantCodeClient, 'run'> = {
      run: async () => makeRunState(),
    }
    config.savantClient = fakeClient

    const runner = new SavantAgentRunner()
    await runner.initialize(config)
    await runner.injectFault({
      type: 'env_fault',
      message: 'missing dependency',
      targetTool: 'run_terminal_command',
    })
    const trace = runner.collectTrace()
    expect(trace.events.some((e) => e.type === 'fault_injected')).toBe(true)
  })
})
