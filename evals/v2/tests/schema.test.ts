import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import {
  taskDefinitionSchema,
  taskRegistrySchema,
  type TaskDefinition,
} from '../src/schema'

function createValidTask(): TaskDefinition {
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
        {
          command: 'tsc --noEmit',
          expected_exit_code: 0,
          retry_count: 0,
          retry_condition: 'infra',
        },
        {
          command: 'bun test src/auth.test.ts',
          expected_exit_code: 0,
          retry_count: 0,
          retry_condition: 'infra',
        },
      ],
      fsm_assertions: {
        strict_phase_order: true,
        allow_write_in_red: false,
        expected_phase_sequence: ['RED', 'GREEN', 'AUDIT', 'COMPLETE'],
      },
      custom_tool_checks: [
        {
          tool_name: 'generate_ast_graph',
          expected_calls: '>=1',
        },
      ],
    },
  }
}

describe('taskDefinitionSchema', () => {
  it('accepts a valid task definition', () => {
    const task = createValidTask()
    const result = taskDefinitionSchema.safeParse(task)
    expect(result.success).toBe(true)
  })

  it('rejects missing schema_version', () => {
    const task = createValidTask()
    // @ts-expect-error testing invalid input
    delete task.schema_version
    const result = taskDefinitionSchema.safeParse(task)
    expect(result.success).toBe(false)
  })

  it('rejects invalid task_id with uppercase characters', () => {
    const task = { ...createValidTask(), task_id: 'Savant-V2-001' }
    const result = taskDefinitionSchema.safeParse(task)
    expect(result.success).toBe(false)
  })

  it('rejects unknown category', () => {
    const task = { ...createValidTask(), category: 'unknown_category' }
    const result = taskDefinitionSchema.safeParse(task)
    expect(result.success).toBe(false)
  })

  it('rejects empty deterministic_checks array', () => {
    const task = {
      ...createValidTask(),
      validation: { ...createValidTask().validation, deterministic_checks: [] },
    }
    const result = taskDefinitionSchema.safeParse(task)
    expect(result.success).toBe(false)
  })

  it('rejects negative timeout_seconds', () => {
    const task = {
      ...createValidTask(),
      validation: { ...createValidTask().validation, timeout_seconds: -1 },
    }
    const result = taskDefinitionSchema.safeParse(task)
    expect(result.success).toBe(false)
  })

  it('applies default values for optional fields', () => {
    const input = { ...createValidTask() }
    const parsed = taskDefinitionSchema.parse(input)
    expect(parsed.validation.deterministic_checks[0].expected_exit_code).toBe(0)
    expect(parsed.validation.deterministic_checks[0].retry_count).toBe(0)
    expect(parsed.environment.network_disabled).toBe(true)
  })
})

describe('taskRegistrySchema', () => {
  it('accepts a registry keyed by task_id', () => {
    const task = createValidTask()
    const registry = { [task.task_id]: task }
    const result = taskRegistrySchema.safeParse(registry)
    expect(result.success).toBe(true)
  })

  it('rejects a registry where a value is an invalid task definition', () => {
    const task = createValidTask()
    const registry = { [task.task_id]: { ...task, task_id: 'BAD ID' } }
    const result = taskRegistrySchema.safeParse(registry)
    expect(result.success).toBe(false)
  })
})
