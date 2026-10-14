import {
  HIDDEN_FILE_READ_STATUS,
  FILE_READ_STATUS,
} from '@savant-code/common/constants/paths'
import { commandExecutionMetadata } from '@savant-code/common/util/command-execution'

import type { ExperienceExpectedness } from '@savant-code/common/types/experience'
import type { CommandExecutionMetadata } from '@savant-code/common/util/command-execution'

/**
 * A validation refusal reported through the command envelope. The prefix is
 * required and anchored, so a real exit whose stderr merely quotes the phrase is
 * still rendered as an exit (FID-2026-1012-024).
 */
const REFUSAL_SIGNATURE = /^run_readonly_command rejected: /

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
  /**
   * FID-2026-1012-024 Loop 12: the classification the harness itself
   * established for the failing value — present only where the failure IS a
   * validation decision (a guard refusal), never inferred from the message.
   */
  expectedness?: ExperienceExpectedness
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
    if (scalar)
      return {
        error: scalar.line,
        ...executionIdentityOf(value),
        ...(scalar.expectedness ? { expectedness: scalar.expectedness } : {}),
      }
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

/** A failure line plus the classification its own branch establishes. */
interface ScalarFailure {
  line: string
  expectedness?: ExperienceExpectedness
}

function scalarFailure<T extends object>(value: T): ScalarFailure | undefined {
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
    // FID-2026-1012-024: a guard refusal never executed anything, so it is not
    // an execution outcome. The producer declares it on its own channel; a
    // refusal is the declaration itself, never "Command exited with code 1".
    // FID-2026-1012-024 Loop 12: the same declaration is the one place the
    // harness states that this outcome is a deliberate decision rather than a
    // defect, so it is also where `expected` is assigned. Nothing else in this
    // walker classifies an outcome, and no message text is matched for it.
    if (REFUSAL_SIGNATURE.test(detail))
      return { line: detail, expectedness: 'expected' }
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
