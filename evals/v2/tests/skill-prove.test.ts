import { readFileSync, rmSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { runSkillProve, scanActivation } from '../src/prove/skill-prove'

import type { RunSkillProveParams, TrialArm } from '../src/prove/skill-prove'
import type { TraceDocument } from '../src/runner'

/** mkdtemp roots awaiting teardown — drained in afterEach for hygiene. */
const createdRoots: string[] = []

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop()
    if (root !== undefined) {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

const SKILL = 'tdd-guard'

/** Deterministic full trace document mentioning the skill 0 or 2 times. */
function traceFor(citesSkill: boolean): TraceDocument {
  const text = citesSkill
    ? `loaded ${SKILL} and cited ${SKILL} rules`
    : 'no skill here'
  const events: TraceDocument['events'] = [
    { type: 'print', raw: { type: 'text', text } },
  ]
  return {
    task_id: 'task-prove',
    run_id: `run-${citesSkill ? 'cite' : 'plain'}-${Math.random()}`,
    started_at: new Date().toISOString(),
    current_phase: 'complete',
    events,
    metadata: {
      total_steps: events.length,
      subagent_count: 0,
      tool_call_count: 0,
      phase_transition_count: 0,
      final_phase: 'complete',
    },
  }
}

function doc(events: TraceDocument['events']): TraceDocument {
  return { ...traceFor(false), events }
}

interface ScriptedStep {
  exitOk: boolean
  cites: boolean
}

function scriptRunner(script: {
  baseline: ScriptedStep[]
  active: ScriptedStep[]
}): {
  runTrial: RunSkillProveParams['runTrial']
  calls: Array<{ arm: TrialArm; index: number }>
} {
  const calls: Array<{ arm: TrialArm; index: number }> = []
  return {
    calls,
    async runTrial({ arm, index }) {
      calls.push({ arm, index })
      const seq = script[arm]
      const step = seq[Math.min(index, seq.length - 1)] ?? {
        exitOk: true,
        cites: false,
      }
      return { exitOk: step.exitOk, trace: traceFor(step.cites) }
    },
  }
}

async function makeParams(
  runTrial: RunSkillProveParams['runTrial'],
): Promise<RunSkillProveParams> {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'skill-prove-'))
  createdRoots.push(projectRoot)
  return {
    skillName: SKILL,
    taskId: 'task-prove',
    projectRoot,
    trialsPerArm: 2,
    minTrials: 2,
    ztapMode: 'record',
    runTrial,
  }
}

describe('scanActivation (FID-2026-0824-016)', () => {
  it('zero or one citations do not activate; two do', () => {
    const zero = traceFor(false)
    expect(scanActivation(zero, SKILL)).toBe(false)

    const one = doc([
      { type: 'print', raw: { type: 'text', text: `loaded ${SKILL}` } },
    ])
    expect(scanActivation(one, SKILL)).toBe(false)

    const two = traceFor(true)
    expect(scanActivation(two, SKILL)).toBe(true)
  })
})

describe('runSkillProve paired loop (FID-2026-0824-016)', () => {
  it('runs baseline before active and writes a parseable artifact', async () => {
    const runner = scriptRunner({
      baseline: [
        { exitOk: false, cites: false },
        { exitOk: false, cites: false },
      ],
      active: [
        { exitOk: true, cites: true },
        { exitOk: true, cites: true },
      ],
    })
    const params = await makeParams(runner.runTrial)
    const { artifact, artifactPath } = await runSkillProve(params)

    expect(runner.calls.map((c) => c.arm)).toEqual([
      'baseline',
      'baseline',
      'active',
      'active',
    ])
    expect(artifact.metrics.baseline_pass_rate).toBe(0)
    expect(artifact.metrics.active_pass_rate).toBe(1)
    expect(artifact.metrics.skill_lift).toBe(1)
    expect(artifact.activation_verified).toBe(true)
    expect(artifact.gate.eligible_for_immutable).toBe(true)

    const onDisk = JSON.parse(readFileSync(artifactPath, 'utf8')) as {
      schema_version: string
      metrics: { skill_lift: number }
    }
    expect(onDisk.schema_version).toBe('1.0')
    expect(onDisk.metrics.skill_lift).toBe(1)
    expect(artifactPath).toContain(path.join('.savant', 'skill-proofs'))
  })

  it('marks an activation miss when active trials never cite the skill', async () => {
    const runner = scriptRunner({
      baseline: [
        { exitOk: true, cites: false },
        { exitOk: true, cites: false },
      ],
      active: [
        { exitOk: true, cites: false },
        { exitOk: true, cites: false },
      ],
    })
    const params = await makeParams(runner.runTrial)
    const { artifact } = await runSkillProve(params)

    expect(artifact.activation_verified).toBe(false)
    expect(artifact.gate.eligible_for_immutable).toBe(false)
    // Baseline outcomes carry no activation field by design.
    expect(artifact.trials.baseline[0]).not.toHaveProperty('activated')
  })

  it('binds the ztap mode into the artifact', async () => {
    const runner = scriptRunner({ baseline: [], active: [] })
    const params = await makeParams(runner.runTrial)
    const { artifact } = await runSkillProve(params)

    expect(artifact.ztap.mode).toBe('record')
    expect(artifact.ztap.bound).toBe(true)
    // Scripted fallback keeps trials passing even past scripted length.
    expect(artifact.trials.baseline.length).toBe(2)
    expect(artifact.trials.active.length).toBe(2)
  })
})
