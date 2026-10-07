/**
 * FID-2026-1005-007 — stream-outcome classification at turn close.
 *
 * The one recoverable shape is structural (converged design decision 2):
 * reasoning non-empty ∧ body empty ∧ no tool calls ∧ an abnormal close or
 * an empty stop. Never recovered: user cancel, produced body/tool output,
 * output-cap, explicit upstream error (an error FRAME — `StreamErrorChunk`).
 *
 * A thrown connection cut after reasoning-only output IS the measured
 * trigger ("the upstream closes without a normal end frame"); an explicit
 * error frame is not.
 */

export type StreamCloseKind = 'done' | 'thrown' | 'cancel' | 'cap' | 'error'

export interface StreamClose {
  kind: StreamCloseKind
  /** An explicit upstream error frame arrived (`StreamErrorChunk`). */
  sawErrorFrame?: boolean
}

export interface TurnAccumulation {
  /** The reasoning text (the recovery checkpoint source). */
  reasoning: string
  bodyChars: number
  toolCallCount: number
}

export type StreamOutcome =
  | 'normal'
  | 'upstream-error'
  | 'user-cancel'
  | 'output-cap'
  | 'reasoning-only-truncation'

export function emptyAccumulation(): TurnAccumulation {
  return { reasoning: '', bodyChars: 0, toolCallCount: 0 }
}

/**
 * Accumulate one chunk's contribution. Structural on purpose (the chunk is
 * `StreamChunk`-shaped: `{type:'text'|'reasoning', text}` or a tool part
 * carrying `toolCallId`).
 */
export function accumulateChunk(
  turn: TurnAccumulation,
  chunk: { type?: unknown; text?: unknown; toolCallId?: unknown },
): void {
  if (chunk.type === 'reasoning' && typeof chunk.text === 'string') {
    turn.reasoning += chunk.text
    return
  }
  if (chunk.type === 'text' && typeof chunk.text === 'string') {
    turn.bodyChars += chunk.text.length
    return
  }
  if (typeof chunk.toolCallId === 'string') turn.toolCallCount += 1
}

/** Classify the turn's close. Pure; table pinned by the declared suite. */
export function classifyStreamOutcome(
  turn: TurnAccumulation,
  close: StreamClose,
): StreamOutcome {
  if (close.sawErrorFrame) return 'upstream-error'
  if (close.kind === 'cancel') return 'user-cancel'
  if (close.kind === 'cap') return 'output-cap'
  if (close.kind === 'error') return 'upstream-error'
  const reasoningOnly =
    turn.reasoning.length > 0 &&
    turn.bodyChars === 0 &&
    turn.toolCallCount === 0
  if (reasoningOnly && (close.kind === 'done' || close.kind === 'thrown')) {
    return 'reasoning-only-truncation'
  }
  if (close.kind === 'thrown') return 'upstream-error'
  return 'normal'
}

/** The measured failure surface: truncated turn, recovery not completed. */
export class StreamCutError extends Error {
  constructor(
    message = 'STREAM_CUT: the turn was truncated and bounded recovery did not complete',
  ) {
    super(message)
    this.name = 'StreamCutError'
  }
}
