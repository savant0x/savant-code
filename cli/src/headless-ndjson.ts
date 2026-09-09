// FID-2026-0907-003 — NDJSON delegation frame module (BO Phase 1, FID 1).
//
// Speaks the Savant parent's FROZEN wire contract verbatim
// (dev/build-orders/BO-2026-09-07-ndjson-phase-b-emitter.md,
// §Frozen Wire Contract): strict envelope {v, type, ts, data} with v = 1,
// one JSON object per line, real epoch-ms ts. Child→parent frame types are
// progress/question/artifact/error; parent→child control frames are
// cancel/steer on stdin, read line-delimited at step boundaries.
//
// Mapping honesty (the child stream lacks four contract fields):
//   - `iteration` is a child-maintained 1-based step counter — advisory
//     display data for the parent (the exit code owns the verdict); each
//     tool_call_started begins the next step, so iteration_completed
//     reports the most recently started step (0 before the first one).
//   - `duration_ms` is wall clock between tool_call_started and its
//     tool_call_completed (matched by toolCallId); 0 when unmatched.
//   - `success: true` means "a tool_result arrived" — failures surface as
//     error events, which FID-2026-0907-005 maps to error frames.
//   - `tokens_used` is 0 (the child runtime exposes no token counts on this
//     stream); the field shape is FROZEN, so it is sent honestly empty
//     rather than omitted.
//
// Pure module: no wiring. The handleEvent tap (FID-2026-0907-004) and the
// artifact/error emission + stdout purity (FID-2026-0907-005) build on it.

export const NDJSON_WIRE_VERSION = 1

export type NdjsonFrameType = 'progress' | 'question' | 'artifact' | 'error'

export type NdjsonProgressData =
  | { kind: 'tool_call_started'; tool: string; iteration: number }
  | {
      kind: 'tool_call_completed'
      tool: string
      success: boolean
      duration_ms: number
    }
  | { kind: 'iteration_completed'; iteration: number; tokens_used: number }
  | { kind: 'thinking_started'; iteration: number }
  | { kind: 'thinking_completed'; iteration: number; reasoning: string }

/** Phase C — vocabulary-complete; nothing emits questions in Phase B. */
export type NdjsonQuestionData = {
  id: string
  prompt: string
  options: string[]
}

export type NdjsonArtifactData = { output: string }
export type NdjsonErrorData = { message: string }

export type NdjsonFrameData =
  NdjsonProgressData | NdjsonQuestionData | NdjsonArtifactData | NdjsonErrorData

export type NdjsonFrame = {
  v: number
  type: NdjsonFrameType
  ts: number
  data: NdjsonFrameData
}

/**
 * One frame → one line. The object literal is built in wire order
 * (v, type, ts, data) so JSON.stringify preserves the envelope's key order,
 * and escapes embedded newlines/quotes so a payload can never corrupt the
 * channel with a raw newline.
 */
export function serializeFrame(frame: NdjsonFrame): string {
  return JSON.stringify({
    v: frame.v,
    type: frame.type,
    ts: frame.ts,
    data: frame.data,
  })
}

export type FrameWriter = (line: string) => void

const RATIFIED_PROGRESS_KINDS: ReadonlySet<string> = new Set([
  'tool_call_started',
  'tool_call_completed',
  'iteration_completed',
  'thinking_started',
  'thinking_completed',
])

/**
 * The ratified minimum five (BO §Frozen Wire Contract, rule 2). The parent
 * tolerates unknown kinds, but the emitter no-ops them at emit time — the
 * child only ever puts ratified shapes on the wire.
 */
export function isRatifiedProgress(data: unknown): data is NdjsonProgressData {
  if (typeof data !== 'object' || data === null) return false
  const kind = (data as { kind?: unknown }).kind
  return typeof kind === 'string' && RATIFIED_PROGRESS_KINDS.has(kind)
}

export type NdjsonEmitter = {
  /** Unknown kinds no-op (false); ratified kinds emit (true). */
  emitProgress(data: NdjsonProgressData | { kind: string }): boolean
  emitArtifact(output: string): void
  emitError(message: string): void
  toolCallStarted(toolCallId: string, toolName: string): void
  toolCallCompleted(toolCallId: string, toolName: string): void
  iterationCompleted(tokensUsed?: number): void
  thinkingStarted(): void
  addReasoningDelta(text: string): void
  thinkingCompleted(): void
  currentIteration(): number
}

type EmitterState = {
  iteration: number
  thinking: boolean
  reasoning: string
  toolStarts: Map<string, number>
}

type FrameSink = (type: NdjsonFrameType, data: NdjsonFrameData) => void

function createProgressMethods(
  state: EmitterState,
  now: () => number,
  writeFrame: FrameSink,
): Pick<
  NdjsonEmitter,
  | 'toolCallStarted'
  | 'toolCallCompleted'
  | 'iterationCompleted'
  | 'thinkingStarted'
  | 'addReasoningDelta'
  | 'thinkingCompleted'
  | 'currentIteration'
