/**
 * FID-2026-1007-013 — eval-runner model override + per-run usage telemetry.
 *
 * Acceptance pins per the record's staged design (Loop 2 fold):
 * - `model` override reaches the SDK `run()` as an inline definition clone
 *   (agents/ on disk untouched; fail fast when no definition resolves);
 * - the mixed-model impossibility pin: a fixture run with an override
 *   asserts the run executes against EXACTLY the override;
 * - `TraceMetadata.usage` sums the `runUsage` tree (main + recursive
 *   subagents) and stays absent when nothing reported;
 * - absence-of-options parity: no `model`/usage reporting → trace metadata
 *   carries neither `model` nor `usage` (defaults unchanged).
 */
import { describe, expect, it } from 'bun:test'

import { SavantAgentRunner } from '../src/runners/savant'
import { TraceCollector } from '../src/trace'

import type { UsageSample } from '../src/runner'
import type { SavantAgentRunnerConfig } from '../src/runners/savant'
import type { Sandbox } from '../src/sandbox'
import type { TaskDefinition } from '../src/schema'
import type {
  AgentDefinition,
  RunState,
  SavantCodeClient,
} from '@savant-code/sdk'

function makeTask(): TaskDefinition {
  return {
    schema_version: '2.0',
    task_id: 'fid-2026-1007-013-001',
    category: 'pure_coding',
    difficulty: 'easy',
    description: 'Model override + usage telemetry',
    environment: {
      setup_script: 'echo setup',
      network_disabled: true,
    },
    inputs: { prompt: 'Fix the bug' },
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

const fakeSandbox = {
  getWorkingDir: () => '/tmp/x',
  prepare: async () => {},
} as unknown as Sandbox

const DEFINITIONS: AgentDefinition[] = [
  {
    id: 'savant',
    displayName: 'Savant',
    model: 'z-ai/glm-5.3-flash',
  },
]

/** Capture the `agent` the runner passes to the SDK and resolve a canned state. */
function capturingClient(
  captured: { agent?: unknown },
  runState: RunState,
): Pick<SavantCodeClient, 'run'> {
  return {
    run: async (options: { agent: unknown }) => {
      captured.agent = options.agent
      return runState
    },
  }
}

function stateWithUsage(main: unknown, subagents: unknown[] = []): RunState {
  return {
    traceSessionId: 't',
    output: { type: 'error', message: 'done' },
    sessionState: {
      mainAgentState: { runUsage: main, subagents },
    },
  } as unknown as RunState
}

describe('FID-2026-1007-013 — model override', () => {
  it('passes an inline definition clone with the override model to client.run', async () => {
    const captured: { agent?: unknown } = {}
    const runner = new SavantAgentRunner()
    const config: SavantAgentRunnerConfig = {
      task: makeTask(),
      sandbox: fakeSandbox,
      agentId: 'savant',
      agentDefinitions: DEFINITIONS,
      model: 'openai/gpt-5-mini',
      savantClient: capturingClient(captured, makeRunState()),
    }
    await runner.initialize(config)
    await runner.executePrompt('hello')

    // The override reaches the SDK as an inline object (never a disk edit).
    expect(typeof captured.agent).toBe('object')
    const definition = captured.agent as AgentDefinition
    expect(definition.id).toBe('savant')
    expect(definition.model).toBe('openai/gpt-5-mini')

    // The mixed-model impossibility pin: the trace records EXACTLY the
    // override, not the base definition's model.
    const trace = runner.collectTrace()
    expect(trace.metadata.model).toBe('openai/gpt-5-mini')
  })

  it('fails fast at executePrompt when no definition resolves for the override', async () => {
    const captured: { agent?: unknown } = {}
    const runner = new SavantAgentRunner()
    await runner.initialize({
      task: makeTask(),
      sandbox: fakeSandbox,
      agentId: 'savant',
      model: 'openai/gpt-5-mini',
      savantClient: capturingClient(captured, makeRunState()),
    })
    expect(runner.executePrompt('hello')).rejects.toThrow(
      /no agent definition resolved for 'savant'/,
    )
  })

  it('absence of model → the string agent id passes through and the resolved template model is recorded', async () => {
    const captured: { agent?: unknown } = {}
    const runner = new SavantAgentRunner()
    await runner.initialize({
      task: makeTask(),
      sandbox: fakeSandbox,
      agentId: 'savant',
      agentDefinitions: DEFINITIONS,
      savantClient: capturingClient(captured, makeRunState()),
    })
    await runner.executePrompt('hello')
    // The string agent id passed through untouched — no inline clone.
    expect(captured.agent).toBe('savant')
    const trace = runner.collectTrace()
    // Effective model = the resolved definition's model (the record's spec:
    // "override if set, else the resolved template's model").
    expect(trace.metadata.model).toBe('z-ai/glm-5.3-flash')
  })

  it('absence of both model and registered definitions → metadata.model is undefined (parity)', async () => {
    const runner = new SavantAgentRunner()
    await runner.initialize({
      task: makeTask(),
      sandbox: fakeSandbox,
      agentId: 'savant',
      savantClient: capturingClient({}, makeRunState()),
    })
    await runner.executePrompt('hello')
    const trace = runner.collectTrace()
    expect(trace.metadata.model).toBeUndefined()
  })
})

describe('FID-2026-1007-013 — usage telemetry', () => {
  it('sums runUsage over the main agent and recursive subagents', () => {
    const collector = new TraceCollector('task', 'run')
    collector.recordEffectiveModel('openai/gpt-5-mini')
    const runState = stateWithUsage(
      {
        inputTokens: 100,
        outputTokens: 20,
        cachedInputTokens: 10,
        totalTokens: 120,
      },
      [
        {
          runUsage: {
            inputTokens: 50,
            outputTokens: 5,
            cachedInputTokens: 25,
            totalTokens: 55,
          },
          subagents: [
            {
              runUsage: {
                inputTokens: 7,
                outputTokens: 3,
                cachedInputTokens: 0,
                totalTokens: 10,
              },
            },
          ],
        },
      ],
    )
    const trace = collector.finalize(runState)
    expect(trace.metadata.usage).toEqual({
      inputTokens: 157,
      outputTokens: 28,
      cachedInputTokens: 35,
      totalTokens: 185,
    })
    expect(trace.metadata.model).toBe('openai/gpt-5-mini')
  })

  it('omits metadata.usage when no node reported usage (not a fake zero)', () => {
    const collector = new TraceCollector('task', 'run')
    const runState = stateWithUsage(undefined, [{}, { subagents: [] }])
    const trace = collector.finalize(runState)
    expect(trace.metadata.usage).toBeUndefined()
    expect(trace.metadata.model).toBeUndefined()
  })

  it('the UsageSample type stays token-counts-only (Law 12 surface pin)', () => {
    const sample: UsageSample = {
      inputTokens: 1,
      outputTokens: 2,
      cachedInputTokens: 0,
      totalTokens: 3,
    }
    expect(Object.keys(sample).sort()).toEqual([
      'cachedInputTokens',
      'inputTokens',
      'outputTokens',
      'totalTokens',
    ])
  })
})

function makeRunState(): RunState {
  return {
    traceSessionId: 'test-trace-id',
    output: { type: 'error', message: 'done' },
  }
}
