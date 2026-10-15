import { cp } from 'node:fs/promises'
import path from 'node:path'

import pLimit from 'p-limit'

import { MetricAggregator, type MetricReport } from './metrics'
import { loadTaskRegistry } from './registry'
import { DeterministicVerifier, type VerificationResult } from './verify'

import type { AgentRunner, TraceDocument } from './runner'
import type { Sandbox } from './sandbox'
import type { TaskCategory, TaskDefinition, TaskDifficulty } from './schema'

export type HarnessMode = 'evaluate' | 'baseline'

export interface HarnessOptions {
  /**
   * Directory containing task definition files. Either `tasksDir` or `tasks`
   * must be provided.
   */
  tasksDir?: string
  /**
   * Inline task registry. Useful for testing or for callers that already have
   * the registry in memory. Either `tasksDir` or `tasks` must be provided.
   */
  tasks?: TaskDefinition[]
  /**
   * Factory that creates a fresh sandbox for a given task.
   * The harness calls prepare() before the run and teardown() afterwards.
   */
  sandboxFactory: (task: TaskDefinition) => Sandbox
  /**
   * Factory that creates and fully initializes a runner for a task in
   * evaluate mode. Not used in baseline mode.
   */
  agentRunnerFactory?: (
    task: TaskDefinition,
    sandbox: Sandbox,
  ) => Promise<AgentRunner>
  /** Run mode. */
  mode?: HarnessMode
  /**
   * Optional global timeout for the whole harness run.
   * When the timeout fires, the harness stops accepting new tasks; any tasks
   * already in progress continue until they complete or hit their own
   * `timeout_seconds`.
   * Individual tasks still honor their own timeout.
   */
  globalTimeoutMs?: number
  /** Maximum number of tasks to run concurrently. */
  concurrency?: number
  /** Only run tasks whose category matches this value. */
  category?: TaskCategory
  /** Only run tasks whose difficulty matches this value. */
  difficulty?: TaskDifficulty
}

export interface TaskResult {
  task_id: string
  task: TaskDefinition
  status: 'PASS' | 'FAIL' | 'TIMEOUT' | 'ERROR'
  trace?: TraceDocument
  metrics?: MetricReport
  verification?: VerificationResult
  error?: string
}

export interface HarnessResult {
  results: TaskResult[]
  total: number
  passed: number
  failed: number
  errors: number
  timeouts: number
  duration_ms: number
}

class TaskTimeoutError extends Error {
  constructor(taskId: string, timeoutMs: number) {
    super(`Task ${taskId} timeout after ${timeoutMs}ms`)
    this.name = 'TaskTimeoutError'
  }
}

/**
 * Orchestrates benchmark runs across a registry of tasks.
 *
 * - In `evaluate` mode, the harness runs the configured agent against each task,
 *   then runs deterministic verification and metric aggregation.
 * - In `baseline` mode, the harness skips the agent run and applies the task's
 *   golden patch before verification, letting task authors validate their tasks.
 */
export class BenchmarkHarness {
  constructor(private readonly options: HarnessOptions) {}

  async run(): Promise<HarnessResult> {
    let tasks: TaskDefinition[]

    if (this.options.tasks) {
      tasks = this.options.tasks
    } else if (this.options.tasksDir) {
      const registry = await loadTaskRegistry(this.options.tasksDir)
      tasks = Object.values(registry)
      if (this.options.category) {
        tasks = tasks.filter((task) => task.category === this.options.category)
      }
      if (this.options.difficulty) {
        tasks = tasks.filter(
          (task) => task.difficulty === this.options.difficulty,
        )
      }
    } else {
      throw new Error('Either tasksDir or tasks must be provided')
    }

    const limit = pLimit(Math.max(1, this.options.concurrency ?? 1))
    const startedAt = Date.now()

    let globalTimer: ReturnType<typeof setTimeout> | undefined
    let aborted = false

    if (this.options.globalTimeoutMs && this.options.globalTimeoutMs > 0) {
      globalTimer = setTimeout(() => {
        aborted = true
      }, this.options.globalTimeoutMs)
    }

    const runPromises = tasks.map((task) =>
      limit(async () => {
        if (aborted) {
          return this.timeoutResult(task, 'Global harness timeout exceeded')
        }

        try {
          return await this.withTaskTimeout(task, this.runTask(task))
        } catch (error) {
          if (error instanceof TaskTimeoutError) {
            return this.timeoutResult(task, error.message)
          }
          return this.errorResult(task, error)
        }
      }),
    )

    const results = await Promise.all(runPromises)

    if (globalTimer) clearTimeout(globalTimer)

    const durationMs = Date.now() - startedAt
    const passed = results.filter((r) => r.status === 'PASS').length
    const failed = results.filter((r) => r.status === 'FAIL').length
    const errors = results.filter((r) => r.status === 'ERROR').length
    const timeouts = results.filter((r) => r.status === 'TIMEOUT').length

    return {
      results,
      total: tasks.length,
      passed,
      failed,
      errors,
      timeouts,
      duration_ms: durationMs,
    }
  }

