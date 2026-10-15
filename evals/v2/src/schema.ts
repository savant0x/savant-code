import { z } from 'zod'

export const taskDifficultySchema = z.enum(['easy', 'medium', 'hard'])

export const taskCategorySchema = z.enum([
  'pure_coding',
  'fsm_compliance',
  'multi_agent_orchestration',
  'custom_tool',
  'mcp_tool',
  'skill_driven',
  'programmatic_agent',
  'slash_cli',
  'error_recovery',
  'governance',
  // FID-2026-0824-019: CodeScaleBench-inspired capability taxonomy.
  // Additive — every pre-existing value parses unchanged.
  'cross_repo_navigation',
  'dependency_tracing',
  'codebase_comprehension',
  'security_remediation',
])

export const deterministicCheckSchema = z.object({
  command: z.string().min(1),
  expected_exit_code: z.number().int().min(0).default(0),
  timeout_seconds: z.number().int().positive().optional(),
  retry_count: z.number().int().min(0).max(3).default(0),
  retry_condition: z.enum(['infra', 'always']).default('infra'),
})

export const fsmAssertionSchema = z.object({
  strict_phase_order: z.boolean().default(true),
  allow_write_in_red: z.boolean().default(false),
  expected_phase_sequence: z.array(z.string()).optional(),
})

/**
 * FID-2026-0824-014: per-agent separation-of-duties assertion. Evaluated
 * against the trace's subagent map; additive to validation (schema_version
 * stays "2.0"), mirroring fsm_assertions.
 */
export const trajectoryAssertionSchema = z.object({
  agent_type: z.string().min(1),
  denied_tools: z.array(z.string().min(1)).default([]),
  required_tools: z.array(z.string().min(1)).default([]),
})

export const customToolCheckSchema = z.object({
  tool_name: z.string().min(1),
  expected_calls: z.string().default('>=1'),
})

export const environmentSchema = z.object({
  base_image: z.string().optional(),
  /** Optional shell script to run after copying setup_files. */
  setup_script: z.string().optional(),
  /** Optional list of files (relative to the task directory) to copy into the sandbox. */
  setup_files: z.array(z.string().min(1)).optional(),
  network_disabled: z.boolean().default(true),
})

export const taskDefinitionSchema = z.object({
  schema_version: z.literal('2.0'),
  task_id: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9_-]+$/,
      'task_id must be lowercase alphanumeric with underscores or hyphens only',
    ),
  category: taskCategorySchema,
  difficulty: taskDifficultySchema,
  description: z.string().min(1).optional(),
  /** Absolute path to the task directory. Populated by the registry loader. */
  task_dir: z.string().optional(),
  environment: environmentSchema,
  /** Optional path to a golden patch (unified diff) for this task. */
  golden_patch: z.string().optional(),
  /** Links a YAML task manifest to the deterministic governance replay corpus. */
  governance_replay: z
    .object({
      task_id: z.string().min(1),
    })
    .optional(),
  /** FID-2026-0824-019: provenance for auto-ingested capability tasks. */
  ingest_provenance: z
    .object({
      source: z.string().min(1),
      issue_number: z.number().int().positive().optional(),
      window_start: z.string().min(1),
      window_end: z.string().min(1),
      content_hash: z.string().length(64),
    })
    .optional(),
  inputs: z.object({
    prompt: z.string().min(1),
  }),
  validation: z.object({
    timeout_seconds: z.number().int().positive().default(300),
    deterministic_checks: z.array(deterministicCheckSchema).min(1),
    fsm_assertions: fsmAssertionSchema.optional(),
    /** Agent types the run is expected to spawn (e.g. ["detective", "forge"]). */
    required_agents: z.array(z.string().min(1)).optional(),
    /** FID-2026-0824-014: per-agent tool denials/requirements scored from the trace subagent map. */
    trajectory_assertions: z.array(trajectoryAssertionSchema).optional(),
    custom_tool_checks: z.array(customToolCheckSchema).optional(),
  }),
})

export type TaskDefinition = z.infer<typeof taskDefinitionSchema>
export type TaskCategory = z.infer<typeof taskCategorySchema>
export type TaskDifficulty = z.infer<typeof taskDifficultySchema>
export type DeterministicCheck = z.infer<typeof deterministicCheckSchema>
export type FsmAssertion = z.infer<typeof fsmAssertionSchema>
export type TrajectoryAssertion = z.infer<typeof trajectoryAssertionSchema>

export const taskRegistrySchema = z.record(z.string(), taskDefinitionSchema)

export type TaskRegistry = Record<string, TaskDefinition>
