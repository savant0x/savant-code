/**
 * FID-2026-0915-002 (split 4) — report render pins, moved verbatim from
 * harvest-core.test.ts (the render half of the
 * `renderReport + writeReportStable (MQ8)` describe; the write/guard half
 * lives in report-write.test.ts — split when this file measured 304).
 */
import { describe, expect, test } from 'bun:test'

import { renderReport } from '../lib/report'

describe('renderReport (MQ8)', () => {
  const reportInput = {
    fetchedAtUtc: '2026-09-14T18:48:23Z',
    totalRecords: 214,
    stage0Count: 2,
    candidates: [
      {
        host: 'api.example-free.ai',
        category: 'first-party-free',
        modelsCount: 12,
        latencyMs: 320,
        boundary: 'boundary-ok' as const,
        typosquat: 'pass' as const,
      },
    ],
    auditTrail: [
      {
        host: 'api.celebras.ai',
        decision: 'rejected',
        reason: 'typosquat tier-1: distance 1 from api.cerebras.ai',
      },
      {
        host: 'a.risky',
        decision: 'excluded',
        reason: 'status=risky (MQ2 hard-exclusion)',
      },
      {
        host: 'a.relay',
        decision: 'excluded',
        reason: 'category=free-relay (anonymous relay class)',
      },
    ],
    sections: {
      newHosts: ['api.example-free.ai'],
      changedHosts: [] as string[],
      lapsedHosts: [] as string[],
      health: [] as Array<{ host: string; verdict: string }>,
    },
  }

  test('report carries header, candidate table, and a reason for every audit row', () => {
    const md = renderReport(reportInput)
    expect(md).toContain('2026-09-14T18:48:23Z')
    expect(md).toContain('api.example-free.ai')
    // Display contract: boundary-ok renders as 'ok' in the table.
    expect(md).toContain('| ok |')
    // Data-backed: every audit decision cites its reason in its group
    // heading (counted groups carry the reason for every member host).
    expect(md).toContain('### Excluded · status=risky (MQ2 hard-exclusion) — 1')
    expect(md).toContain(
      '### Excluded · category=free-relay (anonymous relay class — LLMjacking) — 1',
    )
    // Tier-1 rejections group under their reason.
    expect(md).toContain('### Rejected · typosquat tier-1 — 1')
    expect(md).toContain('api.celebras.ai')
  })

  test('professional structure: summary table, grouped sorted candidates, counted audit', () => {
    const md = renderReport({
      ...reportInput,
      candidates: [
        {
          host: 'a.ok-many',
          category: 'first-party-free',
          modelsCount: 12,
          latencyMs: 200,
          boundary: 'boundary-ok',
          typosquat: 'pass',
          classification: 'unchanged',
          downStreak: 0,
          models: [
            'llama-3.3-70b',
            'qwen3-coder',
            'glm-4.5-air',
            'gpt-oss-120b',
            'gemma-4-31b',
            'nemotron-ultra',
            'deepseek-v4',
            'kimi-k2',
          ],
        },
        {
          host: 'b.ok-few',
          category: 'first-party-free',
          modelsCount: 0,
          latencyMs: 300,
          boundary: 'boundary-ok',
          typosquat: 'pass',
          classification: 'unchanged',
          downStreak: 0,
          models: ['jamba-large', 'jamba-mini'],
        },
        {
          host: 'c.unverified',
          category: 'first-party-free',
          modelsCount: null,
          latencyMs: 100,
          boundary: 'boundary-unverifiable',
          typosquat: 'pass',
          classification: 'new',
          downStreak: 0,
          models: [],
        },
        {
          host: 'd.relay',
          category: 'commercial-aggregator',
          modelsCount: 5,
          latencyMs: 90,
          boundary: 'open-relay-reject',
          typosquat: 'pass',
          classification: 'unchanged',
          downStreak: 0,
          models: [],
        },
      ],
      auditTrail: [
        {
          host: 'demo.voapi.top',
          decision: 'excluded',
          reason: 'status=risky (MQ2 hard-exclusion)',
        },
        {
          host: 'routerpark.com',
          decision: 'excluded',
          reason: 'status=risky (MQ2 hard-exclusion)',
        },
        {
          host: 'api.celebras.ai',
          decision: 'excluded',
          reason: 'status=down (dead endpoint)',
        },
        {
          host: 'open.relay',
          decision: 'rejected',
          reason:
            'open relay — unauthenticated generation succeeded (LLMjacking class)',
        },
        {
          host: 'api.cohere.ai',
          decision: 'flagged',
          reason:
            'typosquat tier-2 — closest vendor host api.cohere.com at Levenshtein distance 3',
        },
      ],
      sections: {
        newHosts: ['c.unverified'],
        changedHosts: [],
        lapsedHosts: [],
        health: [],
      },
    })
    // Executive summary first.
    expect(md.indexOf('## Summary')).toBeLessThan(md.indexOf('## Candidates'))
    expect(md).toContain('Stage-0 candidates')
    // Candidates grouped by category, sorted by readiness (ok+models first).
    expect(md).toContain('### First-party free tiers')
    expect(md).toContain('### Commercial aggregators')
    // Order within the CANDIDATES section (the changes section names
    // c.unverified first, so a bare indexOf would false-fail).
    const candSection = md.slice(
      md.indexOf('## Candidates by readiness'),
      md.indexOf('## Audit trail'),
    )
    expect(candSection.indexOf('a.ok-many')).toBeLessThan(
      candSection.indexOf('c.unverified'),
    )
    expect(candSection.indexOf('b.ok-few')).toBeLessThan(
      candSection.indexOf('c.unverified'),
    )
    // Models available: probed count renders plain; feed-listed count
    // carries the † marker (0 from the probe ≠ no models); no models = —.
    // The roster itself is capped (6 names + a +K more tail).
    expect(candSection).toContain('Model availability')
    expect(candSection).toContain('**a.ok-many** (12 probed)')
    expect(candSection).toContain('(+2 more)')
    expect(candSection).toContain('**b.ok-few** (2 feed-listed†)')
    expect(candSection).toContain('jamba-large, jamba-mini')
    // Nothing measured (no probe count, no feed list) renders '—',
    // never a fabricated count (line-scoped to the host's row).
    for (const line of candSection.split('\n')) {
      if (line.startsWith('| c.unverified ')) {
        expect(line).toContain('| — |')
      }
    }
    // The 'Models' column never lies: feed-listed count shows as N†,
    // never a bare 0 for a host whose list is merely hidden.
    expect(candSection).toContain('| 2† |')
    expect(candSection).not.toContain('| 0 |')
    // Constant noise is suppressed, standing verdicts are shown.
    expect(md).not.toContain('not-probed-this-run')
    expect(md).toContain('RELAY')
    // The relay host is demoted to the bottom of its group.
    expect(md.indexOf('c.unverified')).toBeLessThan(md.indexOf('d.relay'))
    // Audit trail is counted + grouped, not a one-bullet-per-host dump.
    expect(md).toContain('### Excluded · status=risky (MQ2 hard-exclusion) — 2')
    expect(md).toContain('### Rejected · open relay — 1')
    // Completeness: every host still present, flagged keeps its reason.
    for (const h of [
      'demo.voapi.top',
      'routerpark.com',
      'api.celebras.ai',
      'open.relay',
    ]) {
      expect(md).toContain(h)
    }
    expect(md).toContain('api.cohere.com')
    // Changes section only exists when there are changes.
    expect(md).toContain("This run's changes")
    const stable = renderReport({
      ...reportInput,
      sections: { newHosts: [], changedHosts: [], lapsedHosts: [], health: [] },
    })
    expect(stable).not.toContain("This run's changes")
  })
})
