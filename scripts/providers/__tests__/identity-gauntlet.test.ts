// FID-2026-1007-008 — identity gauntlet engine pins.
//
// The engine's value is what it REFUSES to conclude, so most of these pins are
// about the ways a run must end in `inconclusive` rather than in a mismatch:
// no control, an unavailable control, one probe, a timeout, absent usage. The
// rest hold the operational promises — bounded budget, redacted evidence, no
// routing mutation, and no uncalibrated composite score.
import { describe, expect, test } from 'bun:test'

import { redactSample, tokenizerOverhead } from '../lib/identity-core'
import { compositeFor, runIdentityGauntlet } from '../lib/identity-runner'

import type {
  GauntletReport,
  IdentityTarget,
  IdentityVector,
  ProbeInvoker,
  ProbeManifest,
  ProbeSample,
  ProbeSpec,
} from '../lib/identity-core'

const NOW = 1_700_000_000_000

const target = (provider: string, model: string): IdentityTarget => ({
  provider,
  requestedModel: model,
  baseUrl: `https://${provider}.example/v1`,
})

const spec = (id: string, vector: IdentityVector): ProbeSpec => ({
  id,
  vector,
  claim: 'the served model id matches the requested model id',
  prompt: `gauntlet probe ${id}`,
})

const manifest = (overrides: Partial<ProbeManifest> = {}): ProbeManifest => ({
  version: 'manifest/1',
  target: target('hcnsec', 'kimi-k3'),
  budget: { maxAttempts: 20, maxTotalTokens: 100_000, maxWallMs: 60_000 },
  probes: [spec('p-a', 'A'), spec('p-b', 'B'), spec('p-c', 'C')],
  controls: {
    sameModel: target('tokenbom', 'kimi-k3'),
    differentModel: target('openai', 'gpt-5'),
  },
  ...overrides,
})

const sample = (
  probeId: string,
  text: string,
  extra: Partial<ProbeSample> = {},
): ProbeSample => ({ probeId, text, latencyMs: 12, ...extra })

/**
 * Text keyed by provider, so a target and its control can be made to agree or
 * disagree deliberately.
 */
const texts = (byProvider: Record<string, string>): ProbeInvoker => {
  return async (called: IdentityTarget, probe: ProbeSpec) =>
    sample(probe.id, byProvider[called.provider] ?? '', {
      servedModel: called.requestedModel,
      usage: { inputTokens: 10, outputTokens: 4 },
    })
}

const run = (
  options: Parameters<typeof runIdentityGauntlet>[0],
): Promise<GauntletReport> =>
  runIdentityGauntlet({
    now: () => NOW,
    ...options,
  })

