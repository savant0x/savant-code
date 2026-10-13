import { inspectToolOutputFailure } from './tool-result-inspection'

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
  return extractToolResultError(content) || 'tool result contains an error'
}

/** Command verification and capture use the same outcome authority. */
export function hasCommandFailure<T>(content: T): boolean {
  return hasToolResultError(content)
}
