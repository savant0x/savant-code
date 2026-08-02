import { generateCompactId } from '../util/string'

import type { JSONValue } from '../types/json'

export interface ThoughtData {
  thought: string
  thoughtNumber: number
  totalThoughts: number
  isRevision?: boolean
  revisesThought?: number
  branchFromThought?: number
  branchId?: string
  needsMoreThoughts?: boolean
  nextThoughtNeeded: boolean
}

/**
 * Immutable per-thought record appended to the session log. The caller's
 * original `ThoughtData` input object is never mutated or aliased — the
 * effective `totalThoughts` (adjusted upward when `thoughtNumber` exceeds the
 * estimate) is normalized here and stored on the snapshot.
 */
export interface ThoughtSnapshotEntry {
  thoughtId: string
  sequenceId: number
  thought: string
  thoughtNumber: number
  totalThoughts: number
  isRevision?: boolean
  revisesThought?: number
  branchFromThought?: number
  branchId?: string
  needsMoreThoughts?: boolean
  nextThoughtNeeded: boolean
  timestamp: number
}

export type ThoughtSessionStatus =
  'created' | 'running' | 'converged' | 'finalized' | 'failed' | 'cancelled'

/**
 * Derived read model (snapshot) of the session. Always a copy — the session
 * never exposes its live internal arrays across the boundary.
 */
export interface ThoughtSessionSnapshot {
  status: ThoughtSessionStatus
  /** Accepted thoughts in insertion order (immutable copies). */
  thoughts: ThoughtSnapshotEntry[]
  /** Branch ID → accepted thoughts in insertion order (immutable copies). */
  branches: Record<string, ThoughtSnapshotEntry[]>
  /** Effective total thoughts (last adjusted estimate). */
  currentTotalThoughts: number
  /**
   * Convergence flag: at least one accepted thought AND the last accepted
   * thought set `nextThoughtNeeded: false`. This is the ONLY valid success
   * precondition.
   */
  converged: boolean
  length: number
}

export interface ThoughtProcessResult {
  thoughtNumber: number
  totalThoughts: number
  nextThoughtNeeded: boolean
  branches: string[]
  thoughtHistoryLength: number
}

/**
 * The parent-facing final artifact. A discriminated union: `status: 'success'`
 * structurally requires a validated non-null `payload` — a successful result
 * with a null payload is impossible at compile time.
 */
export type ThinkerFinalArtifact =
  | {
      status: 'success'
      synthesis: string
      payload: { message: string }
      metrics: { totalThoughts: number; durationMs: number; branches: string[] }
      thoughts: ThoughtSnapshotEntry[]
    }
  | {
      status: 'exhausted' | 'cancelled' | 'failed'
      synthesis: string
      payload: null
      metrics: { totalThoughts: number; durationMs: number; branches: string[] }
      thoughts: ThoughtSnapshotEntry[]
      error: string
    }

/** Typed lifecycle violation. Never a successful null. */
export class SessionStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SessionStateError'
  }
}

/**
 * FID-2026-0801-012: strict thought session core.
 *
 * Lifecycle: `created → running → converged → finalized | failed | cancelled`.
 *
 * - Append-only typed thought log with monotonic `sequenceId` and immutable
 *   snapshots (no caller-input mutation, no aliasing of internal arrays).
 * - Derived snapshot read model (ordered thoughts, branches, convergence).
 * - `finalize()` enforces the convergence invariant: ≥1 accepted thought AND
 *   `nextThoughtNeeded === false` AND a validated non-null payload. Any missing
 *   piece throws `SessionStateError` and the session is never a successful
 *   null.
 * - `cleanup()` is idempotent and runs exactly once (success/failure/abort).
 */
export class ThoughtSession {
  private thoughtLog: ThoughtSnapshotEntry[] = []
  private branchMap: Record<string, ThoughtSnapshotEntry[]> = {}
  private status: ThoughtSessionStatus = 'created'
  private startedAt = 0
  private sequenceCounter = 0
  private cleaned = false

  /** created → running. Throws from a terminal or already-started session. */
  public begin(): void {
    if (this.status !== 'created') {
      throw new SessionStateError(
        `Cannot begin a session in status '${this.status}'`,
      )
    }
    this.status = 'running'
    this.startedAt = Date.now()
  }

  /**
   * Appends one accepted thought. Returns the concise metadata counters the
   * tool handler reports back to the model (MCP-reference parity).
   */
  public processThought(input: ThoughtData): ThoughtProcessResult {
    if (this.status !== 'running' && this.status !== 'converged') {
      throw new SessionStateError(
        `Cannot process a thought in status '${this.status}'`,
      )
    }

    // Append-time normalization: adjust the total estimate upward when the
    // thought number exceeds it. Never mutate the caller's input object.
    const effectiveTotal = Math.max(input.totalThoughts, input.thoughtNumber)

    const entry: ThoughtSnapshotEntry = {
      thoughtId: generateCompactId('thought-'),
      sequenceId: ++this.sequenceCounter,
      thought: input.thought,
      thoughtNumber: input.thoughtNumber,
      totalThoughts: effectiveTotal,
      isRevision: input.isRevision,
      revisesThought: input.revisesThought,
      branchFromThought: input.branchFromThought,
      branchId: input.branchId,
      needsMoreThoughts: input.needsMoreThoughts,
      nextThoughtNeeded: input.nextThoughtNeeded,
      timestamp: Date.now(),
    }
    this.thoughtLog.push(entry)

    if (input.branchFromThought !== undefined && input.branchId) {
      this.branchMap[input.branchId] = [
        ...(this.branchMap[input.branchId] ?? []),
        entry,
      ]
    }

    this.status = input.nextThoughtNeeded ? 'running' : 'converged'

    return {
      thoughtNumber: input.thoughtNumber,
      totalThoughts: effectiveTotal,
      nextThoughtNeeded: input.nextThoughtNeeded,
      branches: Object.keys(this.branchMap),
      thoughtHistoryLength: this.thoughtLog.length,
    }
  }

