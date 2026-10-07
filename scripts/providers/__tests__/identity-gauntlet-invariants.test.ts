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

import { describe, expect, test } from 'bun:test'

import { normalizeText, stableTextHash } from '../lib/identity-core'

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
