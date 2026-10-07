/** Production paired-trial runner for the on-demand skill proof command. */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { SavantAgentRunner } from '../runners/savant'
import { TempDirSandbox } from '../sandboxes/tempdir'
import {
  behavioralGradePrompt,
  parseBehavioralGrade,
} from '../skill-evals/behavioral'
import { DeterministicVerifier } from '../verify'
import { prepareProofArm } from './prepare-proof-arm'
import { restrictedExecutionAgentDefinitions } from './restricted-execution-agent'

import type { TrialRunResult } from './skill-prove'
import type { TaskDefinition } from '../schema'
import type { BehavioralCase } from '@savant-code/common/util/skill-trigger-cases'
import type { AgentDefinition } from '@savant-code/sdk'

/**
 * One isolated trial. Behavioral agent time, grading, verification, and setup
 * are bounded; teardown runs for both success and failure.
 */
export function buildProductionTrialRunner(
  task: TaskDefinition,
  opts: {
    projectRoot: string
    skillName: string
    agentId: string
    maxAgentSteps?: number
  },
  agentDefinitions: AgentDefinition[],
  behavioral: BehavioralCase,
  judge: (prompt: string, signal: AbortSignal) => Promise<string>,
): (trial: {
  arm: 'baseline' | 'active'
  index: number
}) => Promise<TrialRunResult> {
  return async ({ arm }) => {
    const sandbox = new TempDirSandbox({ prefix: `savant-prove-${arm}-` })
    const runner = new SavantAgentRunner()
    try {
      const skillsDir = await prepareProofArm(sandbox, task, opts, arm)
      const execution = behavioral.kind === 'execution'
      await runner.initialize({
        task,
        sandbox,
        agentId: opts.agentId,
        agentDefinitions: execution
          ? restrictedExecutionAgentDefinitions(agentDefinitions, opts.agentId)
          : agentDefinitions,
        maxAgentSteps: opts.maxAgentSteps,
        skillsDir,
        ...(execution ? { permissionMode: 'unsafe' as const } : {}),
      })
      await runner.executePrompt(
        behavioral.prompt,
        AbortSignal.timeout(task.validation.timeout_seconds * 1000),
      )
      const trace = runner.collectTrace()
      const verification = await new DeterministicVerifier(sandbox).verify(task)
      const finalFiles: Record<string, string> = {}
      for (const file of behavioral.files) {
        const resolved = path.resolve(sandbox.getWorkingDir(), file)
        const relative = path.relative(sandbox.getWorkingDir(), resolved)
        if (relative.startsWith('..') || path.isAbsolute(relative))
          throw new Error(
            `Behavioral output path escapes proof workspace: ${file}`,
          )
        try {
          finalFiles[file] = await readFile(resolved, 'utf8')
        } catch {
          finalFiles[file] = '<missing or unreadable>'
        }
      }
      const gradePrompt = behavioralGradePrompt(
        behavioral,
        trace,
        {
          status: verification.status,
          checks: verification.checks.map((check) => ({
            command: check.command,
            status: check.status,
          })),
        },
        finalFiles,
      )
      const rawGrade = await judge(gradePrompt, AbortSignal.timeout(180_000))
      const grade = parseBehavioralGrade(rawGrade, behavioral)
      console.log(`[${arm}] verification: ${verification.status}`)
      return {
        exitOk: verification.passed && grade.passed,
        trace,
        expectationResults: grade.results,
      }
    } finally {
      await sandbox.teardown()
    }
  }
}
