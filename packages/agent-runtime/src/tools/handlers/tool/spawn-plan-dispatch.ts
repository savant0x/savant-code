import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'

import { sourceContentDigest } from './spawn-plan'
import {
  artifactDigest,
  buildArtifactBlock,
  checkStepAcceptance,
} from './spawn-plan-acceptance'

import type { SpawnPlanStep } from './spawn-plan'
import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * FID-2026-1017-004 — dependency-ordered plan dispatch.
 *
 * Stages run in order behind the same aggregate barrier the batch path already
 * provides: the parent waits for the whole plan, no child is detached and no
 * wake-up API is introduced. Sources are re-hashed before each stage, so a file
 * that changes mid-plan invalidates the affected steps and their dependents
 * instead of being accepted against stale bytes.
 */

export type SpawnPlanRunStepResult = {
  agentState: AgentState
  output: JSONValue
  agentType: string
  agentName: string
}

export type SpawnPlanStepResult = {
  step: SpawnPlanStep
  status: 'accepted' | 'rejected' | 'cancelled'
  reason?: string
  value?: JSONValue
  digest?: string
  agentState?: AgentState
  creditsUsed: number
  agentType: string
  agentName: string
}

function creditsOf(value: object | null): number {
  if (value === null || !('agentState' in value)) return 0
  const state = value.agentState
  if (
    typeof state !== 'object' ||
    state === null ||
    !('creditsUsed' in state)
  ) {
    return 0
  }
  return typeof state.creditsUsed === 'number' ? state.creditsUsed : 0
}

function failureMessage(value: object | null): string {
  if (value === null) return 'Agent run failed.'
  if (value instanceof Error) return value.message
  if ('message' in value && typeof value.message === 'string') {
    return value.message
  }
  return 'Agent run failed.'
}

function dependentsOf(
  steps: readonly SpawnPlanStep[],
  stepId: string,
): SpawnPlanStep[] {
  return steps.filter((step) => step.dependsOn.includes(stepId))
}

