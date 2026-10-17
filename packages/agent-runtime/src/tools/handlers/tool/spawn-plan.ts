import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'

import { sha256 } from '@savant-code/common/util/hash'

import type { JSONValue } from '@savant-code/common/types/json'

/**
 * FID-2026-1017-004 — the host-owned research plan.
 *
 * The model may propose a plan; this module decides whether it may run. Every
 * rule here either pins a fact (source bytes, snapshot identity, step ids,
 * dependency order) or denies authority (write scope, non-research roles,
 * output ceilings, stale turn identity). Nothing in the plan can add a tool:
 * the schema has no field for one, and role tools come from the agent
 * template.
 */
export type SpawnPlanSource = { path: string; sha256: string }

export type SpawnPlanInput = {
  objective: string
  cancellation_id: string
  snapshot_sha256: string
  max_output_tokens?: number
  sources: SpawnPlanSource[]
}

export type SpawnPlanAgentInput = {
  agent_type: string
  prompt?: string
  params?: Record<string, JSONValue>
  writeScope?: string[]
  id?: string
  sources?: string[]
  depends_on?: string[]
}

export type SpawnPlan = {
  objective: string
  cancellationId: string
  snapshotSha256: string
  maxOutputTokens: number | undefined
  sources: readonly SpawnPlanSource[]
}

export type SpawnPlanStep = {
  id: string
  agentType: string
  prompt: string | undefined
  spawnParams: Record<string, JSONValue> | undefined
  sources: readonly string[]
  dependsOn: readonly string[]
  declaredIndex: number
}

export type SpawnPlanDeps = {
  projectRoot: string | undefined
  userInputId: string
  maxOutputTokens: number | undefined
  maxFanOut: number
  /** Injected for tests; defaults to a real project-root reader. */
  readSource?: (relativePath: string) => Promise<string>
}

export type SpawnPlanValidation =
  | {
      ok: true
      plan: SpawnPlan
      steps: readonly SpawnPlanStep[]
      stages: readonly (readonly SpawnPlanStep[])[]
      /** Captured bytes, keyed by normalized path. */
      sources: ReadonlyMap<string, string>
    }
  | { ok: false; issues: readonly string[] }

/**
 * Read-only research roles. Implementation (forge), audit (verifier,
 * adversary), bookkeeping (recorder, scribe) and effectful helpers (basher,
 * tmux-cli, browser-use, database, github) are deliberately absent: a research
 * plan must not repurpose them. The canonical roster keeps its own contracts.
 */
export const RESEARCH_PLAN_ROLES: ReadonlySet<string> = new Set([
  'detective',
  'scout',
  'researcher',
  'researcher-web',
  'researcher-docs',
  'thinker',
  'code-searcher',
  'file-picker',
  'file-explorer',
  'librarian',
])

export const MAX_PLAN_SOURCES = 64

/**
 * Normalize a declared plan path. Returns `null` for anything that could
 * escape the project root or name a different filesystem object: absolute
 * paths, drive letters, empty/dot/dot-dot segments.
 */
export function normalizePlanPath(value: string): string | null {
  const slashed = value.replaceAll('\\', '/')
  if (slashed.length === 0) return null
  if (slashed.startsWith('/')) return null
  if (/^[a-zA-Z]:/.test(slashed)) return null
  const segments = slashed.split('/')
  if (
    segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    )
  )
    return null
  return segments.join('/')
}

/** Source identity is line-ending independent: CRLF is normalized to LF. */
export function sourceContentDigest(content: string): string {
  return sha256(content.replaceAll('\r\n', '\n'))
}

/**
 * The snapshot binds the declared list, not the filesystem: sorted
 * `path\nhash\n` lines. A caller cannot add, drop or reorder a source without
 * changing this digest.
 */