  /** Derived, immutable read model of the session. */
  public getSnapshot(): ThoughtSessionSnapshot {
    const thoughts = this.thoughtLog.map((entry) => ({ ...entry }))
    const branches: Record<string, ThoughtSnapshotEntry[]> = {}
    for (const [branchId, entries] of Object.entries(this.branchMap)) {
      branches[branchId] = entries.map((entry) => ({ ...entry }))
    }
    const last = thoughts[thoughts.length - 1]
    const converged =
      thoughts.length > 0 &&
      last !== undefined &&
      last.nextThoughtNeeded === false
    return {
      status: this.status,
      thoughts,
      branches,
      currentTotalThoughts: last?.totalThoughts ?? 0,
      converged,
      length: thoughts.length,
    }
  }

  /**
   * The convergence invariant (the null-killer): success requires ≥1 accepted
   * thought AND `nextThoughtNeeded === false` AND a validated non-null payload.
   * Missing any piece throws `SessionStateError` and leaves the session
   * non-terminal — never a successful null.
   */
  public finalize(payload: { message: string }): ThinkerFinalArtifact {
    const snapshot = this.getSnapshot()
    if (!snapshot.converged) {
      throw new SessionStateError(
        'Cannot finalize: session has not converged (requires at least one thought with nextThoughtNeeded=false)',
      )
    }
    if (
      payload === null ||
      typeof payload !== 'object' ||
      typeof payload.message !== 'string' ||
      payload.message.trim() === ''
    ) {
      throw new SessionStateError(
        'Cannot finalize: a validated non-null payload with a message is required',
      )
    }

    this.status = 'finalized'
    const last = snapshot.thoughts[snapshot.thoughts.length - 1]!
    return {
      status: 'success',
      synthesis: last.thought,
      payload: { message: payload.message },
      metrics: {
        totalThoughts: last.totalThoughts,
        durationMs: this.getDurationMs(),
        branches: Object.keys(snapshot.branches),
      },
      thoughts: snapshot.thoughts,
    }
  }

  /**
   * Terminal non-success artifact (exhausted / failed / cancelled). Never a
   * successful null: `payload` is always null and `error` is always present.
   */
  public fail(
    status: 'exhausted' | 'failed' | 'cancelled',
    error: string,
  ): ThinkerFinalArtifact {
    if (this.status === 'finalized') {
      throw new SessionStateError('Cannot fail a finalized session')
    }
    const snapshot = this.getSnapshot()
    this.status = status === 'cancelled' ? 'cancelled' : 'failed'
    const last = snapshot.thoughts[snapshot.thoughts.length - 1]
    return {
      status,
      synthesis:
        last?.thought ?? 'No sequential thinking thoughts were accepted.',
      payload: null,
      metrics: {
        totalThoughts: last?.totalThoughts ?? 0,
        durationMs: this.getDurationMs(),
        branches: Object.keys(snapshot.branches),
      },
      thoughts: snapshot.thoughts,
      error,
    }
  }

  public getStatus(): ThoughtSessionStatus {
    return this.status
  }

  public getDurationMs(): number {
    if (this.status === 'created' || this.startedAt === 0) return 0
    return Math.max(0, Date.now() - this.startedAt)
  }

  /**
   * Idempotent teardown. Cancels a still-active session; never downgrades a
   * terminal status. Releases internal arrays so no live state escapes.
   */
  public cleanup(): void {
    if (this.cleaned) return
    this.cleaned = true
    if (
      this.status === 'created' ||
      this.status === 'running' ||
      this.status === 'converged'
    ) {
      this.status = 'cancelled'
    }
    this.thoughtLog = []
    this.branchMap = {}
  }
}

/**
 * Converts the typed `ThinkerFinalArtifact` into a JSON-serializable record
 * suitable for `agentState.output`. Optional snapshot fields are omitted when
 * undefined so the value is strictly JSON-safe (no `undefined` keys).
 */
export function thinkerFinalArtifactToJSONValue(
  artifact: ThinkerFinalArtifact,
): Record<string, JSONValue> {
  const thoughts: JSONValue[] = artifact.thoughts.map((entry) => {
    const record: Record<string, JSONValue> = {
      thoughtId: entry.thoughtId,
      sequenceId: entry.sequenceId,
      thought: entry.thought,
      thoughtNumber: entry.thoughtNumber,
      totalThoughts: entry.totalThoughts,
      nextThoughtNeeded: entry.nextThoughtNeeded,
      timestamp: entry.timestamp,
    }
    if (entry.isRevision !== undefined) record.isRevision = entry.isRevision
    if (entry.revisesThought !== undefined)
      record.revisesThought = entry.revisesThought
    if (entry.branchFromThought !== undefined)
      record.branchFromThought = entry.branchFromThought
    if (entry.branchId !== undefined) record.branchId = entry.branchId
    if (entry.needsMoreThoughts !== undefined)
      record.needsMoreThoughts = entry.needsMoreThoughts
    return record
  })

  const base: Record<string, JSONValue> = {
    status: artifact.status,
    synthesis: artifact.synthesis,
    payload: artifact.payload,
    metrics: artifact.metrics,
    thoughts,
  }
  if (artifact.status !== 'success') {
    base.error = artifact.error
  }
  return base
}
