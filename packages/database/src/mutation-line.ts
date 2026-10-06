import { getSession, updateSession } from './sessions'

/**
 * Mutation line — serialized read-modify-write for durable state
 * (FID-2026-1006-002 WP4, database half).
 *
 * The race this removes (R6 in `docs/durable-race-catalog.md`): a writer reads
 * the persisted state, computes a complete next state from that read, and
 * commits it. If another writer commits in between, the first writer's read is
 * stale and its otherwise-complete snapshot silently drops the other writer's
 * fields. The window is the gap between the read and the write, and it opens
 * whenever that gap spans an await.
 *
 * The line closes it structurally: a mutation is a TRANSFORM, not a snapshot.
 * `mutateSessionState(id, transform)` reads the persisted state inside the
 * per-key lane, applies the transform, and commits the value the transform
 * returned — verbatim, with no field-wise merge of anyone else's snapshot. Two
 * mutations for the same key run strictly one after the other (the second
 * one's read therefore observes the first one's commit, whichever order the
 * two were enqueued in), while mutations for different keys run concurrently.
 *
 * The discipline this serves is the one recorded in `ARCHITECTURE.md`: compute
 * one complete next state in memory, then commit it atomically. `updateSession`
 * remains the API for a caller that already holds a complete next state and
 * needs no read; the line is the API for a caller whose next state depends on
 * the state that is actually stored.
 *
 * Fail-closed sealing: if a transform or its commit throws, the key is SEALED.
 * A sealed key refuses every later mutation with `MutationLineSealedError`
 * instead of reading a state whose integrity the line can no longer vouch for;
 * recovery is an explicit `releaseSeal(key)`. Sealing is per key — one bad
 * session cannot stop writes to another.
 *
 * Constraint (by design, not detected): a transform must not await another
 * mutation for the SAME key — that inner mutation queues behind the outer one
 * and would wait for it, which is a self-inflicted deadlock.
 */

/** The value a mutation computes. Async transforms are serialized, not raced. */
export type MutationTransform<T> = (current: T) => T | Promise<T>

/** Thrown by every mutation of a sealed key, carrying the original failure. */
export class MutationLineSealedError extends Error {
  readonly key: string
  readonly sealCause: Error

  constructor(key: string, sealCause: Error) {
    super(
      `mutation line for "${key}" is sealed after a failed mutation: ${sealCause.message}`,
    )
    this.name = 'MutationLineSealedError'
    this.key = key
    this.sealCause = sealCause
  }
}

type Lane = {
  /** The last queued job's settlement — the next job chains onto this. */
  tail: Promise<unknown>
  /** Non-null once a mutation for this key failed (fail-closed). */
  sealed: Error | null
  /** Queued-or-running jobs; the lane is dropped only when this reaches 0. */
  pending: number
}

const lanes = new Map<string, Lane>()

function laneFor(key: string): Lane {
  let lane = lanes.get(key)
  if (lane === undefined) {
    lane = { tail: Promise.resolve(), sealed: null, pending: 0 }
    lanes.set(key, lane)
  }
  return lane
}

/** Lane key for a session's durable state. */
export function sessionMutationKey(sessionId: string): string {
  return `session:${sessionId}`
}

/**
 * Run `transform` as the sole read-modify-write for `key` at this moment.
 * Returns the transform's value (the committed one); rethrows its error.
 */
export async function mutate<T>(
  key: string,
  transform: () => T | Promise<T>,
): Promise<T> {
  const lane = laneFor(key)
  const previous = lane.tail
  lane.pending += 1
  // `then(run, run)` — a failed predecessor neither cancels nor replaces this
  // mutation's own outcome (same fail-open ordering as the file queue).
  const run = previous.then(
    () => runMutation(key, lane, transform),
    () => runMutation(key, lane, transform),
  )
  lane.tail = run.then(
    () => undefined,
    () => undefined,
  )
  try {
    return await run
  } finally {
    lane.pending -= 1
    // Only the lane's current tail may clear it, and a sealed lane must stay
    // visible until it is explicitly released.
    if (lane.pending === 0 && lane.sealed === null && lanes.get(key) === lane) {
      lanes.delete(key)
    }
  }
}

async function runMutation<T>(
  key: string,
  lane: Lane,
  transform: () => T | Promise<T>,
): Promise<T> {
  const seal = lane.sealed
  if (seal !== null) {
    throw new MutationLineSealedError(key, seal)
  }
  try {
    return await transform()
  } catch (error) {
    // Fail closed: anything that throws while holding the key — the transform
    // or the commit inside it — leaves the line unable to vouch for the stored
    // state, so later mutations refuse rather than build on unknown ground.
    lane.sealed = error instanceof Error ? error : new Error(String(error))
    throw error
  }
}

/**
 * The only supported read-modify-write of a session's durable state: read the
 * stored state inside the lane, hand it to `transform`, commit exactly what
 * `transform` returned. Returns whether a row changed (mirrors
 * `updateSession`); a session that does not exist is a no-op, not an insert.
 */
export function mutateSessionState(
  sessionId: string,
  transform: MutationTransform<Record<string, unknown>>,
): Promise<boolean> {
  return mutate(sessionMutationKey(sessionId), async () => {
    const session = getSession(sessionId)
    if (session === null) return false
    const next = await transform(session.session_state)
    return updateSession(sessionId, next)
  })
}

/** Seal `key` by hand (the failure path does this automatically). */
export function seal(key: string, cause: Error): void {
  laneFor(key).sealed = cause
}

/** Whether `key` currently refuses mutations. */
export function isSealed(key: string): boolean {
  return lanes.get(key)?.sealed != null
}

/** Operator recovery: unseal a key so mutations are accepted again. */
export function releaseSeal(key: string): void {
  const lane = lanes.get(key)
  if (lane === undefined) return
  lane.sealed = null
  if (lane.pending === 0) lanes.delete(key)
}

/** Keys with a queued, running, or sealed mutation — observability seam. */
export function pendingMutationKeys(): string[] {
  return [...lanes.keys()].sort()
}

/** Drop every lane (test seam; never call this to clear a seal in production). */
export function resetMutationLine(): void {
  lanes.clear()
}
