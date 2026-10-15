import { clearProposedContentForRun } from '../tools/handlers/tool/proposed-content-store'

import type { StepGenerator } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'

// Maintains generator state for all agents. Generator state can't be serialized, so we store it in memory.
const runIdToGenerator: Record<string, StepGenerator | undefined> = {}
export const runIdToStepAll: Set<string> = new Set()

export function getStoredGenerator(runId: string): StepGenerator | undefined {
  return runIdToGenerator[runId]
}

export function storeGenerator(runId: string, generator: StepGenerator): void {
  runIdToGenerator[runId] = generator
}

// Function to clear the generator cache for testing purposes
export function clearAgentGeneratorCache(params: { logger: Logger }) {
  for (const key in runIdToGenerator) {
    clearProposedContentForRun(key)
    delete runIdToGenerator[key]
  }
  runIdToStepAll.clear()
}

/**
 * Release all module-level state held for a run: the handleSteps generator
 * (whose closure retains the full agent state and message history), the
 * STEP_ALL flag, and any proposed file content. Safe to call for runs with
 * no programmatic state. Must run whenever a run's loop exits — including
 * abort and error paths, not just endTurn — or the state leaks for the
 * lifetime of the process.
 */
export function clearProgrammaticRunState(runId: string): void {
  delete runIdToGenerator[runId]
  runIdToStepAll.delete(runId)
  clearProposedContentForRun(runId)
}

/**
 * Test isolation: clears every run's generator handle and STEP_ALL flag —
 * process-lifetime state `bun test` shares across files (FID-2026-1007-002).
 */
export function resetRunProgrammaticStepState(): void {
  for (const key in runIdToGenerator) {
    delete runIdToGenerator[key]
  }
  runIdToStepAll.clear()
}
