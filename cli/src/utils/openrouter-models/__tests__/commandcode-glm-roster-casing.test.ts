/**
 * FID-2026-0928-010 — CommandCode GLM roster-casing pins.
 *
 * The live commandcode roster (keyless GET /provider/v1/models, HTTP 200,
 * 2026-09-28) serves `zai-org/GLM-5.2` / `zai-org/GLM-5.3` — uppercase. The
 * static catalog shipped lowercase (`zai-org/glm-5.2`), contradicting the
 * realign's stated intent (FID-2026-0916-004 CHANGELOG: "zai-org/GLM-5.2").
 * The wire path sends the catalog id verbatim after the `commandcode/`
 * prefix strip, so the lowercase rows were dead if vendor ids are
 * case-sensitive.
 *
 * Pins (FID-2026-0928-010 Proposed Solution steps 1, 2, 5):
 * 1. the two GLM catalog ids use the live roster spelling;
 * 2. the lowercase spellings are absent from catalog, protocol map, and
 *    fallback table;
 * 3. every commandcode id keeps protocol-map + fallback-table coverage
 *    (the closed-world invariants survive the re-key);
 * 4. the re-keyed rows resolve the gateway's own advertised windows
 *    (roster `context_length` = 1,000,000 for both, 2026-09-28).
 */
import fs from 'node:fs'
import path from 'node:path'

import { CONTEXT_WINDOW_FALLBACKS } from '@savant-code/common/constants/context-windows'
import {
  COMMANDCODE_PROTOCOLS,
  commandcodeModels,
} from '@savant-code/common/constants/model-config'
import { describe, expect, test } from 'bun:test'

import { fetchCommandCodeModels } from '../static-catalogs'

const ROSTER_GLM_52 = 'commandcode/zai-org/GLM-5.2'
const ROSTER_GLM_53 = 'commandcode/zai-org/GLM-5.3'

describe('FID-2026-0928-010: commandcode GLM roster casing', () => {
  test('the two GLM catalog ids use the live roster spelling', () => {
    const ids = Object.values(commandcodeModels)
    expect(ids).toContain(ROSTER_GLM_52)
    expect(ids).toContain(ROSTER_GLM_53)
  })

  test('lowercase spellings are absent from catalog, protocol map, and table', () => {
    expect(Object.values(commandcodeModels)).not.toContain(
      'commandcode/zai-org/glm-5.2',
    )
    expect(Object.values(commandcodeModels)).not.toContain(
      'commandcode/zai-org/glm-5.3',
    )
    expect('commandcode/zai-org/glm-5.2' in COMMANDCODE_PROTOCOLS).toBe(false)
    expect('commandcode/zai-org/glm-5.3' in COMMANDCODE_PROTOCOLS).toBe(false)
    expect(CONTEXT_WINDOW_FALLBACKS.has('commandcode/zai-org/glm-5.2')).toBe(
      false,
    )
    expect(CONTEXT_WINDOW_FALLBACKS.has('commandcode/zai-org/glm-5.3')).toBe(
      false,
    )
  })

  test('every commandcode id keeps protocol-map + fallback-table coverage', () => {
    const ids = Object.values(commandcodeModels)
    expect(ids.filter((id) => !(id in COMMANDCODE_PROTOCOLS))).toEqual([])
    expect(ids.filter((id) => !CONTEXT_WINDOW_FALLBACKS.has(id))).toEqual([])
  })

  test('re-keyed rows resolve the gateway-advertised windows (roster 2026-09-28)', () => {
    // The commandcode roster publishes context_length per id; both GLM rows
    // advertise 1,000,000 (upstream votes: glm-5.2 = 1,048,576 2-of-3,
    // glm-5.3 = 1,310,720 live upstream capability). The gateway proxies at
    // most the upstream window, so its own publication is binding and the
    // correction direction is strictly conservative.
    const g52 = CONTEXT_WINDOW_FALLBACKS.get(ROSTER_GLM_52)
    const g53 = CONTEXT_WINDOW_FALLBACKS.get(ROSTER_GLM_53)
    expect(g52).toBe(1_000_000)
    expect(g53).toBe(1_000_000)
    const cc = fetchCommandCodeModels()
    expect(cc.find((m) => m.id === ROSTER_GLM_52)?.contextLength).toBe(
      1_000_000,
    )
    expect(cc.find((m) => m.id === ROSTER_GLM_53)?.contextLength).toBe(
      1_000_000,
    )
  })

  test('commandcode registry entry documents the keyless-roster fail-open boundary', () => {
    // F2 documentation pin: the boundary fact must travel with the provider
    // metadata (measured 2026-09-18 gauntlet + re-measured 2026-09-28).
    // Resolved from this file's location (5 levels below the repo root),
    // NOT process.cwd() — `bun run test` executes per-workspace with the
    // workspace as cwd, and a cwd-relative path breaks the full battery.
    const repoRoot = path.resolve(import.meta.dir, '../../../../..')
    const source = fs.readFileSync(
      path.join(repoRoot, 'common/src/providers/registry.ts'),
      'utf8',
    )
    expect(source).toContain('fail-open')
    expect(source).toContain('keyless')
  })
})
