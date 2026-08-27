/**
 * FID-2026-0824-016/-018 production surface: the evals CLI `prove`
 * subcommand. Launches paired baseline/active trials through
 * `runSkillProve`, reusing ONLY existing machinery — `TempDirSandbox`,
 * `SavantAgentRunner`, and `DeterministicVerifier` — so a proof run measures
 * exactly what the benchmark measures (deterministic checks inside a
 * hardened tempdir, safe permission mode at the runner boundary).
 *
 * Exit semantics: 0 only when the artifact proves immutable eligibility
 * (`gate.eligible_for_immutable`). Any other outcome exits 1 so CI can gate
 * on it; every advisory detail still prints either way (A4 — the operator
 * decides, the exit code only reports evidence).
 */

import path from 'node:path'

import { loadLocalAgents } from '@savant-code/sdk'

import { loadTaskRegistry } from '../registry'
import { runSkillProve } from './skill-prove'
import { SavantAgentRunner } from '../runners/savant'
import { TempDirSandbox } from '../sandboxes/tempdir'
import { DeterministicVerifier } from '../verify'

import type { TaskDefinition } from '../schema'
import type { TrialRunResult } from './skill-prove'
import type { ZtapMode, SkillProofArtifact } from '../stats/skill-efficacy'
import type { AgentDefinition } from '@savant-code/sdk'

/** Repo-rooted agents dir (this file lives at <root>/evals/v2/src/prove). */
const AGENTS_PATH = path.resolve(
  import.meta.dir,
  '..',
  '..',
  '..',
  '..',
  'agents',
)

export interface ProveCliOptions {
  skillName: string
  taskId: string
  tasksDir: string
  /** Where `.savant/skill-proofs/<name>.json` lands. Default: cwd. */
  projectRoot: string
  /** Trials per arm (default 3; CI reserves larger N). */
  trialsPerArm: number
  /** Reliability exponent; defaults to trialsPerArm upstream when omitted. */
  k?: number
  ztapMode: ZtapMode
  apiKey?: string
  agentId: string
  maxAgentSteps?: number
}

export interface ProveCommandDeps {
  loadRegistry: (tasksDir: string) => Promise<Record<string, TaskDefinition>>
  loadAgentDefinitions: () => Promise<AgentDefinition[]>
  runProve: typeof runSkillProve
}