  private async runTask(task: TaskDefinition): Promise<TaskResult> {
    const sandbox = this.options.sandboxFactory(task)

    try {
      await sandbox.prepare()

      // Copy task files into the sandbox before running the setup script.
      if (
        task.environment.setup_files &&
        task.environment.setup_files.length > 0
      ) {
        if (!task.task_dir) {
          throw new Error(
            `task ${task.task_id} has setup_files but no task_dir; load the task through the registry so the task directory is known`,
          )
        }
        for (const file of task.environment.setup_files) {
          const taskDir = path.resolve(task.task_dir)
          const src = path.resolve(taskDir, file)
          // Defensive: reject paths that escape the task directory.
          const relative = path.relative(taskDir, src)
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error(`setup_files entry escapes task directory: ${file}`)
          }
          const dest = path.resolve(sandbox.getWorkingDir(), file)
          await cp(src, dest, { recursive: true })
        }
      }

      // Run the task's environment setup script (install deps, seed files, etc.).
      if (task.environment.setup_script) {
        const setupResult = await sandbox.runCommand(
          task.environment.setup_script,
          { shell: true },
        )
        if (setupResult.exitCode !== 0) {
          const details = [
            `exitCode=${setupResult.exitCode}`,
            setupResult.stdout ? `stdout=${setupResult.stdout}` : undefined,
            setupResult.stderr ? `stderr=${setupResult.stderr}` : undefined,
          ]
            .filter(Boolean)
            .join(' ')
          throw new Error(`Setup script failed: ${details}`)
        }
      }

      const mode = this.options.mode ?? 'evaluate'
      let trace: TraceDocument | undefined

      if (mode === 'evaluate') {
        if (!this.options.agentRunnerFactory) {
          throw new Error('agentRunnerFactory is required in evaluate mode')
        }
        const runner = await this.options.agentRunnerFactory(task, sandbox)
        await runner.executePrompt(task.inputs.prompt)
        trace = runner.collectTrace()
      }

      const verifier = new DeterministicVerifier(sandbox, {
        applyGoldenPatch: mode === 'baseline',
      })

      const verification = await verifier.verify(task)

      const metrics = trace
        ? MetricAggregator.aggregate(trace, task)
        : undefined
      const passed = verification.passed && (metrics ? metrics.passed : true)

      return {
        task_id: task.task_id,
        task,
        status: passed ? 'PASS' : 'FAIL',
        trace,
        metrics,
        verification,
      }
    } finally {
      await sandbox.teardown()
    }
  }

  private async withTaskTimeout<T>(
    task: TaskDefinition,
    promise: Promise<T>,
  ): Promise<T> {
    const timeoutMs = (task.validation.timeout_seconds ?? 300) * 1000
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return promise
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TaskTimeoutError(task.task_id, timeoutMs))
      }, timeoutMs)

      promise
        .then((value) => {
          clearTimeout(timer)
          resolve(value)
        })
        .catch((error) => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  private timeoutResult(task: TaskDefinition, message: string): TaskResult {
    return {
      task_id: task.task_id,
      task,
      status: 'TIMEOUT',
      error: message,
    }
  }

  private errorResult(task: TaskDefinition, error: unknown): TaskResult {
    const message = error instanceof Error ? error.message : String(error)
    return {
      task_id: task.task_id,
      task,
      status: 'ERROR',
      error: message,
    }
  }
}