describe('identity gauntlet engine (FID-2026-1007-008)', () => {
  test('agreeing with the same-model control verifies only the tested claims', async () => {
    const report = await run({
      manifest: manifest(),
      invoke: texts({
        hcnsec: 'The answer is forty two.',
        tokenbom: 'the answer is forty two',
        openai: '42',
      }),
    })
    expect(report.controls.sameModel).toBe('matched')
    expect(report.controls.differentModel).toBe('separated')
    expect(report.verdict).toBe('verified-for-tested-claims')
    expect(report.testedClaims).toHaveLength(1)
    expect(report.exhausted).toBe(false)
  })

  test('separating from the same-model control is a review, not a verdict', async () => {
    const report = await run({
      manifest: manifest(),
      invoke: texts({
        hcnsec: 'completely different output',
        tokenbom: 'the answer is forty two',
        openai: '42',
      }),
    })
    expect(report.controls.sameModel).toBe('separated')
    expect(report.verdict).toBe('mismatch-requiring-review')
  })

  test('no controls means inconclusive, never a mismatch', async () => {
    const report = await run({
      manifest: manifest({ controls: undefined }),
      invoke: texts({ hcnsec: 'anything' }),
    })
    expect(report.verdict).toBe('inconclusive')
    expect(report.evidence).toContain('same-model control: not configured')
  })

  test('an unavailable control means inconclusive', async () => {
    const invoke: ProbeInvoker = async (called, probe) => {
      if (called.provider === 'tokenbom')
        throw new Error('connect ECONNREFUSED')
      return sample(probe.id, 'anything', { usage: { inputTokens: 10 } })
    }
    const report = await run({ manifest: manifest(), invoke })
    expect(report.controls.sameModel).toBe('unavailable')
    expect(report.verdict).toBe('inconclusive')
  })

  test('one completed probe never decides (false-positive restraint)', async () => {
    const invoke: ProbeInvoker = async (called, probe) => {
      if (called.provider === 'hcnsec' && probe.id !== 'p-a') {
        throw new Error('timeout while reading response')
      }
      return sample(probe.id, 'same text', { usage: { inputTokens: 10 } })
    }
    const report = await run({ manifest: manifest(), invoke })
    expect(report.verdict).toBe('inconclusive')
  })

  test('a timeout is classified as timeout and leaves the vector with no signal', async () => {
    const invoke: ProbeInvoker = async (called, probe) => {
      if (probe.id === 'p-a' && called.provider === 'hcnsec') {
        throw new Error('request timeout')
      }
      return sample(probe.id, 'same text', { usage: { inputTokens: 10 } })
    }
    const report = await run({ manifest: manifest(), invoke })
    const vectorA = report.vectors.find((v) => v.vector === 'A')
    expect(vectorA?.status).toBe('no-signal')
    expect(vectorA?.completed).toBe(0)
    expect(vectorA?.evidence.join(' ')).toContain('timeout')
  })

  test('absent usage is no signal, not a tokenizer breach', async () => {
    const invoke: ProbeInvoker = async (called, probe) =>
      sample(probe.id, 'a plausible answer', {
        servedModel: called.requestedModel,
      })
    const report = await run({ manifest: manifest(), invoke })
    const vectorA = report.vectors.find((v) => v.vector === 'A')
    expect(vectorA?.status).toBe('no-signal')
    expect(vectorA?.evidence.join(' ')).toContain('no token usage')
  })

  test('tokenizer overhead has a wide band and no verdict at either edge', () => {
    expect(tokenizerOverhead(100, 100)?.withinBand).toBe(true)
    expect(tokenizerOverhead(240, 100)?.withinBand).toBe(true)
    expect(tokenizerOverhead(400, 100)?.withinBand).toBe(false)
    expect(tokenizerOverhead(40, 100)?.withinBand).toBe(false)
    expect(tokenizerOverhead(10, 0)).toBeNull()
    expect(tokenizerOverhead(Number.NaN, 10)).toBeNull()
  })

  test('the attempt budget stops the run and says so', async () => {
    const report = await run({
      manifest: manifest({
        budget: { maxAttempts: 1, maxTotalTokens: 100_000, maxWallMs: 60_000 },
        controls: undefined,
      }),
      invoke: texts({ hcnsec: 'x' }),
    })
    expect(report.exhausted).toBe(true)
    expect(report.exhaustionReason).toBe('attempts')
    expect(report.attemptsUsed).toBe(1)
    expect(report.evidence.join(' ')).toContain('budget exhausted (attempts)')
  })

  test('the token budget stops the run', async () => {
    const invoke: ProbeInvoker = async (called, probe) =>
      sample(probe.id, 'x', { usage: { inputTokens: 5_000 } })
    const report = await run({
      manifest: manifest({
        budget: {
          maxAttempts: 50,
          maxTotalTokens: 6_000,
          maxWallMs: 60_000,
        },
        controls: undefined,
      }),
      invoke,
    })
    expect(report.exhausted).toBe(true)
    expect(report.exhaustionReason).toBe('tokens')
  })

  test('the wall budget stops the run on an injected clock', async () => {
    let clock = NOW
    const invoke: ProbeInvoker = async (called, probe) => {
      clock += 40_000
      return sample(probe.id, 'x', { usage: { inputTokens: 1 } })
    }
    const report = await runIdentityGauntlet({
      manifest: manifest({
        budget: { maxAttempts: 50, maxTotalTokens: 100_000, maxWallMs: 60_000 },
        controls: undefined,
      }),
      invoke,
      now: () => clock,
    })
    expect(report.exhausted).toBe(true)
    expect(report.exhaustionReason).toBe('wall')
  })

  test('credentials never reach the evidence', async () => {
    const invoke: ProbeInvoker = async (called, probe) =>
      sample(probe.id, 'answer with sk-abcdef123456 key noted', {
        headers: {
          authorization: 'Bearer sk-abcdef123456',
          'x-request-id': 'req-9',
        },
        failure: { class: 'error', message: 'used key sk-abcdef123456' },
      })
    const report = await run({
      manifest: manifest({ controls: undefined }),
      invoke,
    })
    for (const redacted of report.redactedSamples) {
      expect(redacted.headers?.['authorization']).toBe('[redacted]')
      expect(redacted.headers?.['x-request-id']).toBe('req-9')
      expect(redacted.text).not.toContain('sk-abcdef123456')
      expect(redacted.failure?.message).not.toContain('sk-abcdef123456')
    }
    expect(JSON.stringify(report.redactedSamples)).not.toContain(
      'sk-abcdef123456',
    )
  })

  test('redaction is tolerant of absent headers and absent failures', () => {
    const clean = redactSample({ probeId: 'p', text: 'ok', latencyMs: 1 })
    expect(clean.headers).toBeUndefined()
    expect(clean.failure).toBeUndefined()
  })

  test('no composite score exists without held-out calibration', async () => {
    const report = await run({
      manifest: manifest(),
      invoke: texts({ hcnsec: 'x', tokenbom: 'x', openai: 'y' }),
    })
    expect(report.composite).toBeUndefined()
    expect(compositeFor(undefined, report.vectors)).toBeUndefined()
  })

  test('a calibrated composite carries its components and is not 0.85', () => {
    const composite = compositeFor({ positiveRate: 0.02, negativeRate: 0.03 }, [
      {
        vector: 'A',
        probes: 1,
        completed: 1,
        status: 'consistent',
        evidence: [],
      },
      {
        vector: 'B',
        probes: 1,
        completed: 1,
        status: 'inconsistent',
        evidence: [],
      },
      {
        vector: 'C',
        probes: 1,
        completed: 0,
        status: 'no-signal',
        evidence: [],
      },
    ])
    expect(composite?.components).toEqual({
      vector_A: 1,
      vector_B: 0,
      vector_C: 0,
    })
    expect(composite?.score).toBeCloseTo(1 / 3, 10)
    expect(composite?.score).not.toBe(0.85)
  })
})
