import { describe, expect, test } from 'bun:test'

import {
  COUNT_SCOPE_RULE_AGGREGATE,
  EXPERIENCE_CLUSTER_GAP_MS,
  countedUnitHead,
  experienceClassIdentity,
  formatCountedUnit,
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

  test('a guard refusal is its own cause; the legacy rendering keeps its own', () => {
    // The producer declares a refusal on its own channel, so a validation
    // refusal never reads as an execution outcome.
    expect(
      experienceClassIdentity(
        record(
          'run_readonly_command',
          'run_readonly_command rejected: Command contains forbidden shell metacharacters',
        ),
      ).cause,
    ).toBe('refused')
    expect(
      experienceClassIdentity(
        record(
          'run_readonly_command',
          'Command exited with code 127: /usr/bin/bash: head: command not found',
        ),
      ).cause,
    ).toBe('command-exit')
    // Rows already in the ledger store the pre-split rendering, and
    // `inspectLedger` rejects a row whose stored key disagrees with its cause.
    // This spelling must therefore keep deriving `command-exit`: a taxonomy
    // change may only claim lines that no stored row carries.
    expect(
      experienceClassIdentity(
        record(
          'run_readonly_command',
          'Command exited with code 1: run_readonly_command rejected: Command contains forbidden shell metacharacters',
        ),
      ).cause,
    ).toBe('command-exit')
  })

  test('a real exit that merely quotes the refusal text is still an exit', () => {
    expect(
      experienceClassIdentity(
        record(
          'run_readonly_command',
          'Command exited with code 1: ./a.ts: run_readonly_command rejected: x',
        ),
      ).cause,
    ).toBe('command-exit')
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

  test('FID-2026-1024-001 D5: captured rows fork once and history keeps its identity', () => {
    // One tool, one line, two generations: the historical row carries no
    // expectedness field and derives `undetermined`; the row captured after
    // the producer evidence flip stores `expected` and lands on the additive
    // sibling. Neither rewrites the other.
    const exit = 'Command exited with code 1: bun test src/'
    const historical = record('run_terminal_command', exit)
    const forked = {
      ...record('run_terminal_command', exit),
      expectedness: 'expected' as const,
    }
    expect(experienceClassIdentity(historical).key).toBe(
      'v1:run_terminal_command:command-exit:undetermined',
    )
    expect(experienceClassIdentity(forked).key).toBe(
      'v1:run_terminal_command:command-exit:expected',
    )
    const summaries = summarizeExperienceClasses([historical, forked])
    expect(summaries.map((entry) => entry.count)).toEqual([1, 1])
  })

  test('unknown messages are not merged into one cause', () => {
    expect(
      experienceClassIdentity(record('fixture', 'first unknown cause')).key,
    ).not.toBe(
      experienceClassIdentity(record('fixture', 'second unknown cause')).key,
    )
  })

  test('a message clause added to a class keeps that class (additive rule)', () => {
    // FID-2026-1012-017 Loop 6 appended the rejected field path to the
    // native-incomplete recovery text. Both spellings are `native-incomplete`,
    // so the cause short-circuits before the pattern table is consulted and the
    // class key cannot move: the rows already in the ledger keep their stored
    // identity and the recurrence probe keeps measuring one class.
    const before = {
      ...record(
        'suggest_followups',
        "Incomplete arguments for tool suggest_followups: the provider rejected the call's arguments and nothing observed indicates truncation. Correct the argument values so they satisfy the tool schema, then re-emit the call once.",
      ),
      errorClass: 'native-incomplete' as const,
    }
    const after = {
      ...record(
        'suggest_followups',
        "Incomplete arguments for tool suggest_followups: the provider rejected the call's arguments and nothing observed indicates truncation. The arguments failed the tool schema at: followups[0].prompt — invalid_type (expected string). Correct the argument values so they satisfy the tool schema, then re-emit the call once.",
      ),
      errorClass: 'native-incomplete' as const,
    }
    expect(experienceClassIdentity(after).key).toBe(
      experienceClassIdentity(before).key,
    )
    expect(experienceClassIdentity(after).key).toBe(
      'v1:suggest_followups:incomplete-arguments:unexpected',
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

  test('clusters sort copied times and split at the exact gap', () => {
    const base = record('read_url', 'Failed to fetch URL: 404 Not Found')
    const rows = [120_000, 59_999, 0, 119_999].map((offset) => ({
      ...base,
      ts: new Date(Date.parse(base.ts) + offset).toISOString(),
    }))
    const before = JSON.stringify(rows)
    const summary = summarizeExperienceClasses(rows)[0]
    expect(summary?.count).toBe(4)
    expect(summary?.timeClusters).toBe(2)
    expect(summary?.largestTimeCluster).toBe(2)
    expect(summary?.clusterGapMs).toBe(EXPERIENCE_CLUSTER_GAP_MS)
    expect(JSON.stringify(rows)).toBe(before)
    expect(summarizeExperienceClasses([...rows].reverse())).toEqual(
      summarizeExperienceClasses(rows),
    )
  })

  test('simultaneous rows in different sessions or classes never merge', () => {
    const base = record('read_url', 'Failed to fetch URL: 404 Not Found')
    const summaries = summarizeExperienceClasses([
      base,
      { ...base, sessionId: 'other' },
      { ...base, errorFirstLine: 'Failed to fetch URL: 403 Forbidden' },
    ])
    expect(summaries.map((entry) => entry.timeClusters)).toEqual([2, 1])
    expect(summaries.map((entry) => entry.largestTimeCluster)).toEqual([1, 1])
  })

  test('a chain spanning minutes is a time cluster, not a response claim', () => {
    const base = record('read_url', 'Failed to fetch URL: 404 Not Found')
    const rows = [0, 50_000, 100_000, 150_000].map((offset) => ({
      ...base,
      ts: new Date(Date.parse(base.ts) + offset).toISOString(),
    }))
    const summary = summarizeExperienceClasses(rows)[0]
    expect(summary?.timeClusters).toBe(1)
    expect(summary?.largestTimeCluster).toBe(4)
  })

  test('invalid timestamps stay isolated without splitting valid clusters', () => {
    const base = record('read_url', 'Failed to fetch URL: 404 Not Found')
    const rows = [base, { ...base, ts: 'invalid' }, base]
    const summary = summarizeExperienceClasses(rows)[0]
    expect(summary?.count).toBe(3)
    expect(summary?.timeClusters).toBe(2)
    expect(summary?.largestTimeCluster).toBe(2)
    expect(summarizeExperienceClasses([...rows].reverse())).toEqual(
      summarizeExperienceClasses(rows),
    )
    expect(summarizeExperienceClasses([])).toEqual([])
  })
})

describe('counted unit rendering (FID-2026-1021-001)', () => {
  test('a single class counts the class, and the exemplar is marked as one', () => {
    expect(countedUnitHead({ cause: 'command-exit', count: 3 })).toBe(
      'command-exit ×3',
    )
    expect(
      formatCountedUnit({
        cause: 'command-exit',
        count: 3,
        exemplar: 'head: command not found',
      }),
    ).toBe('command-exit ×3; e.g. head: command not found')
  })

  test('an aggregate states its span and names the top class', () => {
    expect(
      countedUnitHead({
        cause: 'command-exit',
        count: 48,
        scope: COUNT_SCOPE_RULE_AGGREGATE,
      }),
    ).toBe(`48× ${COUNT_SCOPE_RULE_AGGREGATE} (top class: command-exit)`)
  })

  test('the head never carries the exemplar (a truncated class is not an identity)', () => {
    const head = countedUnitHead({
      cause: `unrecognised-${'a'.repeat(64)}`,
      count: 2,
    })
    expect(head).not.toContain('e.g.')
    expect(head.startsWith('unrecognised-')).toBe(true)
  })
})
