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
export const COMMAND_CANCELLATION_REASONS = ['user-request'] as const
export type CommandCancellationReason =
  (typeof COMMAND_CANCELLATION_REASONS)[number]
export const COMMAND_REJECTION_REASONS = ['readonly-guard'] as const
export type CommandRejectionReason = (typeof COMMAND_REJECTION_REASONS)[number]

/**
 * The only cancellation reason that can establish explicit user intent.
 *
 * FID-2026-1012-023 (Loop 7): the marker carries a REGISTERED brand, not a
 * per-module `Symbol('…')`. `Symbol('…')` is minted once per module *instance*,
 * so a comparison against it holds only while the aborting copy and the reading
 * copy are the same instance — and they are not in the shipped topology: `common`
 * resolves to source (`"bun": "./src/*.ts"`) while `@savant-code/sdk` resolves to
 * its bundle (`"import": "./dist/index.mjs"`), which inlines its own copy of
 * this module. A user stop raised through one copy was therefore read as an
 * untyped cancellation by the other, and `resolveToolFailureExpectedness`
 * recorded an intentional stop as unexpected. `Symbol.for` is the same key in
 * every copy, so the brand survives the boundary — the idiom already used by
 * `PRESET_MARKER` (`packages/connectors/src/core/presets/preset.ts`).
 */
const USER_CANCELLATION_MARKER = Symbol.for('savant-code.user-cancellation')

/** Branded by `abortForUserCancellation` only; never derived from a result. */
interface UserCancellationReason {
  readonly [USER_CANCELLATION_MARKER]: true
}

const USER_CANCELLATION_SIGNAL_REASON = Object.freeze<UserCancellationReason>({
  [USER_CANCELLATION_MARKER]: true,
})

/** A marker is a marker by its brand, never by which copy minted it. */
function isUserCancellationReason(
  reason: unknown,
): reason is UserCancellationReason {
  if (!reason || typeof reason !== 'object') return false
  return (
    Object.getOwnPropertyDescriptor(reason, USER_CANCELLATION_MARKER)?.value ===
    true
  )
}
/**
 * ONE schema for the identity of a command execution (FID-2026-1012-023): the
 * public tool output, the capture hook payload and the experience record all
 * reference this definition, so a field can never exist in one and be dropped
 * by another.
 */
export const commandExecutionMetadataSchema = z
  .object({
    executionOutcome: z.enum(COMMAND_EXECUTION_OUTCOMES).optional(),
    executionStarted: z.boolean().optional(),
    callerToolName: z.string().optional(),
    executedToolName: z.string().optional(),
    delegateToolName: z.string().optional(),
    terminationState: z.enum(COMMAND_TERMINATION_STATES).optional(),
    timeoutSeconds: z.number().optional(),
    cancellationReason: z.enum(COMMAND_CANCELLATION_REASONS).optional(),
    rejectionReason: z.enum(COMMAND_REJECTION_REASONS).optional(),
  })
  .superRefine((metadata, context) => {
    if (
      metadata.cancellationReason !== undefined &&
      metadata.executionOutcome !== 'cancelled'
    )
      context.addIssue({
        code: 'custom',
        path: ['cancellationReason'],
        message: 'cancellationReason requires executionOutcome=cancelled',
      })
    if (
      metadata.rejectionReason !== undefined &&
      metadata.executionOutcome !== 'rejected'
    )
      context.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'rejectionReason requires executionOutcome=rejected',
      })
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
  if ('cancellationReason' in value)
    metadata.cancellationReason = COMMAND_CANCELLATION_REASONS.find(
      (reason) => reason === value.cancellationReason,
    )
  if ('rejectionReason' in value)
    metadata.rejectionReason = COMMAND_REJECTION_REASONS.find(
      (reason) => reason === value.rejectionReason,
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
  if (metadata.cancellationReason && metadata.executionOutcome !== 'cancelled')
    delete metadata.cancellationReason
  if (metadata.rejectionReason && metadata.executionOutcome !== 'rejected')
    delete metadata.rejectionReason
  return metadata
}

/** Copy the typed user origin only; every other abort origin remains unknown. */
export function commandCancellationMetadata(
  signal?: AbortSignal,
): Partial<Pick<CommandExecutionMetadata, 'cancellationReason'>> {
  return isUserCancellationSignal(signal)
    ? { cancellationReason: 'user-request' }
    : {}
}

export function isUserCancellationSignal(signal?: AbortSignal): boolean {
  return isUserCancellationReason(signal?.reason)
}

/** Mark a controller with the canonical user-originated cancellation reason. */
export function abortForUserCancellation(controller: AbortController): void {
  controller.abort(USER_CANCELLATION_SIGNAL_REASON)
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
