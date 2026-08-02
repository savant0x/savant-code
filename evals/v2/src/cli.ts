import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { BenchmarkHarness } from './harness'
import { writeJsonReport, writeMarkdownReport } from './reports'
import { SavantAgentRunner } from './runners/savant'
import { TempDirSandbox } from './sandboxes/tempdir'
import {
  taskCategorySchema,
  taskDifficultySchema,
  type TaskCategory,
  type TaskDifficulty,
} from './schema'

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
  const raw = parseArgs(argv)
  if (argv.length === 0) {
    printHelp()
    process.exit(0)
  }

  const args = validateArgs(raw)

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
