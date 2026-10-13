import {
  HIDDEN_FILE_READ_STATUS,
  FILE_READ_STATUS,
} from '@savant-code/common/constants/paths'
import { commandExecutionMetadata } from '@savant-code/common/util/command-execution'

import type { CommandExecutionMetadata } from '@savant-code/common/util/command-execution'

const MAX_INSPECTION_DEPTH = 32
const MAX_INSPECTION_NODES = 4096
const INSPECTION_FAILURE = 'Tool result failure inspection could not complete'

interface InspectionState {
  nodes: number
  active: WeakSet<object>
}

/**
 * FID-2026-1012-023: one traversal, two projections. The failure text and the
 * command-execution identity belong to the SAME producer value, so reading
 * them in one walk is what keeps an abort attributed to the tool that was
 * executed rather than to the message that happens to name it.
 */
export interface ToolOutputInspection {
  /** First failure in producer result order; '' when every value is clean. */
  error: string
  /** Identity of the failing value, when it declares one. */
  commandExecution?: CommandExecutionMetadata
}

/** Inspect producer-owned result containers; arbitrary data is never scanned. */
export function inspectToolOutputFailure<T>(content: T): string {
  return inspectToolOutput(content).error
}

/** The same traversal, keeping the identity of the value that failed. */
export function inspectToolOutput<T>(content: T): ToolOutputInspection {
  try {
    if (!Array.isArray(content)) return { error: '' }
    const state: InspectionState = { nodes: 0, active: new WeakSet() }
    for (const part of content) {
      state.nodes += 1
      if (state.nodes > MAX_INSPECTION_NODES)
        return { error: INSPECTION_FAILURE }
      if (!part || typeof part !== 'object' || !('value' in part)) continue
      const inspection = inspectValue(part.value, state, 0)
      if (inspection.error) return inspection
    }
    return { error: '' }
  } catch {
    // A hostile accessor/proxy cannot abort the result lifecycle or turn an
    // uninspectable outcome into successful verification credit.
    return { error: INSPECTION_FAILURE }
  }
}

function inspectValue<T>(
  value: T,
  state: InspectionState,
  depth: number,
): ToolOutputInspection {
  state.nodes += 1
  if (depth > MAX_INSPECTION_DEPTH || state.nodes > MAX_INSPECTION_NODES) {
    return { error: INSPECTION_FAILURE }
  }
  if (!value || typeof value !== 'object') return { error: '' }
  if (state.active.has(value)) return { error: INSPECTION_FAILURE }
  state.active.add(value)
  try {
    if (Array.isArray(value)) {
      for (const item of value) {
        const inspection = inspectValue(item, state, depth + 1)
        if (inspection.error) return inspection
      }
      return { error: '' }
    }
    const scalar = scalarFailure(value)
    if (scalar) return { error: scalar, ...executionIdentityOf(value) }
    if ('results' in value && Array.isArray(value.results)) {
      return inspectValue(value.results, state, depth + 1)
    }
    return { error: '' }
  } finally {
    state.active.delete(value)
  }
}

/** Narrowed identity only — never a raw result, exception or payload. */
function executionIdentityOf(value: object): {
  commandExecution?: CommandExecutionMetadata
} {
  const commandExecution = commandExecutionMetadata(value)
  return Object.keys(commandExecution).length > 0 ? { commandExecution } : {}
}

function scalarFailure<T extends object>(value: T): string {
  if (
    'errorMessage' in value &&
    typeof value.errorMessage === 'string' &&
    value.errorMessage
  ) {
    return value.errorMessage
  }
  if ('error' in value && typeof value.error === 'string' && value.error)
    return value.error
  if (
    'errorCode' in value &&
    typeof value.errorCode === 'string' &&
    value.errorCode
  ) {
    return value.errorCode
  }
  if (
    'exitCode' in value &&
    typeof value.exitCode === 'number' &&
    value.exitCode !== 0
  ) {
    const detail =
      'stderr' in value && typeof value.stderr === 'string' ? value.stderr : ''
    return `Command exited with code ${value.exitCode}${detail ? `: ${detail}` : ''}`
  }
  if (
    'path' in value &&
    typeof value.path === 'string' &&
    'content' in value &&
    typeof value.content === 'string'
  ) {
    return readFailure(value.content)
  }
  return ''
}

function readFailure(content: string): string {
  const status = HIDDEN_FILE_READ_STATUS.find((marker) =>
    content.startsWith(marker),
  )
  if (status) return `File read did not complete: ${status}`
  if (/\n\n\[FILE_TOO_LARGE:[^\]]*\]\s*$/.test(content)) {
    return `File read did not complete: ${FILE_READ_STATUS.TOO_LARGE}`
  }
  return ''
}
