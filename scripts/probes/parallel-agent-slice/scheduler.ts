import { handoffOf } from './types'

import type { SliceStore } from './store'
import type {
  Assignment,
  Handoff,
  RunBatch,
  ScheduleMode,
  TaskResult,
} from './types'

/** Isolated host coordinator; the production runtime is unchanged. */
export async function runSchedule(options: {
  mode: ScheduleMode
  assignments: Assignment[]
  store: SliceStore
  runBatch: RunBatch
  validateResult: (
    result: TaskResult,
    assignment: Assignment,
    handoffs: Handoff[],
  ) => void
  signal: AbortSignal
}): Promise<TaskResult[]> {
  const { mode, assignments, store, runBatch } = options
  const stop = new AbortController()
  const signal = AbortSignal.any([options.signal, stop.signal])
  const ids = new Set(assignments.map((assignment) => assignment.id))
  if (
    ids.size !== assignments.length ||
    assignments.some((a) => a.dependsOn.some((id) => !ids.has(id)))
  )
    throw new Error('Invalid task dependencies')
  const results = new Map<string, TaskResult>()
  const active = new Map<string, Promise<Error | null>>()
  for (const assignment of assignments) store.admit(assignment)
  const ready = () =>
    assignments.filter(
      (assignment) =>
        !results.has(assignment.id) &&
        !active.has(assignment.id) &&
        assignment.dependsOn.every((id) => results.has(id)),
    )
  const execute = async (wave: Assignment[]): Promise<void> => {
    const claims = new Map(
      wave.map((assignment) => [assignment.id, store.claim(assignment.id)]),
    )
    const handoffs: Record<string, Handoff[]> = {}
    for (const assignment of wave)
      handoffs[assignment.id] = assignment.dependsOn.map((id) => {
        const result = results.get(id)
        if (!result) throw new Error(`Missing prerequisite ${id}`)
        return handoffOf(result.artifact)
      })
    try {
      const completed = await runBatch(wave, handoffs, signal)
      if (signal.aborted) throw new Error('Workflow cancelled')
      if (
        completed.length !== wave.length ||
        new Set(completed.map((result) => result.assignment.id)).size !==
          wave.length
      )
        throw new Error('Incomplete wave result')
      // Validate the whole returned wave before publishing any member.
      for (const result of completed) {
        const assignment = wave.find(
          (entry) => entry.id === result.assignment.id,
        )
        if (
          !assignment ||
          JSON.stringify(assignment) !== JSON.stringify(result.assignment)
        )
          throw new Error('Foreign or changed assignment')
        options.validateResult(
          result,
          assignment,
          handoffs[assignment.id] ?? [],
        )
      }
      for (const result of completed) {
        const claim = claims.get(result.assignment.id)
        if (
          !claim ||
          !store.complete(
            result.assignment.id,
            claim.generation,
            claim.attempt,
            result.artifact,
          )
        )
          throw new Error('Stale or foreign completion')
        results.set(result.assignment.id, result)
      }
      store.consume()
    } catch (error) {
      for (const assignment of wave) store.fail(assignment.id)
      throw error
    }
  }
  const cancel = () => store.cancel()
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (results.size < assignments.length) {
      signal.throwIfAborted()
      const wave = ready()
      if (mode === 'batch') {
        if (wave.length === 0) throw new Error('Dependency cycle')
        await execute(wave)
      } else {
        for (const assignment of wave) {
          // Both fulfillment and rejection are observed immediately; wait below
          // propagates failures, then the finally arm settles sibling work.
          const running = execute([assignment]).then(
            () => null,
            (error) =>
              error instanceof Error ? error : new Error('Task failed'),
          )
          active.set(assignment.id, running)
        }
        if (active.size === 0) throw new Error('Dependency cycle')
        const failure = await Promise.race(active.values())
        if (failure) throw failure
        for (const id of active.keys()) if (results.has(id)) active.delete(id)
      }
    }
    return [...results.values()]
  } finally {
    signal.removeEventListener('abort', cancel)
    if (active.size > 0) stop.abort(new Error('Coordinator stopped'))
    await Promise.allSettled(active.values())
  }
}
