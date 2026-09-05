import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { loadLocalAgents } from '@savant-code/sdk'

import { GOVERNANCE_TASKS, runGovernanceSmoke } from './governance'
import { BenchmarkHarness } from './harness'
import { runProveCommand } from './prove/prove-cli'
import { loadTaskRegistry } from './registry'
import { runReleaseTier } from './release-tier'
import { writeJsonReport, writeMarkdownReport } from './reports'
import { SavantAgentRunner } from './runners/savant'
import { TempDirSandbox } from './sandboxes/tempdir'
import {
  taskCategorySchema,
  taskDifficultySchema,
  type TaskCategory,
  type TaskDifficulty,
} from './schema'

export async function runTierOneGovernanceSmoke(
  tasksDir = path.resolve(import.meta.dir, '..', 'tasks', 'governance'),
): Promise<void> {
  const registry = await loadTaskRegistry(tasksDir)
  const manifests = Object.values(registry)
  if (manifests.length !== GOVERNANCE_TASKS.length) {
    throw new Error(
      `Tier-1 governance manifest count mismatch: expected ${GOVERNANCE_TASKS.length}, found ${manifests.length}`,
    )
  }
  const replayIds = new Set<string>(
    GOVERNANCE_TASKS.map((task) => task.task_id),
  )
  for (const manifest of manifests) {
    const replayId = manifest.governance_replay?.task_id
    if (
      manifest.category !== 'governance' ||
      replayId === undefined ||
      !replayIds.has(replayId)
    ) {
      throw new Error(`Invalid Tier-1 governance manifest: ${manifest.task_id}`)
    }
  }
  const results = runGovernanceSmoke()
  const failures = results.filter((result) => !result.passed)
  if (failures.length > 0) {
    throw new Error(
      `Tier-1 governance smoke failed: ${failures.map((result) => `${result.task_id}: ${result.failures.join(', ')}`).join('; ')}`,
    )
  }
  console.log(`Tier-1 governance smoke passed: ${results.length} tasks`)
}

export interface CliArgs {
  tasksDir: string
  outputDir: string
  mode: 'evaluate' | 'baseline'
  concurrency: number
  globalTimeoutMs?: number
  apiKey?: string
  agentId?: string
  maxAgentSteps?: number
  category?: TaskCategory
  difficulty?: TaskDifficulty
}

function printHelp(): void {
  console.log(`
Savant-Code Benchmark v2 CLI

Usage:
  bun run cli -- --tasks-dir <path> --output-dir <path> [options]

Required:
  --tasks-dir <path>      Directory containing task definitions
  --output-dir <path>     Directory where reports will be written

Options:
  --mode <mode>           "evaluate" (default) or "baseline"
  --concurrency <n>       Number of tasks to run in parallel (default: 1)
  --global-timeout <ms>   Optional global timeout for the whole harness run
  --api-key <key>         Savant API key (evaluate mode; falls back to SAVANT_CODE_API_KEY)
  --agent-id <id>         Agent ID to run in evaluate mode (default: savant)
  --max-steps <n>         Maximum agent steps per task (default: 100)
  --category <cat>        Only run tasks in this category (e.g. pure_coding)
--difficulty <level>    Only run tasks with this difficulty (easy|medium|hard)
  --help                  Show this help message

Skill proof (paired trials via runSkillProve):

  bun run cli prove <skillName> --task <taskId> --tasks-dir <path>
    [--project-root <p>] [--trials <n>] [--k <n>]
    [--ztap off|record|enforce] [--api-key <key>] [--agent-id <id>]
    [--max-steps <n>]

Exits 0 only when the artifact proves immutable eligibility.

Tier-3 release rotation (FID-2026-0824-019, structural rehearsal):

  bun run cli --release-tier [<version>]

  Deterministic per-version corpus selection across category/difficulty
  strata plus the hard token-ceiling check. Baseline-only by design —
  live capability runs are operator-keyed. Exits non-zero when rotation
  selects nothing or the ceiling is breached.
`)
}