export async function runSpawnPlan(params: {
  steps: readonly SpawnPlanStep[]
  stages: readonly (readonly SpawnPlanStep[])[]
  sources: ReadonlyMap<string, string>
  projectRoot: string
  readSource: (relativePath: string) => Promise<string>
  runStep: (
    step: SpawnPlanStep,
    prompt: string,
  ) => Promise<SpawnPlanRunStepResult>
  isAborted: () => boolean
}): Promise<SpawnPlanStepResult[]> {
  const { steps, stages, sources, projectRoot, readSource, runStep } = params
  const outcomes = new Map<string, SpawnPlanStepResult>()
  const artifacts = new Map<string, { block: string; digest: string }>()
  const blocked = new Map<
    string,
    { reason: string; status: 'rejected' | 'cancelled' }
  >()
  const remaining = new Set(steps.map((step) => step.id))

  const rejectStep = (
    step: SpawnPlanStep,
    reason: string,
    status: 'rejected' | 'cancelled' = 'rejected',
    creditsUsed = 0,
    agentState?: AgentState,
  ): void => {
    outcomes.set(step.id, {
      step,
      status,
      reason,
      ...(agentState === undefined ? {} : { agentState }),
      creditsUsed,
      agentType: step.agentType,
      agentName: step.agentType,
    })
    remaining.delete(step.id)
    for (const dependent of dependentsOf(steps, step.id)) {
      if (remaining.has(dependent.id) && !blocked.has(dependent.id)) {
        blocked.set(dependent.id, {
          reason: `Predecessor step "${step.id}" was ${status}: ${reason}`,
          status,
        })
      }
    }
  }

  for (const stage of stages) {
    // 1. A step whose predecessor failed is never dispatched.
    for (const step of stage) {
      const blockedStep = blocked.get(step.id)
      if (blockedStep !== undefined) {
        rejectStep(step, blockedStep.reason, blockedStep.status)
      }
    }

    if (remaining.size === 0) break

    // 2. Cancellation stops dispatch. Usage already incurred is retained
    //    because each result carries its own credit count.
    if (params.isAborted()) {
      for (const step of steps) {
        if (remaining.has(step.id)) {
          rejectStep(
            step,
            'Call was cancelled before this step dispatched.',
            'cancelled',
          )
        }
      }
      break
    }

    // 3. Re-hash every source the remaining steps claim. A changed source
    //    rejects its readers and every transitive dependent.
    const claimed = new Set<string>()
    for (const step of steps) {
      if (!remaining.has(step.id)) continue
      for (const source of step.sources) claimed.add(source)
    }
    const changed: string[] = []
    for (const source of claimed) {
      const expected = sources.get(source)
      if (expected === undefined) continue
      try {
        const current = await readSource(source)
        if (sourceContentDigest(current) !== sourceContentDigest(expected)) {
          changed.push(source)
        }
      } catch {
        changed.push(source)
      }
    }
    if (changed.length > 0) {
      for (const step of steps) {
        if (!remaining.has(step.id)) continue
        const changedSources = step.sources.filter((source) =>
          changed.includes(source),
        )
        if (changedSources.length > 0) {
          rejectStep(
            step,
            `Source changed during the plan: ${changedSources.join(', ')}`,
          )
        }
      }
      for (const step of stage) {
        const blockedStep = blocked.get(step.id)
        if (remaining.has(step.id) && blockedStep !== undefined) {
          rejectStep(step, blockedStep.reason, blockedStep.status)
        }
      }
      continue
    }

    // 4. Dispatch this stage's runnable steps together.
    const runnable = stage.filter((step) => remaining.has(step.id))
    if (runnable.length === 0) continue

    const settled = await Promise.allSettled(
      runnable.map((step) => {
        const blocks = step.dependsOn
          .map((dependency) => artifacts.get(dependency)?.block)
          .filter((block): block is string => block !== undefined)
        const prompt = [step.prompt ?? '', ...blocks]
          .filter((part) => part.trim().length > 0)
          .join('\n\n')
        return runStep(step, prompt)
      }),
    )

    const aborted = params.isAborted()
    runnable.forEach((step, index) => {
      const settledResult = settled[index]
      if (settledResult.status === 'fulfilled') {
        const result = settledResult.value
        const creditsUsed = result.agentState.creditsUsed || 0
        if (aborted) {
          rejectStep(
            step,
            'Call was cancelled while this step was running.',
            'cancelled',
            creditsUsed,
            result.agentState,
          )
          return
        }
        const value = safeToJSONValue(result.output)
        const digest = artifactDigest(value)
        const blocks = new Map<string, string>()
        for (const dependency of step.dependsOn) {
          const artifact = artifacts.get(dependency)
          if (artifact) blocks.set(dependency, artifact.block)
        }
        const issues = checkStepAcceptance({
          step,
          messages: result.agentState.messageHistory,
          sources,
          projectRoot,
          artifactBlocks: blocks,
        })
        if (issues.length > 0) {
          rejectStep(
            step,
            issues.join('; '),
            'rejected',
            creditsUsed,
            result.agentState,
          )
          return
        }
        outcomes.set(step.id, {
          step,
          status: 'accepted',
          value,
          digest,
          agentState: result.agentState,
          creditsUsed,
          agentType: result.agentType,
          agentName: result.agentName,
        })
        remaining.delete(step.id)
        artifacts.set(step.id, {
          block: buildArtifactBlock({
            stepId: step.id,
            digest,
            artifact: value,
          }),
          digest,
        })
        return
      }

      const reason = settledResult.reason
      const failure =
        reason !== null && typeof reason === 'object' ? reason : null
      rejectStep(
        step,
        failureMessage(failure),
        aborted ? 'cancelled' : 'rejected',
        failure === null ? 0 : creditsOf(failure),
      )
    })
  }

  // Every step must appear in the report exactly once.
  return steps.map((step) => {
    const outcome = outcomes.get(step.id)
    if (outcome) return outcome
    return {
      step,
      status: 'cancelled' as const,
      reason: 'Step did not resolve.',
      creditsUsed: 0,
      agentType: step.agentType,
      agentName: step.agentType,
    }
  })
}
