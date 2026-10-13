import {
  inspectToolOutput,
  inspectToolOutputFailure,
} from './tool-result-inspection'

import type { CommandExecutionMetadata } from '@savant-code/common/util/command-execution'

/** Denotes an unclassified cause, never a repaired class. */
export const TOOL_RESULT_ERROR_FALLBACK = 'tool result contains an error'

/**
 * FID-2026-1012-024: detection and extraction share the producer-shaped
 * walker. Batch errors, command exits and incomplete reads must reach
 * capture just as flat error fields do. Arbitrary user data is not scanned.
 */
export function hasToolResultError<T>(content: T): boolean {
  return extractToolResultError(content) !== ''
}

/** First failure in result order; no normalization at this boundary. */
export function extractToolResultError<T>(content: T): string {
  return inspectToolOutputFailure(content)
}

/** The fallback denotes an unclassified cause, never a repaired class. */
export function toolResultErrorLine<T>(content: T): string {
  return extractToolResultError(content) || TOOL_RESULT_ERROR_FALLBACK
}

/**
 * FID-2026-1012-023: one traversal for the failure line AND the identity of
 * the value that produced it, so the capture record can attribute a command
 * failure to the tool that was executed (the abort class named the callee in
 * its message while the record named the caller).
 */
export function inspectToolResultFailure<T>(content: T): {
  failed: boolean
  line: string
  commandExecution?: CommandExecutionMetadata
} {
  const { error, commandExecution } = inspectToolOutput(content)
  return {
    failed: error !== '',
    line: error || TOOL_RESULT_ERROR_FALLBACK,
    ...(commandExecution ? { commandExecution } : {}),
  }
}

/** Command verification and capture use the same outcome authority. */
export function hasCommandFailure<T>(content: T): boolean {
  return hasToolResultError(content)
}
