/**
 * FID-2026-0914-003 — Loop-5 seam pins (RED-first).
 *
 * Production-surface contracts: the custom-provider provenance stamp
 * (round-trip through the single validation truth), the health/401-drift
 * verdicts for tracked providers, the sanitized bounded agent-context block,
 * and the boot-check 24h gating. All pure logic — no network, no disk.
 */
import { describe, expect, test } from 'bun:test'

import { shouldRunBootCheck } from '@savant-code/common/providers/discovery-boot'
import {
  buildDiscoveryContextBlock,
  summarizeForContext,
} from '@savant-code/common/providers/discovery-context'

import { healthVerdict, PROBE_LAPSED_AFTER_DAYS } from '../lib/health'
import { isPipelineSourced, readStamp, writeStamp } from '../lib/provider-stamp'

describe('provider stamp (round-trip through parseCustomProviders)', () => {
  const base = {
    id: 'swiftfree',
    label: 'SwiftFree',
    baseUrl: 'https://api.swiftfree.ai/v1',
    apiKeyEnvVar: 'SWIFTFREE_API_KEY',
    catalog: { source: 'none' },
  }

  test('writeStamp adds source+acceptedAt; readStamp extracts them', () => {
    const stamped = writeStamp(base, '2026-09-15T08:00:00.000Z')
    expect(stamped.source).toBe('discovery-pipeline')
    expect(stamped.acceptedAt).toBe('2026-09-15T08:00:00.000Z')
    const stamp = readStamp(stamped)
    expect(stamp?.source).toBe('discovery-pipeline')
    expect(stamp?.acceptedAt).toBe('2026-09-15T08:00:00.000Z')
  })

  test('hand-written configs without the stamp read as null (not pipeline-sourced)', () => {
    expect(readStamp(base)).toBeNull()
    expect(isPipelineSourced(base)).toBe(false)
  })

  test('parseCustomProviders PRESERVES the stamp (drop = tracking breaks)', () => {
    // Pin the exact preservation contract: the parser tolerates extra keys
    // but currently DROPS them — the amended parser must carry them through.
    const stamped = writeStamp(base, '2026-09-15T08:00:00.000Z')
    const { parseCustomProviders } =
      require('@savant-code/common/providers/custom-providers') as {
        parseCustomProviders: (v: unknown) => {
          configs: Array<Record<string, unknown>>
          problems: string[]
        }
      }
    const { configs, problems } = parseCustomProviders({
      customProviders: [stamped],
    })
    expect(problems).toEqual([])
    expect(configs.length).toBe(1)
    expect(isPipelineSourced(configs[0])).toBe(true)
  })

  test('stamp validation: malformed source/acceptedAt entries fail closed', () => {
    const { parseCustomProviders } =
      require('@savant-code/common/providers/custom-providers') as {
        parseCustomProviders: (v: unknown) => {
          configs: unknown[]
          problems: string[]
        }
      }
    const badSource = parseCustomProviders({
      customProviders: [{ ...base, source: 'somewhere-else' }],
    })
    expect(badSource.configs.length).toBe(0)
    expect(badSource.problems.join(' ')).toMatch(/source/)

    const badDate = parseCustomProviders({
      customProviders: [
        { ...base, source: 'discovery-pipeline', acceptedAt: 'yesterday' },
      ],
    })
    expect(badDate.configs.length).toBe(0)
    expect(badDate.problems.join(' ')).toMatch(/acceptedAt/)

    const dateOnly = parseCustomProviders({
      customProviders: [{ ...base, acceptedAt: '2026-09-15T08:00:00.000Z' }],
    })
    // Half-stamped records fail closed; the problem names the missing source.
    expect(dateOnly.configs.length).toBe(0)
    expect(dateOnly.problems.join(' ')).toMatch(/source/)
  })
})