> {
  return {
    toolCallStarted: (toolCallId, toolName) => {
      state.toolStarts.set(toolCallId, now())
      writeFrame('progress', {
        kind: 'tool_call_started',
        tool: toolName,
        iteration: state.iteration,
      })
      state.iteration += 1
    },
    toolCallCompleted: (toolCallId, toolName) => {
      const start = state.toolStarts.get(toolCallId)
      state.toolStarts.delete(toolCallId)
      writeFrame('progress', {
        kind: 'tool_call_completed',
        tool: toolName,
        success: true,
        duration_ms: start === undefined ? 0 : Math.max(0, now() - start),
      })
    },
    iterationCompleted: (tokensUsed = 0) => {
      writeFrame('progress', {
        kind: 'iteration_completed',
        iteration: state.iteration - 1,
        tokens_used: tokensUsed,
      })
    },
    thinkingStarted: () => {
      state.thinking = true
      state.reasoning = ''
      writeFrame('progress', {
        kind: 'thinking_started',
        iteration: state.iteration,
      })
    },
    addReasoningDelta: (text) => {
      if (state.thinking) state.reasoning += text
    },
    thinkingCompleted: () => {
      if (!state.thinking) return
      state.thinking = false
      writeFrame('progress', {
        kind: 'thinking_completed',
        iteration: state.iteration,
        reasoning: state.reasoning,
      })
    },
    currentIteration: () => state.iteration,
  }
}

export function createNdjsonEmitter(params: {
  write: FrameWriter
  /** Injectable clock; defaults to Date.now (real epoch-ms on the wire). */
  now?: () => number
}): NdjsonEmitter {
  const { write, now = Date.now } = params
  const state: EmitterState = {
    iteration: 1,
    thinking: false,
    reasoning: '',
    toolStarts: new Map(),
  }
  const writeFrame: FrameSink = (type, data) => {
    write(serializeFrame({ v: NDJSON_WIRE_VERSION, type, ts: now(), data }))
  }
  return {
    emitProgress: (data) => {
      if (!isRatifiedProgress(data)) return false
      writeFrame('progress', data)
      return true
    },
    emitArtifact: (output) => writeFrame('artifact', { output }),
    emitError: (message) => writeFrame('error', { message }),
    ...createProgressMethods(state, now, writeFrame),
  }
}

export type NdjsonControlFrame =
  | { v: number; type: 'cancel' }
  | { v: number; type: 'steer'; data: { note: string } }

/**
 * Parse one parent→child control line. Tolerant by contract: malformed
 * JSON, unknown types, and `v ≠ 1` all return null (skip the line, keep
 * reading). Unknown fields are ignored by construction. A steer frame
 * without a parsable note is still accepted, with note ''.
 */
export function parseControlFrame(line: string): NdjsonControlFrame | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const frame = parsed as { v?: unknown; type?: unknown; data?: unknown }
  if (frame.v !== NDJSON_WIRE_VERSION) return null
  if (frame.type === 'cancel') return { v: 1, type: 'cancel' }
  if (frame.type === 'steer') {
    const data = frame.data as { note?: unknown } | undefined
    const note = typeof data?.note === 'string' ? data.note : ''
    return { v: 1, type: 'steer', data: { note } }
  }
  return null
}

/**
 * Structural minimum of a Node Readable — process.stdin and test doubles
 * satisfy it. Chunks buffer as they arrive; frames are pulled via drain()
 * at boundaries. Cancels additionally fire `onCancel` AT ARRIVAL
 * (FID-2026-0907-007 case 4): a held LLM request yields no boundaries.
 */
export type ControlInputStream = {
  on(event: string, listener: (chunk?: Buffer | string) => void): unknown
}

export type ControlFrameReader = {
  /** Return and clear every control frame buffered since the last drain. */
  drain(): NdjsonControlFrame[]
  /** True once stdin hit EOF ("no control input" — the run continues). */
  isClosed(): boolean
}

export function createControlFrameReader(params: {
  input: ControlInputStream
  /** Fires synchronously when a cancel frame ARRIVES (parse time) — a held
   *  LLM request yields no boundaries (case 4). Abort is idempotent; the
   *  frame stays buffered for the boundary drain (bookkeeping path). */
  onCancel?: (frame: NdjsonControlFrame) => void
}): ControlFrameReader {
  const pending: NdjsonControlFrame[] = []
  let buffer = ''
  let closed = false

  const enqueue = (line: string): void => {
    const frame = parseControlFrame(line)
    if (frame) {
      pending.push(frame)
      if (frame.type === 'cancel') params.onCancel?.(frame)
    }
  }

  params.input.on('data', (chunk) => {
    if (chunk === undefined) return
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    let idx = buffer.indexOf('\n')
    while (idx !== -1) {
      enqueue(buffer.slice(0, idx))
      buffer = buffer.slice(idx + 1)
      idx = buffer.indexOf('\n')
    }
  })
  params.input.on('end', () => {
    if (buffer.length > 0) enqueue(buffer)
    buffer = ''
    closed = true
  })

  return {
    drain: () => pending.splice(0, pending.length),
    isClosed: () => closed,
  }
}
