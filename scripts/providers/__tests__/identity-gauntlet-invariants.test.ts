// FID-2026-1007-008 — the gauntlet's structural invariants, split from the
// behavioural pins so neither file approaches the per-file line ceiling.
//
// These are the promises that cannot be expressed as a verdict rule and are
// therefore easy to lose silently: the engine must not be able to reach the
// network or mutate routing, its local verdict union must not drift from the
// runtime seam it mirrors, and its text comparison must ignore formatting
// without ignoring content.
import fs from 'node:fs'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { createInvoker } from '../identity-gauntlet'
import { normalizeText, stableTextHash } from '../lib/identity-core'
import { runIdentityGauntlet } from '../lib/identity-runner'

import type { IdentityTarget, ProbeSpec } from '../lib/identity-core'

const read = (...segments: string[]) =>
  fs.readFileSync(path.join(import.meta.dir, ...segments), 'utf8')

describe('identity gauntlet invariants (FID-2026-1007-008)', () => {
  test('the engine cannot mutate routing and cannot reach the network', () => {
    for (const name of ['identity-core.ts', 'identity-runner.ts']) {
      const source = read('..', 'lib', name)
      for (const forbidden of [
        'fetch(',
        'Bun.spawn',
        'node:http',
        'node:https',
        'node:child_process',
        'writeFileSync',
        'writeFile(',
        'process.env',
      ]) {
        expect(source).not.toContain(forbidden)
      }
    }
  })

  test('the 0.85 auto-failover threshold is not applied anywhere', () => {
    // Comments are stripped first: the modules DOCUMENT that they reject the
    // addendum's 0.85 threshold, and a scan that cannot tell prose from code
    // would fail on the very sentence stating the rule.
    const codeOnly = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const name of ['identity-core.ts', 'identity-runner.ts']) {
      expect(codeOnly(read('..', 'lib', name))).not.toMatch(
        /0\.85|quarantine|autoFailover|failoverAt/,
      )
    }
  })

  test('the verdict union matches the runtime seam it mirrors', () => {
    const runtimeSource = read(
      '..',
      '..',
      '..',
      'packages',
      'agent-runtime',
      'src',
      'provider-boundary',
      'identity-observation.ts',
    )
    for (const status of [
      'verified-for-tested-claims',
      'mismatch-requiring-review',
      'inconclusive',
    ]) {
      expect(runtimeSource).toContain(`'${status}'`)
    }
  })

  test('normalization and hashing ignore formatting but not content', () => {
    expect(normalizeText('Hello,   WORLD!!')).toBe('hello world')
    expect(stableTextHash('Hello, WORLD!')).toBe(stableTextHash('hello world'))
    expect(stableTextHash('hello world')).not.toBe(
      stableTextHash('hello worlds'),
    )
  })
})

// The invoker is the only code in the program that touches the network, so its
// failure handling decides whether a dead endpoint is recorded as evidence or
// as silence. Found live on 2026-10-07: HCNSec answered a 500 error envelope and
// TokenBom a 402, and the run recorded five empty "completed" samples whose
// empty text then read as both controls `matched`. Stub the global fetch.
describe('identity gauntlet transport (FID-2026-1007-008)', () => {
  const realFetch = globalThis.fetch
  const target: IdentityTarget = {
    provider: 'hcnsec',
    requestedModel: 'kimi-k3',
    baseUrl: 'https://api.hcnsec.cn/v1',
  }
  const probe: ProbeSpec = {
    id: 'probe-A',
    vector: 'A',
    claim: 'the served model id matches the requested model id',
    prompt: 'gauntlet probe',
  }
  const stub = (body: string, status: number): void => {
    globalThis.fetch = (async () =>
      new Response(body, { status })) as unknown as typeof fetch
  }
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  test('a non-2xx body is a failure class, not an empty completed sample', async () => {
    stub('{"error":{"message":"no channel"}}', 500)
    const result = await createInvoker(new Map([['hcnsec', 'k']]))(
      target,
      probe,
    )
    expect(result.failure?.class).toBe('http-500')
    expect(result.text).toBe('')
  })

  test('a 200 that carries no choices is a failure, not an empty sample', async () => {
    stub('{"model":"mystery"}', 200)
    const result = await createInvoker(new Map([['hcnsec', 'k']]))(
      target,
      probe,
    )
    expect(result.failure?.class).toBe('no-content')
  })

  test('a dead endpoint cannot read as a matched control', async () => {
    stub('{"error":"down"}', 503)
    const report = await runIdentityGauntlet({
      manifest: {
        version: 'manifest/1',
        target,
        budget: { maxAttempts: 20, maxTotalTokens: 10_000, maxWallMs: 5_000 },
        probes: [probe],
        controls: { sameModel: { ...target, provider: 'tokenbom' } },
      },
      invoke: createInvoker(
        new Map([
          ['hcnsec', 'k'],
          ['tokenbom', 'k'],
        ]),
      ),
    })
    expect(report.controls.sameModel).toBe('unavailable')
    expect(report.verdict).toBe('inconclusive')
  })
})
