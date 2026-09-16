/**
 * FID-2026-0916-004 — gateway catalog re-alignment pins.
 *
 * Locks the operator rulings (Task 62, 2026-09-16):
 * 1. commandcode ids match the vendor's renormalized roster spellings
 *    (dashed versions, no vendor prefixes, canonical kimi casing).
 * 2. Dead ids removed from tokenharbor (gemini-3.6-flash, minimax-m3,
 *    kimi-k3:free — launch event ended per the vendor's own 429).
 * 3. opencode-zen + opencode-go are removed from Savant (the vendor's
 *    free-tier gate makes them unusable outside OpenCode; MQ3 ruling).
 */
import {
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import {
  COMMANDCODE_PROTOCOLS,
  PROVIDER_PROTOCOL_MAPS,
  commandcodeModels,
  tokenharborModels,
} from '@savant-code/common/constants/model-config'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'
import { describe, expect, test } from 'bun:test'

import {
  fetchCommandCodeModels,
  getTokenHarborModels,
} from '../static-catalogs'

describe('FID-2026-0916-004: commandcode renamed spellings', () => {
  test('dashed claude spelling is cataloged; dotted legacy is gone', () => {
    const ids = Object.values(commandcodeModels)
    expect(ids).toContain('commandcode/claude-sonnet-4-6')
    expect(ids).not.toContain('commandcode/claude-sonnet-4.6')
  })

  test('vendor prefixes dropped for openai ids', () => {
    const ids = Object.values(commandcodeModels)
    expect(ids).toContain('commandcode/gpt-5.6-sol')
    expect(ids).not.toContain('commandcode/openai/gpt-5.6-sol')
  })

  test('glm/kimi/mimo ids use the roster org spellings', () => {
    const ids = Object.values(commandcodeModels)
    expect(ids).toContain('commandcode/zai-org/glm-5.2')
    expect(ids).toContain('commandcode/moonshotai/Kimi-K3')
    expect(ids).not.toContain('commandcode/z-ai/glm-5.2')
    expect(ids).not.toContain('commandcode/moonshotai/kimi-k3')
  })

  test('every surviving commandcode id has a fallback-table row', () => {
    const missing = Object.values(commandcodeModels).filter(
      (id) => !CONTEXT_WINDOW_FALLBACKS.has(id),
    )
    expect(missing).toEqual([])
  })

  test('protocol map covers every surviving id', () => {
    const unmapped = Object.values(commandcodeModels).filter(
      (id) => !(id in COMMANDCODE_PROTOCOLS),
    )
    expect(unmapped).toEqual([])
  })

  test('cli fetcher serves the renamed ids with vendor windows', () => {
    const sonnet = fetchCommandCodeModels().find(
      (m) => m.id === 'commandcode/claude-sonnet-4-6',
    )
    expect(sonnet?.contextLength).toBe(1_000_000)
    const sol = fetchCommandCodeModels().find(
      (m) => m.id === 'commandcode/gpt-5.6-sol',
    )
    expect(sol?.contextLength).toBe(1_050_000)
  })
})

describe('FID-2026-0916-004: tokenharbor dead free channel + stale ids', () => {
  test('kimi-k3:free removed (launch event ended — vendor 429)', () => {
    expect(Object.values(tokenharborModels)).not.toContain(
      'tokenharbor/kimi-k3:free',
    )
    expect(getContextWindowFallback('tokenharbor/kimi-k3:free').source).toBe(
      'default',
    )
  })

  test('roster-absent gemini-3.6-flash + minimax-m3 removed', () => {
    const ids = Object.values(tokenharborModels)
    expect(ids).not.toContain('tokenharbor/gemini-3.6-flash')
    expect(ids).not.toContain('tokenharbor/minimax-m3')
  })

  test('surviving harbor ids keep table coverage', () => {
    const missing = Object.values(tokenharborModels).filter(
      (id) => !CONTEXT_WINDOW_FALLBACKS.has(id),
    )
    expect(missing).toEqual([])
  })

  test('cli fetcher no longer lists the removed ids', () => {
    const harborIds = getTokenHarborModels().map((m) => m.id)
    expect(harborIds).not.toContain('tokenharbor/kimi-k3:free')
    expect(harborIds).not.toContain('tokenharbor/gemini-3.6-flash')
    expect(harborIds).not.toContain('tokenharbor/minimax-m3')
  })
})

describe('FID-2026-0916-004: opencode zen/go removed from Savant (MQ3)', () => {
  test('registry has no opencode entries', () => {
    expect('opencode-go' in PROVIDER_REGISTRY).toBe(false)
    expect('opencode-zen' in PROVIDER_REGISTRY).toBe(false)
  })

  test('zen protocol map is gone from the shared map registry', () => {
    expect(
      Object.keys(PROVIDER_PROTOCOL_MAPS).filter((k) =>
        k.startsWith('OPENCODE'),
      ),
    ).toEqual([])
  })
})
