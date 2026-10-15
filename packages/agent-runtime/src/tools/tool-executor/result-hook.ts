import { resolveToolFailureExpectedness } from './tool-result-errors'
import { inspectToolOutputFailures } from './tool-result-inspection'
import { buildHookInput, getHookEngine } from '../../hooks/engine'

import type { JSONValue } from '@savant-code/common/types/json'

/**
 * PostToolUse/Failure observation is kept outside the main lifecycle so the
 * materialization and enforcement path stays below the repository's file limit.
 */
export function emitToolResultHook(params: {
  hookProjectRoot: string
  signal?: AbortSignal
  sessionId: string
  toolName: string
  toolInput: Record<string, JSONValue>
  toolResult: JSONValue
}): void {
  const failures = inspectToolOutputFailures(params.toolResult)
  const failure =
    failures.find(
      (candidate) =>
        resolveToolFailureExpectedness({
          signal: params.signal,
          commandExecution: candidate.commandExecution,
          harnessExpectedness: candidate.expectedness,
        }) !== 'expected',
    ) ?? failures[0]
  const expectedness = failure
    ? resolveToolFailureExpectedness({
        signal: params.signal,
        commandExecution: failure.commandExecution,
        harnessExpectedness: failure.expectedness,
      })
    : undefined
  getHookEngine(params.hookProjectRoot).fireAndForgetTrigger(
    buildHookInput({
      event: failure ? 'PostToolUseFailure' : 'PostToolUse',
      sessionId: params.sessionId,
      cwd: params.hookProjectRoot,
      toolName: params.toolName,
      toolInput: params.toolInput,
      toolResult: params.toolResult,
      ...(failure ? { errorMessage: failure.error } : {}),
      ...(failure?.commandExecution
        ? { commandExecution: failure.commandExecution }
        : {}),
      ...(expectedness ? { expectedness } : {}),
    }),
  )
}
