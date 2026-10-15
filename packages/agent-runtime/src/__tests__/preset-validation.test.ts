import { describe, expect, test } from 'bun:test'

import {
  LOOP_BACK_ROLE_THRESHOLD,
  resolveStartEvent,
  validatePreset,
} from '../run-agent-step/preset-validation'

import type { PresetShape } from '../run-agent-step/preset-validation'

const codesOf = (preset: PresetShape): string[] =>
  validatePreset(preset).map((issue) => issue.code)

const cleanPreset = (): PresetShape => ({
  startEvent: 'TaskReceived',
  completionEvents: ['TaskComplete'],
  roles: [
    {
      role: 'Detective',
      instructions: 'analyze the request',
      triggers: ['TaskReceived'],
      publishes: ['AnalysisReady'],
      transitions: ['Forge'],
    },
    {
      role: 'Forge',
      instructions: 'implement the change',
      triggers: ['AnalysisReady'],
      publishes: ['TaskComplete'],
      transitions: ['Detective'],
    },
  ],
})

describe('preset validation (FID-2026-1006-002 WP7)', () => {
  test('a clean preset produces no issues', () => {
    expect(validatePreset(cleanPreset())).toEqual([])
  })

  test('a role with no instructions, triggers or publishes is an error', () => {
    const preset = cleanPreset()
    const issues = validatePreset({
      ...preset,
      roles: [
        ...preset.roles,
        { role: 'Ghost', instructions: '   ', triggers: [], publishes: [] },
      ],
    })
    const ghost = issues.find(
      (issue) => issue.code === 'role-without-capability',
    )
    expect(ghost?.severity).toBe('error')
    expect(ghost?.role).toBe('Ghost')
    expect(ghost?.message).toContain('Ghost')
  })

  test('a role with only instructions is fine (no triggers needed)', () => {
    expect(
      validatePreset({
        ...cleanPreset(),
        roles: [
          ...cleanPreset().roles,
          { role: 'Scribe', instructions: 'write the summary' },
        ],
      }),
    ).toEqual([])
  })

  test('a start event no role triggers is an error', () => {
    const issues = validatePreset({
      ...cleanPreset(),
      startEvent: 'NobodyListens',
    })
    const unreachable = issues.find(
      (issue) => issue.code === 'unreachable-start-event',
    )
    expect(unreachable?.severity).toBe('error')
    expect(unreachable?.event).toBe('NobodyListens')
  })

  test('an event nobody consumes is a warning', () => {
    const issues = validatePreset({
      startEvent: 'TaskReceived',
      completionEvents: ['TaskComplete'],
      roles: [
        {
          role: 'Detective',
          instructions: 'analyze',
          triggers: ['TaskReceived'],
          publishes: ['OrphanedHandOff'],
          transitions: ['Forge'],
        },
        {
          role: 'Forge',
          instructions: 'implement',
          triggers: ['AnalysisReady'],
          publishes: ['TaskComplete'],
          transitions: ['Detective'],
        },
      ],
    })
    const orphan = issues.find((issue) => issue.code === 'unconsumed-event')
    expect(orphan?.severity).toBe('warning')
    expect(orphan?.event).toBe('OrphanedHandOff')
  })

  test('an unconsumed event is reported once, not once per publisher', () => {
    const issues = validatePreset({
      startEvent: 'TaskReceived',
      completionEvents: ['Done'],
      roles: [
        {
          role: 'A',
          instructions: 'a',
          triggers: ['TaskReceived'],
          publishes: ['Orphan'],
        },
        { role: 'B', instructions: 'b', publishes: ['Orphan'] },
      ],
    })
    expect(
      issues.filter((issue) => issue.code === 'unconsumed-event'),
    ).toHaveLength(1)
  })

  test('no completion event is a warning', () => {
    const preset = cleanPreset()
    expect(codesOf({ ...preset, completionEvents: undefined })).toContain(
      'no-completion-promise',
    )
    expect(codesOf({ ...preset, completionEvents: [] })).toContain(
      'no-completion-promise',
    )
  })

  test('no loop-back path is a warning at three or more roles', () => {
    const roles = [
      {
        role: 'A',
        instructions: 'a',
        triggers: ['TaskReceived'],
        publishes: ['b'],
        transitions: ['B'],
      },
      {
        role: 'B',
        instructions: 'b',
        triggers: ['b'],
        publishes: ['c'],
        transitions: ['C'],
      },
      {
        role: 'C',
        instructions: 'c',
        triggers: ['c'],
        publishes: ['TaskComplete'],
        transitions: [],
      },
    ]
    expect(roles).toHaveLength(LOOP_BACK_ROLE_THRESHOLD)
    expect(
      codesOf({
        startEvent: 'TaskReceived',
        completionEvents: ['TaskComplete'],
        roles,
      }),
    ).toContain('no-loop-back-path')
  })

  test('a loop-back path clears the warning (and two roles never warn)', () => {
    expect(codesOf(cleanPreset())).not.toContain('no-loop-back-path')
    expect(
      codesOf({
        startEvent: 'TaskReceived',
        completionEvents: ['TaskComplete'],
        roles: [
          {
            role: 'A',
            instructions: 'a',
            triggers: ['TaskReceived'],
            publishes: ['b'],
            transitions: ['B'],
          },
          {
            role: 'B',
            instructions: 'b',
            triggers: ['b'],
            publishes: ['TaskComplete', 'a'],
            transitions: ['A'],
          },
        ],
      }),
    ).not.toContain('no-loop-back-path')
  })

  test('errors are listed before warnings', () => {
    const issues = validatePreset({
      startEvent: 'NobodyListens',
      roles: [{ role: 'Ghost', instructions: '' }],
    })
    const severities = issues.map((issue) => issue.severity)
    expect(severities.indexOf('error')).toBeLessThan(
      severities.lastIndexOf('warning'),
    )
    expect(severities.slice(0, 2)).toEqual(['error', 'error'])
  })

  test('a transition to an unknown role does not fake a loop-back', () => {
    expect(
      codesOf({
        startEvent: 'TaskReceived',
        completionEvents: ['TaskComplete'],
        roles: [
          {
            role: 'A',
            instructions: 'a',
            triggers: ['TaskReceived'],
            publishes: ['b'],
            transitions: ['Missing'],
          },
          {
            role: 'B',
            instructions: 'b',
            triggers: ['b'],
            publishes: ['TaskComplete'],
          },
          { role: 'C', instructions: 'c' },
        ],
      }),
    ).toContain('no-loop-back-path')
  })
})

describe('resolveStartEvent ladder', () => {
  test('explicit wins over every later rung', () => {
    expect(
      resolveStartEvent({
        explicit: 'Explicit',
        legacy: 'Legacy',
        inferred: 'Inferred',
        fallback: 'Fallback',
      }),
    ).toBe('Explicit')
  })

  test('legacy wins when explicit is absent or blank', () => {
    expect(
      resolveStartEvent({
        legacy: 'Legacy',
        inferred: 'Inferred',
        fallback: 'Fallback',
      }),
    ).toBe('Legacy')
    expect(
      resolveStartEvent({
        explicit: '  ',
        legacy: 'Legacy',
        inferred: 'Inferred',
        fallback: 'Fallback',
      }),
    ).toBe('Legacy')
  })

  test('inferred wins when the two above are absent', () => {
    expect(
      resolveStartEvent({ inferred: 'Inferred', fallback: 'Fallback' }),
    ).toBe('Inferred')
  })

  test('the fallback is returned when nothing else is present', () => {
    expect(resolveStartEvent({ fallback: 'Fallback' })).toBe('Fallback')
    expect(
      resolveStartEvent({ explicit: '', legacy: '  ', fallback: '' }),
    ).toBe('')
  })
})
