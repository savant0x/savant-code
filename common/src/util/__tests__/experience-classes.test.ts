import { describe, expect, test } from 'bun:test'

import {
  experienceClassIdentity,
  summarizeExperienceClasses,
} from '../experience-classes'

import type { ExperienceRecord } from '../../types/experience'

function record(toolName: string, errorFirstLine: string): ExperienceRecord {
  return {
    toolName,
    errorFirstLine,
    ts: '2026-09-01T00:00:00.000Z',
    triggerType: 'tool_failure',
    contextHash: '',
    sessionId: 'fixture',
  }
}

describe('FID-2026-1012-024 stable class identity', () => {
  test('budgets are instances of one timeout cause', () => {
    expect(
      experienceClassIdentity(
        record('run_terminal_command', 'Command timed out after 30 seconds'),
      ).key,
    ).toBe(
      experienceClassIdentity(
        record('run_terminal_command', 'Command timed out after 600 seconds'),
      ).key,
    )
  })

  test('the pre-fix constant names the missing cause, never a diagnosis', () => {
    // FID-2026-1012-024 Step 4: the constant line was a *rendering* of a
    // failure, not a cause. The bucket says so, keeps tool identity, and stays
    // unresolved — it must not read as a classification attempt.
    const a = record('read_url', 'tool result contains an error')
    const b = record('skill_manage', 'tool result contains an error')
    expect(experienceClassIdentity(a).cause).toBe('cause-not-recorded')
    expect(experienceClassIdentity(a).key).not.toBe(
      experienceClassIdentity(b).key,
    )
    expect(
      summarizeExperienceClasses([a, b]).every(
        (entry) => entry.state === 'unresolved',
      ),
    ).toBe(true)
  })

  test('an unrecognised message keeps its own reproducible identity', () => {
    const cause = experienceClassIdentity(
      record('code_search', 'an entirely new failure message'),
    ).cause
    expect(cause).toMatch(/^unrecognised-[a-f0-9]{64}$/)
  })

  test('undetermined HTTP outcomes are not silently demoted to expected', () => {
    expect(
      experienceClassIdentity(
        record('read_url', 'Failed to fetch URL: 404 Not Found'),
      ).expectedness,
    ).toBe('undetermined')
  })

  test('explicit expectedness is preserved in the key', () => {
    const failure = record('read_url', 'Failed to fetch URL: 404 Not Found')
    expect(
      experienceClassIdentity({ ...failure, expectedness: 'expected' }).key,
    ).not.toBe(
      experienceClassIdentity({ ...failure, expectedness: 'unexpected' }).key,
    )
  })

  test('unknown messages are not merged into one cause', () => {
    expect(
      experienceClassIdentity(record('fixture', 'first unknown cause')).key,
    ).not.toBe(
      experienceClassIdentity(record('fixture', 'second unknown cause')).key,
    )
  })

  test('horizons retain all old rows and legacy aliases', () => {
    const a = record(
      'run_terminal_command',
      'Command timed out after 30 seconds',
    )
    const b = {
      ...record('run_terminal_command', 'Command timed out after 60 seconds'),
      ts: '2026-10-01T00:00:00.000Z',
      sessionId: 'other',
    }
    const summary = summarizeExperienceClasses([b, a])[0]
    expect(summary?.count).toBe(2)
    expect(summary?.legacyKeys).toHaveLength(2)
    expect(summary?.firstSeen).toBe(a.ts)
    expect(summary?.lastSeen).toBe(b.ts)
    expect(summary?.sessions).toHaveLength(2)
    expect(summary?.state).toBe('unresolved')
  })
})
