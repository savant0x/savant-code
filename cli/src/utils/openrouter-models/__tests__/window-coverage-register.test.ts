/**
 * FID-2026-1004-002 — registry-wide window-coverage lint.
 *
 * Closes the root cause that let apinex/bai ship with silent-200k rosters:
 * "added later and nothing required them to have rows." Every
 * PROVIDER_REGISTRY provider must declare a coverage disposition in
 * WINDOW_COVERAGE_REGISTER; the declared dispositions are checked against
 * the fallback table's ground truth (deterministic — no runtime-catalog or
 * network dependency in CI).
 */

import fs from 'node:fs'
import path from 'node:path'

import { CONTEXT_WINDOW_FALLBACKS } from '@savant-code/common/constants/context-windows'
import {
  NO_PUBLISH_GATEWAY_IDS,
  WINDOW_COVERAGE_REGISTER,
} from '@savant-code/common/constants/window-coverage-register'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

const repoRoot = (): string => path.resolve(import.meta.dir, '../../../../..')

const tablePrefixes = (): Set<string> => {
  const prefixes = new Set<string>()
  for (const key of CONTEXT_WINDOW_FALLBACKS.keys()) {
    prefixes.add(key.split('/')[0] ?? '')
  }
  return prefixes
}

describe('FID-2026-1004-002: window-coverage register lint', () => {
  test('every registry provider has a coverage disposition (fail closed)', () => {
    const missing = Object.keys(PROVIDER_REGISTRY).filter(
      (id) => !WINDOW_COVERAGE_REGISTER.has(id),
    )
    expect(missing).toEqual([])
  })

  test('the register has no stale entries outside the registry', () => {
    const stale = [...WINDOW_COVERAGE_REGISTER.keys()].filter(
      (id) => !(id in PROVIDER_REGISTRY),
    )
    expect(stale).toEqual([])
  })

  test('table-section providers each have fallback-table rows', () => {
    const prefixes = tablePrefixes()
    const empty = [...WINDOW_COVERAGE_REGISTER.entries()]
      .filter(([, entry]) => entry.disposition === 'table-section')
      .filter(([id]) => !prefixes.has(id))
      .map(([id]) => id)
    expect(empty).toEqual([])
  })

  test('no-runtime-rows providers have no fallback-table rows', () => {
    const prefixes = tablePrefixes()
    const violations = [...WINDOW_COVERAGE_REGISTER.entries()]
      .filter(([, entry]) => entry.disposition === 'no-runtime-rows')
      .filter(([id]) => prefixes.has(id))
      .map(([id]) => id)
    expect(violations).toEqual([])
  })

  test('no-publish gateways are seam-split, spread, and census-gated', () => {
    for (const id of NO_PUBLISH_GATEWAY_IDS) {
      const entry = WINDOW_COVERAGE_REGISTER.get(id)
      expect(entry?.disposition).toBe('table-section')
      const section = path.join(
        repoRoot(),
        `common/src/constants/context-window-table-${id}.ts`,
      )
      expect(fs.existsSync(section)).toBe(true)
      const suite = path.join(
        repoRoot(),
        `cli/src/utils/openrouter-models/__tests__/window-truth-${id}.test.ts`,
      )
      expect(fs.existsSync(suite)).toBe(true)
    }
    const parent = fs.readFileSync(
      path.join(repoRoot(), 'common/src/constants/context-window-table.ts'),
      'utf8',
    )
    expect(parent).toContain('...KIOSAPI_CONTEXT_WINDOW_FALLBACKS')
    expect(parent).toContain('...APINEX_CONTEXT_WINDOW_FALLBACKS')
    expect(parent).toContain('...BAI_CONTEXT_WINDOW_FALLBACKS')
  })
})
