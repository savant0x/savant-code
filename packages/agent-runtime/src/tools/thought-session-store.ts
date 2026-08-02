import { ThoughtSession } from '@savant-code/common/tools/sequential-thinking'

/**
 * FID-2026-0801-012: per-run session store. Keyed by `runId` so concurrent
 * Thinker runs never share history or branches. The handler appends via
 * `getThoughtSession`; the runtime convergence gate reads via
 * `getThoughtSessionIfExists`; terminal paths (success/failure/abort) call
 * `cleanupThoughtSession`.
 */
const sessions = new Map<string, ThoughtSession>()

export function getThoughtSession(runId: string): ThoughtSession {
  let session = sessions.get(runId)
  if (!session) {
    session = new ThoughtSession()
    session.begin()
    sessions.set(runId, session)
  }
  return session
}

export function getThoughtSessionIfExists(
  runId: string,
): ThoughtSession | undefined {
  return sessions.get(runId)
}

/** Idempotent: cleans up the session (if any) and removes it from the store. */
export function cleanupThoughtSession(runId: string): void {
  const session = sessions.get(runId)
  if (session) {
    session.cleanup()
    sessions.delete(runId)
  }
}

/** Test-only: teardown every session and clear the store. */
export function clearAllThoughtSessionsForTests(): void {
  for (const session of sessions.values()) {
    session.cleanup()
  }
  sessions.clear()
}
