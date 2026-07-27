import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { parse as parseYaml } from 'yaml'
import {
  taskDefinitionSchema,
  taskRegistrySchema,
  type TaskDefinition,
  type TaskRegistry,
} from './schema'

export interface RegistryLoadOptions {
  recursive?: boolean
  extensions?: string[]
}

const DEFAULT_EXTENSIONS = ['.json', '.yaml', '.yml']

export class TaskRegistryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'TaskRegistryError'
  }
}

function parseTaskFile(content: string, filePath: string): unknown {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.json') {
    try {
      return JSON.parse(content)
    } catch (err) {
      throw new TaskRegistryError(
        `Invalid JSON in task file ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }
  if (ext === '.yaml' || ext === '.yml') {
    try {
      return parseYaml(content)
    } catch (err) {
      throw new TaskRegistryError(
        `Invalid YAML in task file ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }
  throw new TaskRegistryError(`Unsupported task file extension: ${filePath}`)
}

function validateTaskDefinition(data: unknown, filePath: string): TaskDefinition {
  const result = taskDefinitionSchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new TaskRegistryError(
      `Task validation failed for ${filePath}: ${issues}`,
      result.error,
    )
  }
  return result.data
}

export async function loadTaskFromFile(filePath: string): Promise<TaskDefinition> {
  const content = await readFile(filePath, 'utf-8')
  const data = parseTaskFile(content, filePath)
  const task = validateTaskDefinition(data, filePath)
  return resolvePaths(task, filePath)
}

function resolvePaths(task: TaskDefinition, filePath: string): TaskDefinition {
  const taskDir = path.dirname(filePath)
  let goldenPatch = task.golden_patch
  if (goldenPatch && !path.isAbsolute(goldenPatch)) {
    goldenPatch = path.resolve(taskDir, goldenPatch)
  }
  return {
    ...task,
    golden_patch: goldenPatch,
    task_dir: taskDir,
  }
}

export async function loadTaskRegistry(
  tasksDir: string,
  options: RegistryLoadOptions = {},
): Promise<TaskRegistry> {
  const { recursive = true, extensions = DEFAULT_EXTENSIONS } = options
  const registry: TaskRegistry = {}
  const firstSeenPaths = new Map<string, string>()

  async function scan(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch (err) {
      throw new TaskRegistryError(
        `Failed to read tasks directory ${dir}: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory() && recursive) {
        await scan(fullPath)
        continue
      }
      if (!entry.isFile()) continue

      const ext = path.extname(entry.name).toLowerCase()
      if (!extensions.includes(ext)) continue

      const task = await loadTaskFromFile(fullPath)
      if (task.task_id in registry) {
        throw new TaskRegistryError(
          `Duplicate task_id "${task.task_id}" in ${fullPath} (first seen in ${firstSeenPaths.get(task.task_id) ?? 'unknown'})`,
        )
      }
      registry[task.task_id] = task
      firstSeenPaths.set(task.task_id, fullPath)
    }
  }

  await scan(tasksDir)

  // Sort the registry by task_id so that consumers (reports, harness loops,
  // leaderboard generation) always see tasks in a deterministic order rather
  // than filesystem order.
  const sortedRegistry: TaskRegistry = {}
  const sortedKeys = Object.keys(registry).sort((a, b) => a.localeCompare(b, 'en'));
  for (const key of sortedKeys) {
    sortedRegistry[key] = registry[key]
  }

  return sortedRegistry
}

export function loadTaskRegistryFromObject(data: unknown): TaskRegistry {
  const result = taskRegistrySchema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new TaskRegistryError(`Task registry validation failed: ${issues}`, result.error)
  }
  return result.data
}

export function filterTasksByCategory(
  registry: TaskRegistry,
  category: TaskDefinition['category'],
): TaskDefinition[] {
  return Object.values(registry).filter((task) => task.category === category)
}

export function filterTasksByDifficulty(
  registry: TaskRegistry,
  difficulty: TaskDefinition['difficulty'],
): TaskDefinition[] {
  return Object.values(registry).filter((task) => task.difficulty === difficulty)
}
