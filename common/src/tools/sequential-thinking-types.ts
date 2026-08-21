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
      metrics: {
        totalThoughts: number
        durationMs: number
        branches: string[]
      }
      thoughts: ThoughtSnapshotEntry[]
    }
  | {
      status: 'exhausted' | 'cancelled' | 'failed'
      synthesis: string
      payload: null
      metrics: {
        totalThoughts: number
        durationMs: number
        branches: string[]
      }
      thoughts: ThoughtSnapshotEntry[]
      error: string
    }