export function snapshotDigest(sources: readonly SpawnPlanSource[]): string {
  const lines = [...sources]
    .map((source) => ({
      path: normalizePlanPath(source.path) ?? source.path,
      sha256: source.sha256,
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((source) => `${source.path}\n${source.sha256}\n`)
  return sha256(lines.join(''))
}

/** Stable JSON for digest + delivery checks: object keys are sorted. */
export function canonicalJson(value: JSONValue): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function assertInsideRoot(
  root: string,
  candidate: string,
  label: string,
): void {
  const relative = path.relative(root, candidate)
  if (relative === '') return
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Plan source escapes the project root: ${label}`)
  }
}

/**
 * Real project reader: lexical normalization, resolved-path containment and a
 * real-path containment check so a symlink cannot substitute an outside file.
 */
export function createProjectSourceReader(
  projectRoot: string,
): (relativePath: string) => Promise<string> {
  const root = path.resolve(projectRoot)
  return async (relativePath: string): Promise<string> => {
    const normalized = normalizePlanPath(relativePath)
    if (normalized === null) {
      throw new Error(`Unsafe plan source path: ${relativePath}`)
    }
    const absolute = path.resolve(root, normalized)
    assertInsideRoot(root, absolute, relativePath)
    const realRoot = await realpath(root)
    const realFile = await realpath(absolute)
    assertInsideRoot(realRoot, realFile, relativePath)
    return readFile(realFile, 'utf8')
  }
}

function normalizeDeclaredSources(
  sources: readonly SpawnPlanSource[],
  issues: string[],
): Map<string, string> {
  const declared = new Map<string, string>()
  for (const source of sources) {
    const normalized = normalizePlanPath(source.path)
    if (normalized === null) {
      issues.push(`Unsafe plan source path: ${source.path}`)
      continue
    }
    if (declared.has(normalized)) {
      issues.push(`Duplicate plan source: ${normalized}`)
      continue
    }
    declared.set(normalized, source.sha256)
  }
  return declared
}

export async function validateSpawnPlan(params: {
  plan: SpawnPlanInput
  agents: readonly SpawnPlanAgentInput[]
  deps: SpawnPlanDeps
}): Promise<SpawnPlanValidation> {
  const { plan, agents, deps } = params
  const issues: string[] = []

  if (plan.objective.trim().length === 0) {
    issues.push('Plan objective is empty.')
  }
  if (plan.cancellation_id !== deps.userInputId) {
    issues.push(
      `Plan cancellation_id "${plan.cancellation_id}" does not match this turn ("${deps.userInputId}"); a stale plan is rejected.`,
    )
  }
  if (!deps.projectRoot) {
    issues.push(
      'A research plan requires a project root to verify source bytes.',
    )
  }
  if (plan.sources.length === 0) {
    issues.push('A research plan must declare at least one source.')
  }
  if (plan.sources.length > MAX_PLAN_SOURCES) {
    issues.push(
      `A research plan may declare at most ${MAX_PLAN_SOURCES} sources.`,
    )
  }
  if (agents.length === 0) {
    issues.push('A research plan must declare at least one step.')
  }
  if (agents.length > deps.maxFanOut) {
    issues.push(
      `A research plan may declare at most ${deps.maxFanOut} steps (fan-out limit).`,
    )
  }
  if (
    plan.max_output_tokens !== undefined &&
    deps.maxOutputTokens !== undefined &&
    plan.max_output_tokens > deps.maxOutputTokens
  ) {
    issues.push(
      `Plan max_output_tokens (${plan.max_output_tokens}) exceeds the run's resolved budget (${deps.maxOutputTokens}).`,
    )
  }

  const declared = normalizeDeclaredSources(plan.sources, issues)

  const captured = new Map<string, string>()
  if (deps.projectRoot && declared.size > 0) {
    const readSource =
      deps.readSource ?? createProjectSourceReader(deps.projectRoot)
    for (const [sourcePath, expected] of declared) {
      try {
        const content = await readSource(sourcePath)
        if (sourceContentDigest(content) !== expected) {
          issues.push(`Source hash mismatch: ${sourcePath}`)
          continue
        }
        captured.set(sourcePath, content)
      } catch {
        issues.push(`Source unreadable: ${sourcePath}`)
      }
    }
  }

  const expectedSnapshot = snapshotDigest(plan.sources)
  if (expectedSnapshot !== plan.snapshot_sha256) {
    issues.push(
      'Plan snapshot_sha256 does not match its declared sources (sorted path/hash lines).',
    )
  }

  const steps: SpawnPlanStep[] = []
  const byId = new Map<string, SpawnPlanStep>()

  agents.forEach((agent, index) => {
    const id = typeof agent.id === 'string' ? agent.id.trim() : ''
    if (id.length === 0) {
      issues.push(`Step ${index + 1} has no id (required with a plan).`)
      return
    }
    if (byId.has(id)) {
      issues.push(`Duplicate plan step id: ${id}`)
      return
    }

    if (!Array.isArray(agent.sources)) {
      issues.push(`Step ${id} has no sources array (required with a plan).`)
    }
    if (!Array.isArray(agent.depends_on)) {
      issues.push(`Step ${id} has no depends_on array (required with a plan).`)
    }
    if (agent.writeScope !== undefined && agent.writeScope.length > 0) {
      issues.push(`Step ${id} requests write scope; plan steps are read-only.`)
    }
    if (!RESEARCH_PLAN_ROLES.has(agent.agent_type)) {
      issues.push(
        `Step ${id} uses role "${agent.agent_type}", which is not a read-only research role.`,
      )
    }

    const stepSources: string[] = []
    for (const source of agent.sources ?? []) {
      const normalized = normalizePlanPath(source)
      if (normalized === null) {
        issues.push(`Step ${id} has an unsafe source path: ${source}`)
        continue
      }
      if (!declared.has(normalized)) {
        issues.push(`Step ${id} reads an undeclared source: ${normalized}`)
        continue
      }
      stepSources.push(normalized)
    }

    const step = {
      id,
      agentType: agent.agent_type,
      prompt: agent.prompt,
      spawnParams: agent.params,
      sources: stepSources,
      dependsOn: [] as string[],
      declaredIndex: index,
    }

    // Dependencies may only name an EARLIER step. That keeps dispatch a single
    // forward pass and makes "every edge names a real predecessor" checkable
    // without a cycle search.
    for (const dependency of new Set(agent.depends_on ?? [])) {
      if (!byId.has(dependency)) {
        issues.push(
          `Step ${id} depends on "${dependency}", which is not an earlier declared step.`,
        )
        continue
      }
      step.dependsOn.push(dependency)
    }

    steps.push(step)
    byId.set(id, step)
  })

  if (issues.length > 0) return { ok: false, issues }

  const stages = buildStages(steps)
  return {
    ok: true,
    plan: {
      objective: plan.objective,
      cancellationId: plan.cancellation_id,
      snapshotSha256: plan.snapshot_sha256,
      maxOutputTokens: plan.max_output_tokens,
      sources: [...plan.sources],
    },
    steps,
    stages,
    sources: captured,
  }
}

/**
 * One deterministic forward pass: a step's stage is one past its deepest
 * dependency. Declaration order is preserved inside a stage.
 */
export function buildStages(
  steps: readonly SpawnPlanStep[],
): SpawnPlanStep[][] {
  const stageOf = new Map<string, number>()
  const stages: SpawnPlanStep[][] = []
  for (const step of steps) {
    let stage = 0
    for (const dependency of step.dependsOn) {
      const dependencyStage = stageOf.get(dependency)
      if (dependencyStage !== undefined) {
        stage = Math.max(stage, dependencyStage + 1)
      }
    }
    stageOf.set(step.id, stage)
    const bucket = (stages[stage] ??= [])
    bucket.push(step)
  }
  return stages
}