describe('health verdicts (Stage E tracking)', () => {
  test('healthy: reachable, models parse, boundary still requires auth', () => {
    expect(
      healthVerdict({
        reachable: true,
        modelsCount: 8,
        boundary: 'boundary-ok',
      }),
    ).toBe('healthy')
  })

  test('401-boundary drift is a compromise signal, never mere downtime', () => {
    expect(
      healthVerdict({
        reachable: true,
        modelsCount: 8,
        boundary: 'open-relay-reject',
      }),
    ).toBe('compromised')
  })

  test('unreachable counts toward lapse; PROBE_LAPSED_AFTER_DAYS is 3 (72h)', () => {
    expect(
      healthVerdict({ reachable: false, modelsCount: 0, boundary: null }),
    ).toBe('down')
    expect(PROBE_LAPSED_AFTER_DAYS).toBe(3)
  })

  test('boundary-unverifiable is degraded, not compromised (no false alarms)', () => {
    expect(
      healthVerdict({
        reachable: true,
        modelsCount: 0,
        boundary: 'boundary-unverifiable',
      }),
    ).toBe('degraded')
  })
})

describe('context block (sanitized, bounded, once-per-set)', () => {
  const candidates = [
    {
      host: 'api.example-free.ai',
      category: 'first-party-free',
      modelsCount: 12,
      boundary: 'boundary-ok' as const,
      typosquat: 'pass' as const,
      classification: 'new' as const,
    },
  ]

  test('carries only host/count/verdict/date facts — never feed prose', () => {
    const block = buildDiscoveryContextBlock({
      fetchedAtUtc: '2026-09-15T08:00:00Z',
      candidates,
      reportPath: 'dev/provider-candidates/report.md',
    })
    expect(block).toContain('api.example-free.ai')
    expect(block).toContain('dev/provider-candidates/report.md')
    // Untrusted freeQuota prose from the feed must never appear.
    expect(block).not.toContain('Free tier:')
  })

  test('is size-capped (host list truncation, hard ceiling)', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      ...candidates[0],
      host: `h${i}.example.dev`,
    }))
    const block = buildDiscoveryContextBlock({
      fetchedAtUtc: '2026-09-15T08:00:00Z',
      candidates: many,
      reportPath: 'dev/provider-candidates/report.md',
    })
    expect(block.length).toBeLessThanOrEqual(1400)
    expect(block).toContain('(and')
    expect(block).toContain('more')
  })

  test('returns empty string when there is nothing new to say (no nag)', () => {
    const empty = buildDiscoveryContextBlock({
      fetchedAtUtc: '2026-09-15T08:00:00Z',
      candidates: [],
      reportPath: 'dev/provider-candidates/report.md',
    })
    expect(empty).toBe('')

    const onlyUnchanged = summarizeForContext({
      fetchedAtUtc: '2026-09-15T08:00:00Z',
      candidates: [{ ...candidates[0], classification: 'unchanged' as const }],
      reportPath: 'dev/provider-candidates/report.md',
      lastAnnouncedSet: JSON.stringify(['api.example-free.ai']),
    })
    expect(onlyUnchanged).toBe('')
  })

  test('re-announces when the candidate set genuinely changes (once per set)', () => {
    const again = summarizeForContext({
      fetchedAtUtc: '2026-09-16T08:00:00Z',
      candidates: [
        ...candidates,
        { ...candidates[0], host: 'second.example.ai' },
      ],
      reportPath: 'dev/provider-candidates/report.md',
      lastAnnouncedSet: JSON.stringify(['api.example-free.ai']),
    })
    expect(again).not.toBe('')
  })
})

describe('boot-check gating (24h cache, report-driven)', () => {
  test('runs when no report exists yet', () => {
    expect(shouldRunBootCheck({ reportExists: false, reportAgeMs: null })).toBe(
      true,
    )
  })

  test('skips when the report is fresh (<24h)', () => {
    expect(
      shouldRunBootCheck({
        reportExists: true,
        reportAgeMs: 2 * 60 * 60 * 1000,
      }),
    ).toBe(false)
  })

  test('runs when the report is stale (>24h)', () => {
    expect(
      shouldRunBootCheck({
        reportExists: true,
        reportAgeMs: 25 * 60 * 60 * 1000,
      }),
    ).toBe(true)
  })

  test('boundary: exactly 24h is fresh (skip)', () => {
    expect(
      shouldRunBootCheck({
        reportExists: true,
        reportAgeMs: 24 * 60 * 60 * 1000,
      }),
    ).toBe(false)
  })
})
