import { z } from 'zod/v4'

export const DEFAULT_COMMAND_TIMEOUT_SECONDS = 30
export const SESSION_INIT_TIMEOUT_MS = 10_000
export const MAX_TIMER_MS = 2_147_483_647
export const MAX_COMMAND_TIMEOUT_SECONDS = MAX_TIMER_MS / 1000

export const COMMAND_EXECUTION_OUTCOMES = [
  'completed',
  'timed-out',
  'cancelled',
  'rejected',
] as const
export const COMMAND_TERMINATION_STATES = [
  'requested',
  'completed',
  'not-started',
  'unavailable',
] as const
/**
 * ONE schema for the identity of a command execution (FID-2026-1012-023): the
 * public tool output, the capture hook payload and the experience record all
 * reference this definition, so a field can never exist in one and be dropped
 * by another.
 */
export const commandExecutionMetadataSchema = z.object({
  executionOutcome: z.enum(COMMAND_EXECUTION_OUTCOMES).optional(),
  executionStarted: z.boolean().optional(),
  callerToolName: z.string().optional(),
  executedToolName: z.string().optional(),
  delegateToolName: z.string().optional(),
  terminationState: z.enum(COMMAND_TERMINATION_STATES).optional(),
  timeoutSeconds: z.number().optional(),
})

export type CommandExecutionMetadata = z.infer<
  typeof commandExecutionMetadataSchema
>

/** Copy only narrowed metadata, never a raw result or exception. */
export function commandExecutionMetadata<T>(
  value: T,
): CommandExecutionMetadata {
  if (!value || typeof value !== 'object') return {}
  const metadata: CommandExecutionMetadata = {}
  if ('executionOutcome' in value)
    metadata.executionOutcome = COMMAND_EXECUTION_OUTCOMES.find(
      (outcome) => outcome === value.executionOutcome,
    )
  if ('terminationState' in value)
    metadata.terminationState = COMMAND_TERMINATION_STATES.find(
      (state) => state === value.terminationState,
    )
  if (
    'executionStarted' in value &&
    typeof value.executionStarted === 'boolean'
  )
    metadata.executionStarted = value.executionStarted
  if ('callerToolName' in value && typeof value.callerToolName === 'string')
    metadata.callerToolName = value.callerToolName
  if ('executedToolName' in value && typeof value.executedToolName === 'string')
    metadata.executedToolName = value.executedToolName
  if ('delegateToolName' in value && typeof value.delegateToolName === 'string')
    metadata.delegateToolName = value.delegateToolName
  if (
    'timeoutSeconds' in value &&
    typeof value.timeoutSeconds === 'number' &&
    Number.isFinite(value.timeoutSeconds)
  )
    metadata.timeoutSeconds = value.timeoutSeconds
  return metadata
}

/** -1 is the sole explicit infinite timeout; timers must fit the runtime's range. */
export function isValidCommandTimeoutSeconds(value: number): boolean {
  return (
    value === -1 ||
    (Number.isFinite(value) &&
      value >= 0 &&
      value <= MAX_COMMAND_TIMEOUT_SECONDS)
  )
}

export function validateCommandTimeoutSeconds(value: number): void {
  if (!isValidCommandTimeoutSeconds(value)) {
    throw new RangeError(
      `Invalid timeout_seconds: use -1 for no timeout, or a finite value between 0 and ${MAX_COMMAND_TIMEOUT_SECONDS} seconds.`,
    )
  }
}

/** Session initialization remains bounded; it has no infinite-timeout mode. */
export function validateSessionInitBounds(
  timeoutMs: number,
  maxBufferBytes: number,
): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > MAX_TIMER_MS)
    throw new RangeError(
      'Invalid session-init timeout: use a finite nonnegative millisecond budget within the timer range.',
    )
  if (!Number.isSafeInteger(maxBufferBytes) || maxBufferBytes < 0)
    throw new RangeError(
      'Invalid session-init output bound: use a nonnegative safe integer.',
    )
}

export class CommandTimeoutError
  extends Error
  implements CommandExecutionMetadata
{
  readonly executionOutcome = 'timed-out'
  constructor(
    readonly timeoutSeconds: number,
    readonly executedToolName = 'run_terminal_command',
    readonly executionStarted = true,
    readonly terminationState: 'requested' | 'unavailable' = 'requested',
  ) {
    super(
      `Command timed out after ${timeoutSeconds} seconds. Termination requested; verify cleanup before another execution. Narrow the command or choose an explicit suitable timeout. The command was not replayed.`,
    )
    this.name = 'CommandTimeoutError'
  }
}
