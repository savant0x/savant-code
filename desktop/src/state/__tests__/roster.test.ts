import { describe, expect, test } from 'bun:test'

import { applyRosterEvent, initialRoster } from '../roster'

describe('desktop ECHO roster', () => {
  test('starts with the canonical ten roles', () => {
    expect(initialRoster().map((entry) => entry.roleId)).toEqual([
      'savant',
      'detective',
      'forge',
      'verifier',
      'recorder',
      'thinker',
      'scout',
      'researcher',
      'scribe',
      'adversary',
    ])
  })

  test('is always active for savant, never standby (P21)', () => {
    const initial = initialRoster()
    expect(initial.find((entry) => entry.roleId === 'savant')?.presence).toBe(
      'active',
    )
    // A `start` event keeps savant active.
    const started = applyRosterEvent(initial, {
      type: 'start',
      agentId: 's1',
    })
    expect(started.find((entry) => entry.roleId === 'savant')?.presence).toBe(
      'active',
    )
  })

  test('tracks known subagent presence and ignores unknown agents', () => {
    const started = applyRosterEvent(initialRoster(), {
      type: 'subagent_start',
      agentId: 'd1',
      agentType: 'detective',
    })
    expect(started.find((entry) => entry.roleId === 'detective')).toMatchObject(
      {
        presence: 'active',
        agentId: 'd1',
      },
    )
    const unchanged = applyRosterEvent(started, {
      type: 'subagent_start',
      agentId: 'x1',
      agentType: 'unknown',
    })
    expect(unchanged).toEqual(started)
    const finished = applyRosterEvent(started, {
      type: 'subagent_finish',
      agentId: 'd1',
      agentType: 'detective',
    })
    expect(
      finished.find((entry) => entry.roleId === 'detective'),
    ).toMatchObject({
      presence: 'standby',
    })
  })
})
