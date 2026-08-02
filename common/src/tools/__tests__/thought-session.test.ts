import { describe, expect, it } from 'bun:test'

import {
  SessionStateError,
  ThoughtSession,
  thinkerFinalArtifactToJSONValue,
} from '../sequential-thinking'

import type { ThoughtData } from '../sequential-thinking'

function thought(overrides: Partial<ThoughtData> = {}): ThoughtData {
  return {
    thought: 'Reasoning step',
    thoughtNumber: 1,
    totalThoughts: 3,
    nextThoughtNeeded: true,
    ...overrides,
  }
}

describe('ThoughtSession', () => {
  it('begins and appends thoughts with monotonic snapshots in insertion order', () => {
    const session = new ThoughtSession()
    session.begin()

    const r1 = session.processThought(thought({ thoughtNumber: 1 }))
    expect(r1.thoughtHistoryLength).toBe(1)
    const r2 = session.processThought(thought({ thoughtNumber: 2 }))
    expect(r2.thoughtHistoryLength).toBe(2)

    const snapshot = session.getSnapshot()
    expect(snapshot.length).toBe(2)
    expect(snapshot.thoughts.map((t) => t.thoughtNumber)).toEqual([1, 2])
    expect(snapshot.thoughts[0]!.sequenceId).toBeLessThan(
      snapshot.thoughts[1]!.sequenceId,
    )
    expect(snapshot.thoughts[0]!.thoughtId).not.toBe(
      snapshot.thoughts[1]!.thoughtId,
    )
  })

  it('returns the same metadata shape as the original processThought', () => {
    const session = new ThoughtSession()
    session.begin()
    const result = session.processThought(thought({ nextThoughtNeeded: false }))
    expect(result).toMatchObject({
      thoughtNumber: 1,
      totalThoughts: 3,
      nextThoughtNeeded: false,
      branches: [],
      thoughtHistoryLength: 1,
    })
  })

  it('adjusts totalThoughts upward when thoughtNumber exceeds the estimate without mutating the caller input', () => {
    const session = new ThoughtSession()
    session.begin()
    const input = thought({ thoughtNumber: 5, totalThoughts: 3 })
    const result = session.processThought(input)

    expect(result.totalThoughts).toBe(5)
    // The caller's input object is never mutated or aliased (SELF-CORRECT #11)
    expect(input.totalThoughts).toBe(3)
    expect(session.getSnapshot().currentTotalThoughts).toBe(5)
    expect(session.getSnapshot().thoughts[0]!.totalThoughts).toBe(5)
  })

  it('preserves revision and branch metadata in the snapshot', () => {
    const session = new ThoughtSession()
    session.begin()
    session.processThought(thought({ thoughtNumber: 1 }))
    session.processThought(
      thought({
        thoughtNumber: 2,
        isRevision: true,
        revisesThought: 1,
      }),
    )
    session.processThought(
      thought({
        thoughtNumber: 3,
        branchFromThought: 1,
        branchId: 'alt',
      }),
    )

    const snapshot = session.getSnapshot()
    expect(snapshot.thoughts[1]!.isRevision).toBe(true)
    expect(snapshot.thoughts[1]!.revisesThought).toBe(1)
    expect(snapshot.thoughts[2]!.branchId).toBe('alt')
    expect(snapshot.branches['alt']).toHaveLength(1)
  })

  it('detects convergence only when the last thought sets nextThoughtNeeded=false', () => {
    const session = new ThoughtSession()
    session.begin()
    expect(session.getSnapshot().converged).toBe(false)

    session.processThought(thought({ nextThoughtNeeded: true }))
    expect(session.getSnapshot().converged).toBe(false)

    session.processThought(
      thought({ thoughtNumber: 2, nextThoughtNeeded: false }),
    )
    expect(session.getSnapshot().converged).toBe(true)
  })

  it('finalize builds a non-null success artifact from the session snapshot', () => {
    const session = new ThoughtSession()
    session.begin()
    session.processThought(
      thought({
        thoughtNumber: 1,
        nextThoughtNeeded: true,
      }),
    )
    session.processThought(
      thought({
        thoughtNumber: 2,
        nextThoughtNeeded: false,
        thought: 'Conclusion: choose the hybrid approach.',
      }),
    )

    const artifact = session.finalize({
      message: 'Conclusion: choose the hybrid approach.',
    })
    expect(artifact.status).toBe('success')
    if (artifact.status === 'success') {
      expect(artifact.payload.message).toBe(
        'Conclusion: choose the hybrid approach.',
      )
      expect(artifact.thoughts).toHaveLength(2)
      expect(artifact.metrics.totalThoughts).toBe(3)
      expect(artifact.synthesis).toBe('Conclusion: choose the hybrid approach.')
    }
    expect(session.getStatus()).toBe('finalized')
  })

  it('finalize throws SessionStateError when the session has not converged', () => {
    const session = new ThoughtSession()
    session.begin()
    session.processThought(thought({ nextThoughtNeeded: true }))
    expect(() => session.finalize({ message: 'not done' })).toThrow(
      SessionStateError,
    )
    // Session stays non-terminal — never a successful null.
    expect(['running', 'converged']).toContain(session.getStatus())
  })

  it('finalize throws SessionStateError for an empty payload', () => {
    const session = new ThoughtSession()
    session.begin()
    session.processThought(thought({ nextThoughtNeeded: false }))
    expect(() => session.finalize({ message: '' })).toThrow(SessionStateError)
    expect(() => session.finalize({ message: '   ' })).toThrow(
      SessionStateError,
    )
  })

  it('fail produces a terminal artifact with null payload and error for exhausted/failed/cancelled', () => {
    const session = new ThoughtSession()
    session.begin()
    session.processThought(
      thought({ nextThoughtNeeded: true, thought: 'Partial analysis' }),
    )

    for (const status of ['exhausted', 'failed', 'cancelled'] as const) {
      const s = new ThoughtSession()
      s.begin()
      s.processThought(thought({ nextThoughtNeeded: true }))
      const artifact = s.fail(status, `${status} reason`)
      expect(artifact.status).toBe(status)
      if (artifact.status !== 'success') {
        expect(artifact.payload).toBeNull()
        expect(artifact.error).toBe(`${status} reason`)
        expect(artifact.thoughts).toHaveLength(1)
      }
      expect(s.getStatus()).toBe(
        status === 'cancelled' ? 'cancelled' : 'failed',
      )
    }
  })

  it('cleanup is idempotent and cancels an in-flight session', () => {
    const session = new ThoughtSession()
    session.begin()
    session.processThought(thought())
    session.cleanup()
    expect(session.getStatus()).toBe('cancelled')
    // Second cleanup is a no-op
    session.cleanup()
    expect(session.getStatus()).toBe('cancelled')
    // processThought after cleanup throws
    expect(() => session.processThought(thought())).toThrow(SessionStateError)
  })

  it('cleanup after finalize does not downgrade the status', () => {
    const session = new ThoughtSession()
    session.begin()
    session.processThought(thought({ nextThoughtNeeded: false }))
    session.finalize({ message: 'done' })
    session.cleanup()
    expect(session.getStatus()).toBe('finalized')
  })

  it('two sessions are isolated from each other', () => {
    const a = new ThoughtSession()
    const b = new ThoughtSession()
    a.begin()
    b.begin()
    a.processThought(thought({ thought: 'A thought' }))
    b.processThought(thought({ thought: 'B thought' }))
    b.processThought(thought({ thought: 'B second' }))

    expect(a.getSnapshot().length).toBe(1)
    expect(b.getSnapshot().length).toBe(2)
    expect(a.getSnapshot().thoughts[0]!.thought).toBe('A thought')
  })

  it('processThought throws after cleanup or fail', () => {
    const cancelled = new ThoughtSession()
    cancelled.begin()
    cancelled.cleanup()
    expect(() => cancelled.processThought(thought())).toThrow(SessionStateError)

    const failed = new ThoughtSession()
    failed.begin()
    failed.fail('failed', 'reason')
    expect(() => failed.processThought(thought())).toThrow(SessionStateError)
  })

  it('converts the artifact to a JSON-safe record without undefined keys', () => {
    const session = new ThoughtSession()
    session.begin()
    session.processThought(
      thought({ nextThoughtNeeded: false, thought: 'Answer' }),
    )
    const artifact = session.finalize({ message: 'Answer' })
    const json = thinkerFinalArtifactToJSONValue(artifact)

    expect(json.status).toBe('success')
    expect(json.payload).toEqual({ message: 'Answer' })
    expect(Array.isArray(json.thoughts)).toBe(true)
    expect('error' in json).toBe(false)
    // No undefined values anywhere in the JSON-safe record
    const hasUndefined = JSON.stringify(json).includes('undefined')
    expect(hasUndefined).toBe(false)

    const failedArtifact = new ThoughtSession().fail('failed', 'reason')
    const failedJson = thinkerFinalArtifactToJSONValue(failedArtifact)
    expect(failedJson.status).toBe('failed')
    expect(failedJson.payload).toBeNull()
    expect(failedJson.error).toBe('reason')
  })
})
