// FID-2026-1007-008 — passive provider identity observation.
//
// The pins are the boundaries, not the plumbing: the seam must add NO request
// to the user's path, must age a verdict into staleness instead of describing
// an endpoint that may have changed, must keep `inconclusive` and a mismatch
// apart, and must never turn a finding into a routing decision.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  identityRouteKey,
  ProviderIdentityObserver,
  type IdentityVerdict,
} from '../provider-boundary/identity-observation'

const SOURCE_PATH = path.join(
  import.meta.dir,
  '..',
  'provider-boundary',
  'identity-observation.ts',
)

const NOW = Date.parse('2026-10-07T12:00:00.000Z')

const verdict = (
  overrides: Partial<IdentityVerdict> = {},
): IdentityVerdict => ({
  provider: 'hcnsec',
  testedClaims: ['served model id matches the requested id'],
  status: 'verified-for-tested-claims',
  datedAt: '2026-10-07T09:00:00.000Z',
  manifestVersion: 'manifest/1',
  evidence: ['served id kimi-k3 observed on 3 of 3 calls'],
  source: 'live',
  ...overrides,
})

describe('provider identity observation (FID-2026-1007-008)', () => {
  test('records only what a completed call already returned', () => {
    const observer = new ProviderIdentityObserver()
    observer.record({
      provider: 'hcnsec',
      requestedModel: 'kimi-k3',
      servedModel: 'moonshotai/kimi-k3',
      observedAt: NOW,
      usage: { inputTokens: 120, outputTokens: 8 },
      metadata: { requestId: 'req-1' },
    })
    const history = observer.history('hcnsec', 'kimi-k3')
    expect(history).toHaveLength(1)
    expect(history[0]?.servedModel).toBe('moonshotai/kimi-k3')
    // A different route is a different bucket.
    expect(observer.history('tokenbom', 'kimi-k3')).toHaveLength(0)
  })

  test('per-route history is bounded and keeps the newest', () => {
    const observer = new ProviderIdentityObserver(3)
    for (let i = 0; i < 5; i++) {
      observer.record({
        provider: 'hcnsec',
        requestedModel: 'kimi-k3',
        observedAt: NOW + i,
      })
    }
    const history = observer.history('hcnsec', 'kimi-k3')
    expect(history).toHaveLength(3)
    expect(history.map((entry) => entry.observedAt)).toEqual([
      NOW + 2,
      NOW + 3,
      NOW + 4,
    ])
  })

  test('adds no request to the user path — mechanically', () => {
    const source = fs.readFileSync(SOURCE_PATH, 'utf8')
    for (const forbidden of [
      'fetch(',
      'Bun.spawn',
      'node:http',
      'node:https',
      'new WebSocket',
    ]) {
      expect(source).not.toContain(forbidden)
    }
    // and the advisory read is synchronous by construction, so a caller cannot
    // await a network call it does not know about
    const observer = new ProviderIdentityObserver()
    observer.recordVerdict(verdict(), ['kimi-k3'])
    const advisory = observer.advisoryFor('hcnsec', 'kimi-k3', NOW)
    expect(advisory).not.toBeInstanceOf(Promise)
  })

  test('a fresh verdict is reported without a staleness flag', () => {
    const observer = new ProviderIdentityObserver()
    observer.recordVerdict(verdict(), ['kimi-k3'])
    const advisory = observer.advisoryFor('hcnsec', 'kimi-k3', NOW, 30)
    expect(advisory?.stale).toBe(false)
    expect(advisory?.status).toBe('verified-for-tested-claims')
    expect(advisory?.datedAt).toBe('2026-10-07T09:00:00.000Z')
  })

  test('an old verdict becomes explicitly stale rather than silently current', () => {
    const observer = new ProviderIdentityObserver()
    observer.recordVerdict(verdict({ datedAt: '2026-01-01T00:00:00.000Z' }), [
      'kimi-k3',
    ])
    const advisory = observer.advisoryFor('hcnsec', 'kimi-k3', NOW, 30)
    expect(advisory?.stale).toBe(true)
    expect(advisory?.note).toContain('stale')
    expect(advisory?.note).toContain('re-audit')
  })

  test('an unparseable date is treated as stale, never as fresh', () => {
    const observer = new ProviderIdentityObserver()
    observer.recordVerdict(verdict({ datedAt: 'not-a-date' }), ['kimi-k3'])
    expect(observer.advisoryFor('hcnsec', 'kimi-k3', NOW)?.stale).toBe(true)
  })

  test('the newest verdict for a route wins', () => {
    const observer = new ProviderIdentityObserver()
    observer.recordVerdict(
      verdict({ status: 'inconclusive', datedAt: '2026-10-01T00:00:00.000Z' }),
      ['kimi-k3'],
    )
    observer.recordVerdict(verdict({ status: 'mismatch-requiring-review' }), [
      'kimi-k3',
    ])
    expect(observer.advisoryFor('hcnsec', 'kimi-k3', NOW)?.status).toBe(
      'mismatch-requiring-review',
    )
  })

  test('mismatch and inconclusive are separate outcomes in the note', () => {
    const mismatched = new ProviderIdentityObserver()
    mismatched.recordVerdict(verdict({ status: 'mismatch-requiring-review' }), [
      'kimi-k3',
    ])
    const mismatchNote =
      mismatched.advisoryFor('hcnsec', 'kimi-k3', NOW)?.note ?? ''
    expect(mismatchNote).toContain('MISMATCH')
    expect(mismatchNote).toContain('not proof')

    const inconclusive = new ProviderIdentityObserver()
    inconclusive.recordVerdict(
      verdict({ status: 'inconclusive', evidence: ['no controls available'] }),
      ['kimi-k3'],
    )
    const inconclusiveNote =
      inconclusive.advisoryFor('hcnsec', 'kimi-k3', NOW)?.note ?? ''
    expect(inconclusiveNote).toContain('INCONCLUSIVE')
    expect(inconclusiveNote).not.toContain('MISMATCH')
  })

  test('an advisory never instructs a routing change or a block', () => {
    const observer = new ProviderIdentityObserver()
    observer.recordVerdict(verdict({ status: 'mismatch-requiring-review' }), [
      'kimi-k3',
    ])
    const note = observer.advisoryFor('hcnsec', 'kimi-k3', NOW)?.note ?? ''
    expect(note).toContain('routing is unchanged')
    expect(note.toLowerCase()).not.toContain('block the')
    expect(note.toLowerCase()).not.toContain('switch to')
    expect(note.toLowerCase()).not.toContain('quarantine')
  })

  test('a verified verdict claims only what was tested', () => {
    const observer = new ProviderIdentityObserver()
    observer.recordVerdict(verdict(), ['kimi-k3'])
    const note = observer.advisoryFor('hcnsec', 'kimi-k3', NOW)?.note ?? ''
    expect(note).toContain('verified only these claims')
    expect(note).toContain('not a claim about model weights')
  })

  test('a never-audited route has no advisory at all', () => {
    const observer = new ProviderIdentityObserver()
    expect(observer.advisoryFor('hcnsec', 'kimi-k3', NOW)).toBeUndefined()
    expect(identityRouteKey('hcnsec', 'kimi-k3')).toBe('hcnsec::kimi-k3')
  })

  test('a verdict covers every requested model it names, and only those', () => {
    const observer = new ProviderIdentityObserver()
    observer.recordVerdict(verdict(), ['kimi-k3', 'kimi-k2'])
    expect(observer.advisoryFor('hcnsec', 'kimi-k2', NOW)).toBeDefined()
    expect(observer.advisoryFor('hcnsec', 'kimi-k4', NOW)).toBeUndefined()
  })
})
