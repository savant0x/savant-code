// FID-2026-1007-008 — report pins. The report is what makes the tool re-usable,
// so what it must NOT do matters as much as what it prints: it must not leak a
// credential, must not drop the `inconclusive` outcome, and must refuse to write
// outside dev/.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  renderIdentityReport,
  writeIdentityReport,
} from '../lib/identity-report'

import type { GauntletReport } from '../lib/identity-core'

const report = (overrides: Partial<GauntletReport> = {}): GauntletReport => ({
  manifestVersion: 'identity-manifest/1',
  target: {
    provider: 'hcnsec',
    requestedModel: 'kimi-k3',
    baseUrl: 'https://api.hcnsec.cn/v1',
  },
  budget: { maxAttempts: 25, maxTotalTokens: 40_000, maxWallMs: 300_000 },
  attemptsUsed: 15,
  tokensUsed: 0,
  wallMs: 7942,
  exhausted: false,
  vectors: [
    {
      vector: 'A',
      probes: 1,
      completed: 0,
      status: 'no-signal',
      evidence: ['no probe completed (http-500)'],
    },
  ],
  controls: { sameModel: 'unavailable', differentModel: 'unavailable' },
  verdict: 'inconclusive',
  testedClaims: [
    'reported input-token counts are consistent with the response text',
  ],
  evidence: [
    '5 of 5 target probe(s) completed',
    'same-model control: unavailable',
  ],
  redactedSamples: [
    {
      probeId: 'probe-A',
      text: '',
      latencyMs: 1401,
      failure: { class: 'http-500', message: 'no available channel' },
    },
  ],
  ...overrides,
})

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

describe('identity gauntlet report (FID-2026-1007-008)', () => {
  test('the report states the verdict, target, controls and the negative bound', () => {
    const markdown = renderIdentityReport(report(), {
      generatedAt: '2026-10-07T00:00:00.000Z',
    })
    expect(markdown).toContain('**inconclusive**')
    expect(markdown).toContain('hcnsec')
    expect(markdown).toContain('kimi-k3')
    expect(markdown).toContain('same-model `unavailable`')
    expect(markdown).toContain('## What this does not prove')
    expect(markdown).toContain('http-500')
  })

  test('the exact command is recorded so a run is reproducible', () => {
    const markdown = renderIdentityReport(report(), {
      generatedAt: 'x',
      command: 'bun run providers:identity -- --provider hcnsec',
    })
    expect(markdown).toContain(
      'bun run providers:identity -- --provider hcnsec',
    )
  })

  test('no credential-shaped value reaches the report', () => {
    const markdown = renderIdentityReport(report(), { generatedAt: 'x' })
    expect(markdown).not.toContain('Bearer')
    expect(markdown).not.toMatch(/sk-[A-Za-z0-9]{8,}/)
  })

  test('writing produces both artifacts under dev/', () => {
    const base = mkdtempSync(join(tmpdir(), 'identity-report-'))
    dirs.push(base)
    const { reportPath, statePath } = writeIdentityReport(
      report(),
      { generatedAt: '2026-10-07T00:00:00.000Z' },
      'dev/provider-identity',
      () => base,
    )
    expect(reportPath.endsWith('identity-report.md')).toBe(true)
    expect(readFileSync(reportPath, 'utf8')).toContain('**inconclusive**')
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    expect(state.report.verdict).toBe('inconclusive')
  })

  test('writing outside dev/ is refused', () => {
    expect(() =>
      writeIdentityReport(report(), { generatedAt: 'x' }, 'reports'),
    ).toThrow(/outside dev\//)
  })
})
