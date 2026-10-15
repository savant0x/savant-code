import { describe, expect, it } from 'bun:test'

import {
  DRIVE_STRIPPED_TOOL_NAMES,
  parseDriveControlDirective,
  parseDriveLockDirective,
  parseDrivePlanDirective,
  serializeDriveControlDirective,
  serializeDriveLockDirective,
  serializeDrivePlanDirective,
} from '../drive-directives'

describe('drive-directives', () => {
  it('round-trips a <drive-lock> directive with special characters', () => {
    const serialized = serializeDriveLockDirective({
      driveId: 'drive-1',
      goal: 'fix "the <login> flow" & ship it',
      planId: 'plan-9',
      acceptanceCriteria: ['all tests pass', 'lint "clean" < 0 warnings>'],
      resolutionPolicy: 'terminal block, never ask',
    })
    const parsed = parseDriveLockDirective(serialized)
    expect(parsed).not.toBeNull()
    expect(parsed?.driveId).toBe('drive-1')
    expect(parsed?.goal).toBe('fix "the <login> flow" & ship it')
    expect(parsed?.planId).toBe('plan-9')
    expect(parsed?.acceptanceCriteria).toEqual([
      'all tests pass',
      'lint "clean" < 0 warnings>',
    ])
    expect(parsed?.resolutionPolicy).toBe('terminal block, never ask')
  })

  it('generates a driveId when none is supplied', () => {
    const serialized = serializeDriveLockDirective({ goal: 'goal' })
    const parsed = parseDriveLockDirective(serialized)
    expect(parsed?.driveId).toBeTruthy()
    expect(parsed?.goal).toBe('goal')
  })

  it('round-trips a <drive-plan> directive', () => {
    const serialized = serializeDrivePlanDirective({
      goal: 'ship the widget',
      plan: '# Plan\n\n1. do the thing\n2. verify it',
      acceptanceCriteria: ['widget renders', 'typecheck clean'],
      resolutionPolicy: 'block on impasse',
    })
    const parsed = parseDrivePlanDirective(serialized)
    expect(parsed).not.toBeNull()
    expect(parsed?.goal).toBe('ship the widget')
    expect(parsed?.plan).toBe('# Plan\n\n1. do the thing\n2. verify it')
    expect(parsed?.acceptanceCriteria).toEqual([
      'widget renders',
      'typecheck clean',
    ])
    expect(parsed?.resolutionPolicy).toBe('block on impasse')
  })

  it('returns null for a non-matching prompt', () => {
    expect(parseDriveLockDirective('just a normal message')).toBeNull()
    expect(parseDrivePlanDirective('no directive here')).toBeNull()
  })

  it('defaults acceptance criteria to an empty array', () => {
    const serialized = serializeDriveLockDirective({
      driveId: 'd',
      goal: 'g',
    })
    const parsed = parseDriveLockDirective(serialized)
    expect(parsed?.acceptanceCriteria).toEqual([])
  })

  it('strips exactly the three interactive tools', () => {
    expect([...DRIVE_STRIPPED_TOOL_NAMES].sort()).toEqual([
      'ask_user',
      'end_turn',
      'suggest_followups',
    ])
  })

  it('round-trips a <drive-control> directive', () => {
    const serialized = serializeDriveControlDirective(
      'stop',
      'operator request',
    )
    const parsed = parseDriveControlDirective(serialized)
    expect(parsed?.action).toBe('stop')
    expect(parsed?.reason).toBe('operator request')
  })

  it('parses a <drive-control> directive without a reason', () => {
    const parsed = parseDriveControlDirective(
      serializeDriveControlDirective('resume'),
    )
    expect(parsed?.action).toBe('resume')
    expect(parsed?.reason).toBeUndefined()
  })
})
