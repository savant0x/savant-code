import { describe, expect, it } from 'bun:test'

import {
  runProveCommand,
  determineProveExit,
  parseProveArgs,
} from '../src/prove/prove-cli'

import type { ProveCommandDeps } from '../src/prove/prove-cli'
import type { TaskDefinition } from '../src/schema'
import type { SkillProofArtifact } from '../src/stats/skill-efficacy'

// FID-2026-0824-016/-018: hermetic coverage of the prove CLI surface —
// argument grammar, exit semantics, and orchestration order via injected
// deps. No network, no sandbox, no SDK client.

const FIXTURE_TASK: TaskDefinition = {
  schema_version: '2.0',
  task_id: 'proof-demo',
  category: 'skill_driven',
  difficulty: 'easy',
  environment: { network_disabled: true },
  inputs: { prompt: 'use the skill' },
  validation: {
    timeout_seconds: 60,
    deterministic_checks: [
      {
        command: 'true',
        expected_exit_code: 0,
        retry_count: 0,
        retry_condition: 'infra',
      },
    ],
  },
}

function eligibleArtifact(): SkillProofArtifact {
  return {
    schema_version: '1.0',
    skill_name: 'demo-skill',
    task_id: 'proof-demo',
    generated_at: '2026-01-01T00:00:00.000Z',
    k: 2,
    trials: {
      baseline: [{ index: 0, passed: true, trace_sha256: 'a'.repeat(64) }],
      active: [
        {
          index: 0,
          passed: true,
          trace_sha256: 'b'.repeat(64),
          activated: true,
        },
      ],
    },
    metrics: {
      baseline_pass_rate: 0,
      active_pass_rate: 1,
      skill_lift: 1,
      pass_at_k: 1,
      pass_pow_k: 1,
    },
    activation_verified: true,
    gate: {
      immutable_threshold: 0.95,
      min_trials: 1,
      reliability_met: true,
      eligible_for_immutable: true,
    },
    ztap: { mode: 'off', bound: false },
  }
}

describe('parseProveArgs (production prove caller)', () => {
  it('parses the minimal form with documented defaults', () => {
    const opts = parseProveArgs([
      'demo-skill',
      '--task',
      't1',
      '--tasks-dir',
      'd',
    ])
    expect(opts.skillName).toBe('demo-skill')
    expect(opts.taskId).toBe('t1')
    expect(opts.tasksDir).toBe('d')
    expect(opts.trialsPerArm).toBe(3)
    expect(opts.ztapMode).toBe('record')
    expect(opts.agentId).toBe('savant')
    expect(opts.k).toBeUndefined()
    expect(opts.maxAgentSteps).toBeUndefined()
  })

  it('accepts every documented flag', () => {
    const opts = parseProveArgs([
      'demo-skill',
      '--task',
      't1',
      '--tasks-dir',
      'd',
      '--project-root',
      '/tmp/proj',
      '--trials',
      '2',
      '--k',
      '2',
      '--ztap',
      'enforce',
      '--api-key',
      'key-123',
      '--agent-id',
      'savant-free',
      '--max-steps',
      '25',
    ])
    expect(opts.projectRoot).toBe('/tmp/proj')
    expect(opts.trialsPerArm).toBe(2)
    expect(opts.k).toBe(2)
    expect(opts.ztapMode).toBe('enforce')
    expect(opts.apiKey).toBe('key-123')
    expect(opts.agentId).toBe('savant-free')
    expect(opts.maxAgentSteps).toBe(25)
  })

  it('throws naming the missing requirement', () => {
    expect(() => parseProveArgs([])).toThrow('usage:')
    expect(() => parseProveArgs(['skill'])).toThrow('--task')
    expect(() => parseProveArgs(['skill', '--task', 't'])).toThrow(
      '--tasks-dir',
    )
  })

  it('rejects malformed numeric and enum flags', () => {
    const base = ['skill', '--task', 't', '--tasks-dir', 'd']
    expect(() => parseProveArgs([...base, '--trials', '0'])).toThrow('--trials')
    expect(() => parseProveArgs([...base, '--k', 'abc'])).toThrow('--k')
    expect(() => parseProveArgs([...base, '--ztap', 'sometimes'])).toThrow(
      '--ztap',
    )
    expect(() => parseProveArgs([...base, '--bogus'])).toThrow('--bogus')
  })
})

describe('determineProveExit (production prove caller)', () => {
  it('exits 0 only on immutable eligibility', () => {
    expect(determineProveExit(eligibleArtifact())).toBe(0)
    const ineligible = {
      ...eligibleArtifact(),
      gate: {
        ...eligibleArtifact().gate,
        eligible_for_immutable: false,
      },
    } satisfies SkillProofArtifact
    expect(determineProveExit(ineligible)).toBe(1)
  })
})

describe('runProveCommand (production prove caller)', () => {
  const argv = ['demo-skill', '--task', 'proof-demo', '--tasks-dir', 'd']

  function stubDeps(
    registry: Record<string, TaskDefinition>,
    captured: { params?: Record<string, unknown> } = {},
  ): ProveCommandDeps {
    return {
      loadRegistry: async () => registry,
      loadAgentDefinitions: async () => [],
      runProve: async (params) => {
        captured.params = { ...params }
        return {
          artifact: eligibleArtifact(),
          artifactPath: '/proj/.savant/skill-proofs/demo-skill.json',
        }
      },
    }
  }

  it('resolves the task and forwards parsed options to runSkillProve', async () => {
    process.env.SAVANT_CODE_API_KEY = 'test-key'
    try {
      const captured: { params?: Record<string, unknown> } = {}
      const result = await runProveCommand(
        argv,
        stubDeps({ 'proof-demo': FIXTURE_TASK }, captured),
      )
      expect(result.exitCode).toBe(0)
      expect(result.artifactPath).toContain('demo-skill.json')
      const params = captured.params as Record<string, unknown>
      expect(params['skillName']).toBe('demo-skill')
      expect(params['taskId']).toBe('proof-demo')
      expect(params['trialsPerArm']).toBe(3)
      expect(params['ztapMode']).toBe('record')
      // The API key rides the trial-runner closure, not prove params.
      expect(params['apiKey']).toBeUndefined()
      expect(typeof params['runTrial']).toBe('function')
    } finally {
      delete process.env.SAVANT_CODE_API_KEY
    }
  })

  it('fails fast on an unknown proof task', async () => {
    process.env.SAVANT_CODE_API_KEY = 'test-key'
    try {
      await expect(runProveCommand(argv, stubDeps({}, {}))).rejects.toThrow(
        "Unknown proof task 'proof-demo'",
      )
    } finally {
      delete process.env.SAVANT_CODE_API_KEY
    }
  })

  it('fails fast without any API key source', async () => {
    const previous = process.env.SAVANT_CODE_API_KEY
    delete process.env.SAVANT_CODE_API_KEY
    try {
      await expect(
        runProveCommand(
          ['skill', '--task', 't', '--tasks-dir', 'd'],
          stubDeps({}, {}),
        ),
      ).rejects.toThrow('SAVANT_CODE_API_KEY')
    } finally {
      if (previous !== undefined) {
        process.env.SAVANT_CODE_API_KEY = previous
      }
    }
  })
})
