import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { loadSkills } from '@savant-code/sdk'
import { expect, test } from 'bun:test'

import { prepareProofArm } from '../src/prove/prepare-proof-arm'
import { restrictedExecutionAgentDefinitions } from '../src/prove/restricted-execution-agent'
import { TempDirSandbox } from '../src/sandboxes/tempdir'

import type { TaskDefinition } from '../src/schema'
import type { AgentDefinition } from '@savant-code/sdk'

test('paired proof arms share the fixture and differ by exactly the skill', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'proof-arm-test-'))
  const baseline = new TempDirSandbox()
  const active = new TempDirSandbox()
  try {
    const taskDir = path.join(root, 'task')
    await mkdir(taskDir)
    await writeFile(path.join(taskDir, 'fixture.txt'), 'same input')
    const skillDir = path.join(
      root,
      '.agents',
      'skills',
      '.quarantine',
      'demo-skill',
    )
    await mkdir(skillDir, { recursive: true })
    await writeFile(
      path.join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: demo-skill',
        'description: A proof fixture skill',
        '---',
        '# Demo Skill',
      ].join('\n'),
    )
    const task: TaskDefinition = {
      schema_version: '2.0',
      task_id: 'proof-arm',
      category: 'skill_driven',
      difficulty: 'easy',
      task_dir: taskDir,
      environment: { network_disabled: true, setup_files: ['fixture.txt'] },
      inputs: { prompt: 'use the skill' },
      validation: {
        timeout_seconds: 10,
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
    const opts = { projectRoot: root, skillName: 'demo-skill' }
    const baselineSkills = await prepareProofArm(
      baseline,
      task,
      opts,
      'baseline',
    )
    const activeSkills = await prepareProofArm(active, task, opts, 'active')
    expect(
      await readFile(
        path.join(baseline.getWorkingDir(), 'fixture.txt'),
        'utf8',
      ),
    ).toBe('same input')
    expect(
      await readFile(path.join(active.getWorkingDir(), 'fixture.txt'), 'utf8'),
    ).toBe('same input')
    expect(
      Object.keys(await loadSkills({ skillsPath: baselineSkills })),
    ).toEqual([])
    expect(Object.keys(await loadSkills({ skillsPath: activeSkills }))).toEqual(
      ['demo-skill'],
    )
  } finally {
    await baseline.teardown()
    await active.teardown()
    await rm(root, { recursive: true, force: true })
  }
})

test('execution proofs expose only scoped file tools and remove code execution routes', () => {
  const definitions = [
    {
      id: 'forge',
      displayName: 'Forge',
      model: 'test',
      toolNames: ['run_terminal_command', 'write_file'],
      programmaticToolNames: ['run_terminal_command'],
      spawnableAgents: ['detective'],
      mcpServers: { external: {} },
      handleSteps: 'runner',
    },
    {
      id: 'scribe',
      displayName: 'Scribe',
      model: 'test',
      toolNames: ['read_files'],
    },
  ] as unknown as AgentDefinition[]
  const result = restrictedExecutionAgentDefinitions(definitions, 'forge')
  expect(result[0].toolNames).toEqual([
    'read_files',
    'write_file',
    'str_replace',
    'apply_patch',
    'transition_phase',
    'set_output',
    'end_turn',
  ])
  expect(result[0].spawnableAgents).toEqual([])
  expect(result[0].programmaticToolNames).toEqual([])
  expect(result[0].mcpServers).toEqual({})
  expect(result[0].handleSteps).toBeUndefined()
  expect(result[1]).toBe(definitions[1])
  expect(() =>
    restrictedExecutionAgentDefinitions(definitions, 'missing'),
  ).toThrow(/not registered/)
})
