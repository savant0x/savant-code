import {
  toLogValue,
  safeToJSONValue,
} from '@savant-code/common/util/type-narrowing'

import { deserializeHandleSteps } from './deserialize'
import { getStoredGenerator, storeGenerator } from './state'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { HandleStepsLogChunkFn } from '@savant-code/common/types/contracts/client'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { AgentState } from '@savant-code/common/types/session-state'

// FID-2026-0819-005 Loop 156: the generator-creation phase of
// runProgrammaticStep, extracted verbatim from run-programmatic-step.ts.
// Returns the existing stored generator, or creates + stores a fresh one.

/**
 * Run with either a generator or a sandbox: return the generator stored for
 * this run, or initialize one from the template's handleSteps (preferring
 * the live function over a deserialized string).
 */
export function ensureProgrammaticGenerator(params: {
  runId: string
  agentState: AgentState
  prompt: string | undefined
  toolCallParams: Record<string, JSONValue> | undefined
  template: Pick<AgentTemplate, 'id' | 'handleSteps' | 'handleStepsFn'>
  logger: Logger
  handleStepsLogChunk: HandleStepsLogChunkFn
}): NonNullable<ReturnType<typeof getStoredGenerator>> {
  const {
    runId,
    agentState,
    prompt,
    toolCallParams,
    template,
    logger,
    handleStepsLogChunk,
  } = params

  const existing = getStoredGenerator(runId)
  if (existing) return existing

  const createLogMethod =
    (level: 'debug' | 'info' | 'warn' | 'error') =>
    (data: unknown, msg?: string) => {
      const logValue = toLogValue(data)
      const jsonValue = safeToJSONValue(data)
      logger[level](logValue, msg) // Log to backend
      handleStepsLogChunk({
        userInputId: '',
        runId,
        level,
        data: jsonValue,
        message: msg,
      })
    }

  const streamingLogger = {
    debug: createLogMethod('debug'),
    info: createLogMethod('info'),
    warn: createLogMethod('warn'),
    error: createLogMethod('error'),
  }

  // Prefer the live function when present: the stringified form of a
  // bundled function can reference out-of-scope bundler helpers (esbuild
  // keepNames' `__name`, minified to a bare identifier), which makes the
  // eval'd generator throw ReferenceError on its first step.
  const generatorFn =
    template.handleStepsFn ??
    (typeof template.handleSteps === 'string'
      ? deserializeHandleSteps(template.handleSteps)
      : template.handleSteps)
  if (!generatorFn) {
    throw new Error(`No step handler found for agent template ${template.id}`)
  }

  const generator = generatorFn({
    agentState,
    prompt,
    params: toolCallParams,
    logger: streamingLogger,
  })

  storeGenerator(runId, generator)
  return generator
}