function intArg(flag: string, raw: string | undefined): number {
  const value = Number.parseInt(raw ?? '', 10)
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${flag} must be a positive integer, got '${raw ?? ''}'`)
  }
  return value
}

/** Parse + validate `prove` arguments. Throws on any malformed input. */
export function parseProveArgs(argv: string[]): ProveCliOptions {
  let skillName: string | undefined
  let taskId: string | undefined
  let tasksDir: string | undefined
  let projectRoot: string | undefined
  let trialsPerArm = 3
  let k: number | undefined
  let ztapMode: ZtapMode = 'record'
  let apiKey: string | undefined
  let agentId = 'savant'
  let maxAgentSteps: number | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--task':
        taskId = argv[++i]
        break
      case '--tasks-dir':
        tasksDir = argv[++i]
        break
      case '--project-root':
        projectRoot = argv[++i]
        break
      case '--trials':
        trialsPerArm = intArg('--trials', argv[++i])
        break
      case '--k':
        k = intArg('--k', argv[++i])
        break
      case '--ztap': {
        const raw = argv[++i]
        if (raw !== 'off' && raw !== 'record' && raw !== 'enforce') {
          throw new Error(
            `--ztap must be off|record|enforce, got '${raw ?? ''}'`,
          )
        }
        ztapMode = raw
        break
      }
      case '--api-key':
        apiKey = argv[++i]
        break
      case '--agent-id':
        agentId = argv[++i]
        break
      case '--max-steps':
        maxAgentSteps = intArg('--max-steps', argv[++i])
        break
      default:
        if (skillName === undefined && !arg.startsWith('--')) {
          skillName = arg
          break
        }
        throw new Error(`Unknown prove argument: ${arg}`)
    }
  }

  if (!skillName) {
    throw new Error(
      'usage: prove <skillName> --task <taskId> --tasks-dir <dir>',
    )
  }
  if (!taskId) {
    throw new Error('--task <taskId> is required')
  }
  if (!tasksDir) {
    throw new Error('--tasks-dir <path> is required')
  }

  return {
    skillName,
    taskId,
    tasksDir,
    projectRoot: projectRoot ?? process.cwd(),
    trialsPerArm,
    ...(k !== undefined ? { k } : {}),
    ztapMode,
    ...(apiKey !== undefined ? { apiKey } : {}),
    agentId,
    ...(maxAgentSteps !== undefined ? { maxAgentSteps } : {}),
  }
}

/**
 * Production trial runner over the EXISTING benchmark stack: hardened
 * tempdir sandbox + SDK runner + deterministic checks. One isolated trial
 * per invocation; teardown always runs (fail-fast propagates afterwards).
 */
function buildProductionTrialRunner(
  task: TaskDefinition,
  opts: ProveCliOptions,
  apiKey: string,
  agentDefinitions: AgentDefinition[],
): (trial: {
  arm: 'baseline' | 'active'
  index: number
}) => Promise<TrialRunResult> {
  return async ({ arm }) => {
    const sandbox = new TempDirSandbox({ prefix: `savant-prove-${arm}-` })
    const runner = new SavantAgentRunner()
    await sandbox.prepare()
    try {
      await runner.initialize({
        task,
        sandbox,
        apiKey,
        agentId: opts.agentId,
        agentDefinitions,
        maxAgentSteps: opts.maxAgentSteps,
      })
      await runner.executePrompt(task.inputs.prompt)
      const trace = runner.collectTrace()
      const verification = await new DeterministicVerifier(sandbox).verify(task)
      console.log(`[${arm}] verification: ${verification.status}`)
      return { exitOk: verification.passed, trace }
    } finally {
      await sandbox.teardown()
    }
  }
}

function printSummary(
  artifact: SkillProofArtifact,
  artifactPath: string,
): void {
  console.log('')
  console.log(`Artifact: ${artifactPath}`)
  console.log(`baseline pass rate : ${artifact.metrics.baseline_pass_rate}`)
  console.log(`active pass rate   : ${artifact.metrics.active_pass_rate}`)
  console.log(`skill lift         : ${artifact.metrics.skill_lift}`)
  console.log(
    `pass@${artifact.k} / pass^${artifact.k} : ${artifact.metrics.pass_at_k} / ${artifact.metrics.pass_pow_k}`,
  )
  console.log(`activation verified: ${artifact.activation_verified}`)
  if (artifact.erosion?.measured === true) {
    console.log(
      `erosion blocked    : ${String(artifact.erosion.blocked === true)}`,
    )
    for (const reason of artifact.erosion.reasons ?? []) {
      console.log(`  - ${reason}`)
    }
  }
  console.log(
    artifact.gate.eligible_for_immutable
      ? '✅ ELIGIBLE for immutable promotion (operator trust still required)'
      : '⚠️ NOT yet eligible for immutable promotion',
  )
}

/** Exit 0 only when the artifact proves immutable eligibility. */
export function determineProveExit(artifact: SkillProofArtifact): number {
  return artifact.gate.eligible_for_immutable === true ? 0 : 1
}

async function defaultLoadAgentDefinitions(): Promise<AgentDefinition[]> {
  const loaded = await loadLocalAgents({ agentsPath: AGENTS_PATH })
  return Object.values(loaded)
}

/**
 * Entry point for `bun run --cwd=evals prove <skillName> …`. Returns the
 * artifact path plus the process exit code; the caller applies the code.
 */
export async function runProveCommand(
  argv: string[],
  deps: ProveCommandDeps = {
    loadRegistry: loadTaskRegistry,
    loadAgentDefinitions: defaultLoadAgentDefinitions,
    runProve: runSkillProve,
  },
): Promise<{ artifactPath: string; exitCode: number }> {
  const opts = parseProveArgs(argv)
  const apiKey = opts.apiKey ?? process.env.SAVANT_CODE_API_KEY
  if (!apiKey) {
    throw new Error('prove requires --api-key or SAVANT_CODE_API_KEY')
  }

  const registry = await deps.loadRegistry(opts.tasksDir)
  const task: TaskDefinition | undefined = registry[opts.taskId]
  if (!task) {
    const known = Object.keys(registry).slice(0, 10).join(', ')
    throw new Error(
      `Unknown proof task '${opts.taskId}' in ${opts.tasksDir} (known: ${known})`,
    )
  }

  const agentDefinitions = await deps.loadAgentDefinitions()
  console.log(
    `Proving skill '${opts.skillName}' on task '${opts.taskId}' — ${opts.trialsPerArm} trial(s) per arm…`,
  )

  const { artifact, artifactPath } = await deps.runProve({
    skillName: opts.skillName,
    taskId: opts.taskId,
    projectRoot: opts.projectRoot,
    trialsPerArm: opts.trialsPerArm,
    ...(opts.k !== undefined ? { k: opts.k } : {}),
    ztapMode: opts.ztapMode,
    ...(opts.maxAgentSteps !== undefined
      ? { maxAgentSteps: opts.maxAgentSteps }
      : {}),
    runTrial: buildProductionTrialRunner(task, opts, apiKey, agentDefinitions),
  })

  printSummary(artifact, artifactPath)
  return { artifactPath, exitCode: determineProveExit(artifact) }
}