function parseArgs(argv: string[]): Partial<CliArgs> {
  const args: Partial<CliArgs> = {
    mode: 'baseline',
    concurrency: 1,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--tasks-dir':
        args.tasksDir = argv[++i]
        break
      case '--output-dir':
        args.outputDir = argv[++i]
        break
      case '--mode':
        if (argv[i + 1] !== 'evaluate' && argv[i + 1] !== 'baseline') {
          throw new Error(`Invalid mode: ${argv[i + 1]}`)
        }
        args.mode = argv[++i] as 'evaluate' | 'baseline'
        break
      case '--concurrency':
        args.concurrency = Number.parseInt(argv[++i], 10)
        if (Number.isNaN(args.concurrency) || args.concurrency < 1) {
          throw new Error('concurrency must be a positive integer')
        }
        break
      case '--global-timeout':
        args.globalTimeoutMs = Number.parseInt(argv[++i], 10)
        break
      case '--api-key':
        args.apiKey = argv[++i]
        break
      case '--agent-id':
        args.agentId = argv[++i]
        break
      case '--max-steps':
        args.maxAgentSteps = Number.parseInt(argv[++i], 10)
        break
      case '--category':
        args.category = argv[++i] as TaskCategory
        break
      case '--difficulty':
        args.difficulty = argv[++i] as TaskDifficulty
        break
      case '--help':
        printHelp()
        process.exit(0)
    }
  }

  return args
}

function validateArgs(args: Partial<CliArgs>): CliArgs {
  if (!args.tasksDir) {
    throw new Error('--tasks-dir is required')
  }
  if (!args.outputDir) {
    throw new Error('--output-dir is required')
  }
  if (
    args.mode === 'evaluate' &&
    !args.apiKey &&
    !process.env.SAVANT_CODE_API_KEY
  ) {
    throw new Error('evaluate mode requires --api-key or SAVANT_CODE_API_KEY')
  }
  if (args.category) {
    taskCategorySchema.parse(args.category)
  }
  if (args.difficulty) {
    taskDifficultySchema.parse(args.difficulty)
  }

  return {
    tasksDir: args.tasksDir,
    outputDir: args.outputDir,
    mode: args.mode ?? 'baseline',
    concurrency: args.concurrency ?? 1,
    globalTimeoutMs: args.globalTimeoutMs,
    apiKey: args.apiKey ?? process.env.SAVANT_CODE_API_KEY,
    agentId: args.agentId ?? 'savant',
    maxAgentSteps: args.maxAgentSteps,
    category: args.category,
    difficulty: args.difficulty,
  }
}

export async function main(
  argv: string[] = process.argv.slice(2),
): Promise<void> {
  if (argv.length === 1 && argv[0] === '--governance-smoke') {
    await runTierOneGovernanceSmoke()
    return
  }

  // FID-2026-0824-016 production surface: paired-trial skill proofs.
  if (argv[0] === 'prove') {
    const { exitCode } = await runProveCommand(argv.slice(1))
    process.exitCode = exitCode
    return
  }

  // FID-2026-0824-019: Tier-3 structural rehearsal.
  if (argv[0] === '--release-tier') {
    await runReleaseTier(argv.length > 1 ? argv[1] : undefined)
    return
  }

  const raw = parseArgs(argv)
  if (argv.length === 0) {
    printHelp()
    process.exit(0)
  }

  const args = validateArgs(raw)

  // Load the repo's agent definitions so the SDK client has a non-empty
  // registry (the CLI prebuilds these into a bundle; the eval runner loads
  // them explicitly).
  const agentDefinitions =
    args.mode === 'evaluate'
      ? Object.values(
          await loadLocalAgents({
            agentsPath: path.resolve(__dirname, '..', '..', '..', 'agents'),
          }),
        )
      : undefined

  const harness = new BenchmarkHarness({
    tasksDir: args.tasksDir,
    sandboxFactory: () => new TempDirSandbox({ prefix: 'savant-bench-' }),
    agentRunnerFactory:
      args.mode === 'evaluate'
        ? async (task, sandbox) => {
            const runner = new SavantAgentRunner()
            await runner.initialize({
              task,
              sandbox,
              apiKey: args.apiKey,
              agentId: args.agentId,
              agentDefinitions,
              maxAgentSteps: args.maxAgentSteps,
            })
            return runner
          }
        : undefined,
    mode: args.mode,
    concurrency: args.concurrency,
    globalTimeoutMs: args.globalTimeoutMs,
    category: args.category,
    difficulty: args.difficulty,
  })

  const result = await harness.run()

  await mkdir(args.outputDir, { recursive: true })
  const jsonPath = path.join(args.outputDir, 'report.json')
  const mdPath = path.join(args.outputDir, 'report.md')

  await writeJsonReport(result, jsonPath)
  await writeMarkdownReport(result, mdPath)

  console.log(`Wrote JSON report: ${jsonPath}`)
  console.log(`Wrote Markdown report: ${mdPath}`)
  console.log(
    `Total: ${result.total}, Passed: ${result.passed}, Failed: ${result.failed}, Errors: ${result.errors}, Timeouts: ${result.timeouts}`,
  )

  if (result.failed > 0 || result.errors > 0) {
    process.exit(1)
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
