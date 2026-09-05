import { describe, expect, test } from 'bun:test'

import {
  lastFiredText,
  triggerReceiptLine,
  validateCreateForm,
} from '../TriggersPanel'

import type { TriggerRecord } from '../../../lib/gateway-protocol'

function record(overrides: Partial<TriggerRecord> = {}): TriggerRecord {
  return {
    id: 'trg_1',
    name: 'ci',
    createdAt: '2026-09-01T00:00:00.000Z',
    enabled: true,
    ...overrides,
  }
}

describe('trigger receipt lines (calendar receipts)', () => {
  test('webhook-only triggers say so honestly', () => {
    expect(triggerReceiptLine(record({ recurrence: undefined }))).toBe(
      'webhook-only',
    )
  })

  test('scheduled triggers show the recurrence and the next run time', () => {
    const line = triggerReceiptLine(
      record({
        recurrence: '*/5 * * * *',
        nextRunAt: '2026-09-03T10:30:00.000Z',
      }),
    )
    expect(line).toContain('*/5 * * * *')
    expect(line).toMatch(/next \d/)
  })

  test('a corrupt nextRunAt degrades to unscheduled, never throws', () => {
    const line = triggerReceiptLine(
      record({ recurrence: '0 3 * * *', nextRunAt: 'banana' }),
    )
    expect(line).toContain('0 3 * * *')
    expect(line).toContain('unscheduled')
  })
})

describe('last-fired receipt text', () => {
  const now = new Date('2026-09-03T12:00:00.000Z')

  test('never-fired triggers get an honest note', () => {
    expect(lastFiredText(undefined, now)).toBe('never fired')
    expect(lastFiredText('garbage', now)).toBe('never fired')
  })

  test('recent fires round to the human unit', () => {
    expect(lastFiredText('2026-09-03T11:59:30.000Z', now)).toBe('just now')
    expect(lastFiredText('2026-09-03T11:30:00.000Z', now)).toBe('30m ago')
    expect(lastFiredText('2026-09-03T09:00:00.000Z', now)).toBe('3h ago')
    expect(lastFiredText('2026-09-01T12:00:00.000Z', now)).toBe('2d ago')
  })
})

describe('create-form validation', () => {
  test('name is required', () => {
    expect(validateCreateForm({ name: '', recurrence: '' })).toBe(
      'Name is required',
    )
    expect(validateCreateForm({ name: '   ', recurrence: '' })).toBe(
      'Name is required',
    )
  })

  test('recurrence must look like a 5-field cron (or be empty)', () => {
    expect(validateCreateForm({ name: 'x', recurrence: '* * *' })).toBe(
      'Recurrence must be a 5-field cron expression',
    )
    expect(validateCreateForm({ name: 'x', recurrence: '' })).toBeNull()
    expect(
      validateCreateForm({ name: 'x', recurrence: '*/5 * * * *' }),
    ).toBeNull()
  })
})
