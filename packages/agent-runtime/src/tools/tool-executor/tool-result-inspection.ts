import {
  HIDDEN_FILE_READ_STATUS,
  FILE_READ_STATUS,
} from '@savant-code/common/constants/paths'
import { commandExecutionMetadata } from '@savant-code/common/util/command-execution'

import type { ExperienceExpectedness } from '@savant-code/common/types/experience'
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
export interface ToolOutputFailure {
  /** First failure in producer result order; '' when every value is clean. */
  error: string
  /** Identity of the failing value, when it declares one. */
  commandExecution?: CommandExecutionMetadata
  expectedness?: ExperienceExpectedness
}

export interface ToolOutputInspection extends ToolOutputFailure {
  /** Every producer failure, retained so a refusal cannot hide a later failure. */
  failures: readonly ToolOutputFailure[]
}

/** Inspect producer-owned result containers; arbitrary data is never scanned. */
export function inspectToolOutputFailure<T>(content: T): string {
  return inspectToolOutput(content).error
}

/** The same traversal, keeping the identity of the value that failed. */
export function inspectToolOutput<T>(content: T): ToolOutputInspection {
  try {
    if (!Array.isArray(content)) return { error: '', failures: [] }
    const state: InspectionState = { nodes: 0, active: new WeakSet() }
    const failures: ToolOutputFailure[] = []
    for (const part of content) {
      state.nodes += 1
      if (state.nodes > MAX_INSPECTION_NODES) {
        failures.push({ error: INSPECTION_FAILURE })
        break
      }
      if (!part || typeof part !== 'object' || !('value' in part)) continue
      failures.push(...inspectValue(part.value, state, 0))
    }
    return inspectionFromFailures(failures)
  } catch {
    // A hostile accessor/proxy cannot abort the result lifecycle or turn an
    // uninspectable outcome into successful verification credit.
    return inspectionFromFailures([{ error: INSPECTION_FAILURE }])
  }
}

/** Read every failure while preserving the existing first-failure projection. */
export function inspectToolOutputFailures<T>(
  content: T,
): readonly ToolOutputFailure[] {
  return inspectToolOutput(content).failures
}

function inspectValue<T>(
  value: T,
  state: InspectionState,
  depth: number,
): ToolOutputFailure[] {
  state.nodes += 1
  if (depth > MAX_INSPECTION_DEPTH || state.nodes > MAX_INSPECTION_NODES) {
    return [{ error: INSPECTION_FAILURE }]
  }
  if (!value || typeof value !== 'object') return []
  if (state.active.has(value)) return [{ error: INSPECTION_FAILURE }]
  state.active.add(value)
  try {
    if (Array.isArray(value)) {
      return inspectArray(value, state, depth + 1)
    }
    const execution = executionIdentityOf(value)
    const scalar = scalarFailure(value, execution.commandExecution)
    const failures: ToolOutputFailure[] = []
    if (scalar) {
      const expectedness = harnessExpectednessOf(execution.commandExecution)
      failures.push({
        error: scalar.line,
        ...execution,
        ...(expectedness ? { expectedness } : {}),
      })
    }
    if ('results' in value && Array.isArray(value.results)) {
      failures.push(...inspectValue(value.results, state, depth + 1))
    }
    return failures
  } finally {
    state.active.delete(value)
  }
}

/** Stop before reading the next array value once the global budget is spent. */
function inspectArray<T>(
  values: readonly T[],
  state: InspectionState,
  depth: number,
): ToolOutputFailure[] {
  const failures: ToolOutputFailure[] = []
  for (let index = 0; index < values.length; index += 1) {
    if (state.nodes >= MAX_INSPECTION_NODES) {
      failures.push({ error: INSPECTION_FAILURE })
      break
    }
    failures.push(...inspectValue(values[index], state, depth))
  }
  return failures
}

function inspectionFromFailures(
  failures: readonly ToolOutputFailure[],
): ToolOutputInspection {
  const first = failures[0]
  return first ? { ...first, failures } : { error: '', failures }
}

function harnessExpectednessOf(
  metadata: CommandExecutionMetadata | undefined,
): ExperienceExpectedness | undefined {
  return metadata?.executionOutcome === 'rejected' &&
    metadata.rejectionReason === 'readonly-guard'
    ? 'expected'
    : undefined
}

/** Narrowed identity only — never a raw result, exception or payload. */
function executionIdentityOf(value: object): {
  commandExecution?: CommandExecutionMetadata
} {
  const commandExecution = commandExecutionMetadata(value)
  return Object.keys(commandExecution).length > 0 ? { commandExecution } : {}
}

/** A failure line plus the classification its own branch establishes. */
interface ScalarFailure {
  line: string
}

function scalarFailure<T extends object>(
  value: T,
  commandExecution?: CommandExecutionMetadata,
): ScalarFailure | undefined {
  if (
    'errorMessage' in value &&
    typeof value.errorMessage === 'string' &&
    value.errorMessage
  ) {
    return { line: value.errorMessage }
  }
  if ('error' in value && typeof value.error === 'string' && value.error)
    return { line: value.error }
  if (
    'errorCode' in value &&
    typeof value.errorCode === 'string' &&
    value.errorCode
  ) {
    return { line: value.errorCode }
  }
  if (
    'exitCode' in value &&
    typeof value.exitCode === 'number' &&
    value.exitCode !== 0
  ) {
    const detail =
      'stderr' in value && typeof value.stderr === 'string' ? value.stderr : ''
    if (
      commandExecution?.executionOutcome === 'rejected' &&
      commandExecution.rejectionReason === 'readonly-guard' &&
      detail
    )
      return { line: detail }
    return {
      line: `Command exited with code ${value.exitCode}${detail ? `: ${detail}` : ''}`,
    }
  }
  if (
    'path' in value &&
    typeof value.path === 'string' &&
    'content' in value &&
    typeof value.content === 'string'
  ) {
    const read = readFailure(value.content)
    return read === '' ? undefined : { line: read }
  }
  return undefined
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
