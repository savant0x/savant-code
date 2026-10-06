// FID-2026-1005-003 Step 4 — canonical lifecycle events, per-surface
// delivery, and the metadata-only notice contract.
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  acknowledgeSkillLifecycleEvents,
  appendSkillLifecycleEvent,
  claimSkillLifecycleEvents,
  emitSkillMutationEvent,
  formatSkillLifecycleNoticeLine,
  isValidSkillLifecycleEvent,
  readSkillLifecycleEvents,
  skillLifecycleEventId,
} from '../skill-lifecycle-events'

const tempDirectories: string[] = []

function root(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-lifecycle-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function event(
  action: 'draft_created' | 'draft_failed',
  ts = '2026-10-05T00:00:00.000Z',
) {
  return {
    ts,
    skillName: 'no-environment-dependent-guards',
    action,
    proofState: 'unproven' as const,
    trustState: 'quarantined_pending_trust' as const,
  }
}

describe('appendSkillLifecycleEvent / readSkillLifecycleEvents', () => {
  test('writes one metadata-only JSONL line per event and reads it back', () => {
    const dir = root()
    const { ok, event: written } = appendSkillLifecycleEvent(
      dir,
      event('draft_created'),
    )
    expect(ok).toBe(true)
    expect(written?.id).toHaveLength(64)
    const raw = fs.readFileSync(
      path.join(dir, '.savant', 'skill-lifecycle-events.jsonl'),
      'utf8',
    )
    expect(raw.trim().split('\n')).toHaveLength(1)
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // Metadata-only contract: no free-text fields the renderer could echo.
    expect(Object.keys(parsed).sort()).toEqual([
      'action',
      'id',
      'proofState',
      'skillName',
      'trustState',
      'ts',
    ])
    const events = readSkillLifecycleEvents(dir)
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe('draft_created')
  })

  test('rejects an event that violates the schema (fail-closed write)', () => {
    const dir = root()
    const bad = event('draft_created')
    ;(bad as { skillName: string }).skillName = ''
    const { ok, error } = appendSkillLifecycleEvent(dir, bad)
    expect(ok).toBe(false)
    expect(error).toContain('metadata-only')
    expect(readSkillLifecycleEvents(dir)).toHaveLength(0)
  })
})

describe('per-surface delivery cursors', () => {
  test('a surface sees only events after its own cursor; acks are independent', () => {
    const dir = root()
    appendSkillLifecycleEvent(
      dir,
      event('draft_created', '2026-10-05T00:00:01Z'),
    )
    appendSkillLifecycleEvent(
      dir,
      event('draft_failed', '2026-10-05T00:00:02Z'),
    )

    // Both surfaces start at the full log; claiming does not acknowledge.
    const cliFirst = claimSkillLifecycleEvents(dir, 'cli')
    expect(cliFirst.events).toHaveLength(2)
    expect(cliFirst.remaining).toBe(0)
    expect(claimSkillLifecycleEvents(dir, 'cli').events).toHaveLength(2)

    // Acknowledging on the CLI leaves the desktop untouched (per-surface).
    acknowledgeSkillLifecycleEvents(dir, 'cli', cliFirst.events)
    expect(claimSkillLifecycleEvents(dir, 'cli').events).toHaveLength(0)
    expect(claimSkillLifecycleEvents(dir, 'desktop').events).toHaveLength(2)
  })

  test('bounded batches keep overflow visible without acknowledging it', () => {
    const dir = root()
    for (let i = 0; i < 4; i++) {
      appendSkillLifecycleEvent(
        dir,
        event('draft_created', `2026-10-05T00:00:0${i + 1}Z`),
      )
    }
    const batch = claimSkillLifecycleEvents(dir, 'cli', { limit: 3 })
    expect(batch.events).toHaveLength(3)
    expect(batch.remaining).toBe(1)
    acknowledgeSkillLifecycleEvents(dir, 'cli', batch.events)
    const next = claimSkillLifecycleEvents(dir, 'cli', { limit: 3 })
    expect(next.events).toHaveLength(1)
    expect(next.remaining).toBe(0)
  })

  test('an unwritten cursor replays the batch (at-least-once after a crash)', () => {
    const dir = root()
    appendSkillLifecycleEvent(dir, event('draft_created'))
    const claimed = claimSkillLifecycleEvents(dir, 'cli')
    // Simulate a crash between render and ack: no cursor write happened.
    expect(claimSkillLifecycleEvents(dir, 'cli').events).toHaveLength(
      claimed.events.length,
    )
  })
})

describe('formatSkillLifecycleNoticeLine — the operator line', () => {
  test('names skill, action, proof, and trust from validated fields only', () => {
    const { event: written } = appendSkillLifecycleEvent(
      root(),
      event('draft_created'),
    )
    const line = formatSkillLifecycleNoticeLine(written!)
    expect(line).toContain("'no-environment-dependent-guards'")
    expect(line).toContain('draft created')
    expect(line).toContain('unproven')
    expect(line).toContain('QUARANTINED — PENDING TRUST')
    expect(line).toContain('/skills show no-environment-dependent-guards')
  })
})

describe('emitSkillMutationEvent — the mutation-boundary helper', () => {
  test('drafts always read quarantined + unproven (green ≠ trusted)', () => {
    const dir = root()
    const { ok, line } = emitSkillMutationEvent(dir, {
      skillName: 'some-skill',
      action: 'draft_created',
    })
    expect(ok).toBe(true)
    expect(line).toContain('QUARANTINED — PENDING TRUST')
    const events = readSkillLifecycleEvents(dir)
    expect(events[0].trustState).toBe('quarantined_pending_trust')
    expect(events[0].proofState).toBe('unproven')
  })
})

describe('schema helpers', () => {
  test('isValidSkillLifecycleEvent rejects malformed rows; ids are deterministic', () => {
    expect(isValidSkillLifecycleEvent({ id: 'x' })).toBe(false)
    const base = event('draft_created')
    const id1 = skillLifecycleEventId(base)
    const id2 = skillLifecycleEventId(base)
    expect(id1).toBe(id2)
    const different = skillLifecycleEventId(event('draft_failed'))
    expect(different).not.toBe(id1)
  })
})
