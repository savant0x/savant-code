import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  loadTaskFromFile,
  loadTaskRegistry,
  loadTaskRegistryFromObject,
  filterTasksByCategory,
  filterTasksByDifficulty,
} from '../src/registry'

import type { TaskDefinition } from '../src/schema'

function createValidTask(
  overrides: Partial<TaskDefinition> = {},
): TaskDefinition {
  return {
    schema_version: '2.0',
    task_id: 'savant-v2-auth-jwt-001',
    category: 'multi_agent_orchestration',
    difficulty: 'medium',
    environment: {
      setup_script: 'bun install',
      network_disabled: true,
    },
    inputs: {
      prompt: 'Migrate auth.ts to use the Jose library.',
    },
    validation: {
      timeout_seconds: 300,
      deterministic_checks: [
        {
          command: 'bun run build',
          expected_exit_code: 0,
          retry_count: 0,
          retry_condition: 'infra',
        },
      ],
    },
    ...overrides,
  }
}

function makeTestDir(): string {
  return path.join(
    import.meta.dir,
    `.test-registry-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
}

describe('loadTaskFromFile', () => {
  it('loads a valid JSON task file', async () => {
    const TEST_DIR = makeTestDir()
    await mkdir(TEST_DIR, { recursive: true })
    const filePath = path.join(TEST_DIR, 'task.json')
    const task = createValidTask()
    await writeFile(filePath, JSON.stringify(task, null, 2))

    const loaded = await loadTaskFromFile(filePath)
    expect(loaded.task_id).toBe(task.task_id)
    expect(loaded.category).toBe(task.category)

    await rm(TEST_DIR, { recursive: true, force: true })
  })

  it('loads a valid YAML task file', async () => {
    const TEST_DIR = makeTestDir()
    await mkdir(TEST_DIR, { recursive: true })
    const filePath = path.join(TEST_DIR, 'task.yaml')
    const yamlContent = `schema_version: "2.0"
task_id: "savant-v2-auth-jwt-001"
category: "multi_agent_orchestration"
difficulty: "medium"
environment:
  setup_script: "bun install"
  network_disabled: true
inputs:
  prompt: "Migrate auth.ts to use the Jose library."
validation:
  timeout_seconds: 300
  deterministic_checks:
    - command: "bun run build"
      expected_exit_code: 0
      retry_count: 0
      retry_condition: "infra"`
    await writeFile(filePath, yamlContent)

    const loaded = await loadTaskFromFile(filePath)
    expect(loaded.task_id).toBe('savant-v2-auth-jwt-001')
    expect(loaded.validation.timeout_seconds).toBe(300)

    await rm(TEST_DIR, { recursive: true, force: true })
  })

  it('throws for invalid JSON', async () => {
    const TEST_DIR = makeTestDir()
    await mkdir(TEST_DIR, { recursive: true })
    const filePath = path.join(TEST_DIR, 'invalid.json')
    await writeFile(filePath, '{ not json }')

    await expect(loadTaskFromFile(filePath)).rejects.toThrow()

    await rm(TEST_DIR, { recursive: true, force: true })
  })

  it('throws for invalid task schema', async () => {
    const TEST_DIR = makeTestDir()
    await mkdir(TEST_DIR, { recursive: true })
    const filePath = path.join(TEST_DIR, 'bad-task.json')
    const task = { ...createValidTask(), task_id: 'BAD ID' }
    await writeFile(filePath, JSON.stringify(task))

    await expect(loadTaskFromFile(filePath)).rejects.toThrow()

    await rm(TEST_DIR, { recursive: true, force: true })
  })
})

describe('loadTaskRegistry', () => {
  it('loads multiple task files recursively', async () => {
    const TEST_DIR = makeTestDir()
    await mkdir(path.join(TEST_DIR, 'pure_coding'), { recursive: true })
    await mkdir(path.join(TEST_DIR, 'fsm_compliance'), { recursive: true })

    const task1 = createValidTask({
      task_id: 'savant-v2-pure-001',
      category: 'pure_coding',
    })
    await writeFile(
      path.join(TEST_DIR, 'pure_coding', 'task.json'),
      JSON.stringify(task1),
    )
    await writeFile(
      path.join(TEST_DIR, 'fsm_compliance', 'task.yaml'),
      `schema_version: "2.0"
task_id: "savant-v2-fsm-001"
category: "fsm_compliance"
difficulty: "medium"
environment:
  setup_script: "bun install"
  network_disabled: true
inputs:
  prompt: "Refactor auth.ts; hidden harness injects a test failure on first run."
validation:
  timeout_seconds: 300
  deterministic_checks:
    - command: "bun run build"
      expected_exit_code: 0
      retry_count: 0
      retry_condition: "infra"`,
    )

    const registry = await loadTaskRegistry(TEST_DIR)
    expect(Object.keys(registry)).toHaveLength(2)
    expect(registry['savant-v2-pure-001'].category).toBe('pure_coding')
    expect(registry['savant-v2-fsm-001'].category).toBe('fsm_compliance')

    await rm(TEST_DIR, { recursive: true, force: true })
  })

  it('throws on duplicate task_id', async () => {
    const TEST_DIR = makeTestDir()
    await mkdir(TEST_DIR, { recursive: true })
    const task = createValidTask()
    await writeFile(path.join(TEST_DIR, 'a.json'), JSON.stringify(task))
    await writeFile(path.join(TEST_DIR, 'b.json'), JSON.stringify(task))

    await expect(loadTaskRegistry(TEST_DIR)).rejects.toThrow(
      'Duplicate task_id',
    )

    await rm(TEST_DIR, { recursive: true, force: true })
  })
})

describe('loadTaskRegistryFromObject', () => {
  it('loads a valid registry object', () => {
    const task = createValidTask()
    const registry = loadTaskRegistryFromObject({ [task.task_id]: task })
    expect(registry[task.task_id].task_id).toBe(task.task_id)
  })

  it('throws for invalid registry object', () => {
    expect(() => loadTaskRegistryFromObject({ invalid: 'data' })).toThrow()
  })
})

describe('filterTasksByCategory', () => {
  it('returns tasks matching the category', () => {
    const task1 = createValidTask({ task_id: 't1', category: 'pure_coding' })
    const task2 = createValidTask({ task_id: 't2', category: 'fsm_compliance' })
    const registry = { t1: task1, t2: task2 }

    expect(filterTasksByCategory(registry, 'pure_coding')).toHaveLength(1)
    expect(filterTasksByCategory(registry, 'pure_coding')[0].task_id).toBe('t1')
  })
})

describe('filterTasksByDifficulty', () => {
  it('returns tasks matching the difficulty', () => {
    const task1 = createValidTask({ task_id: 't1', difficulty: 'easy' })
    const task2 = createValidTask({ task_id: 't2', difficulty: 'hard' })
    const registry = { t1: task1, t2: task2 }

    expect(filterTasksByDifficulty(registry, 'hard')).toHaveLength(1)
    expect(filterTasksByDifficulty(registry, 'hard')[0].task_id).toBe('t2')
  })
})
