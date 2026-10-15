/**
 * FID-2026-1004-002 — orcarouter + nvidia chat-surface gap pins.
 *
 * Both gateways publish windows for most of their runtime rows; this suite
 * pins only the silent-gap subset added to the parent table (cross-gateway
 * sourcing), the rolling-alias / no-source defaults, the vercel non-chat
 * register, and the mechanical persistence of the NEEDS-REVIEW provenance
 * flags. Census regexes read the parent table file (kiosapi census style).
 */

import fs from 'node:fs'
import path from 'node:path'

import {
  CONTEXT_WINDOW_FALLBACKS,
  getContextWindowFallback,
} from '@savant-code/common/constants/context-windows'
import { describe, expect, test } from 'bun:test'

const repoRoot = (): string => path.resolve(import.meta.dir, '../../../../..')

const parentSource = (): string =>
  fs.readFileSync(
    path.join(repoRoot(), 'common/src/constants/context-window-table.ts'),
    'utf8',
  )

const sectionSources = (): string =>
  ['context-window-table-apinex.ts', 'context-window-table-bai.ts']
    .map((f) =>
      fs.readFileSync(path.join(repoRoot(), 'common/src/constants', f), 'utf8'),
    )
    .join('\n')

const censusKeys = (source: string, prefix: string): string[] =>
  [
    ...source.matchAll(
      new RegExp(`\\['(${prefix}/[^']+)',\\s*\\d[\\d_]*\\]`, 'g'),
    ),
  ].map((m) => m[1])

describe('FID-2026-1004-002: orcarouter gap subset', () => {
  test('every parent-table orcarouter row is wired into the Map (census)', () => {
    const keys = censusKeys(parentSource(), 'orcarouter')
    expect(keys.length).toBe(6)
    const missing = keys.filter((key) => !CONTEXT_WINDOW_FALLBACKS.has(key))
    expect(missing).toEqual([])
  })

  test('spot windows (cross-gateway consensus)', () => {
    expect(getContextWindowFallback('orcarouter/openai/gpt-5.5')).toEqual({
      contextWindow: 1_050_000,
      source: 'fallback-table',
    })
    expect(
      getContextWindowFallback('orcarouter/openai/gpt-5.5-pro').contextWindow,
    ).toBe(1_050_000)
    expect(
      getContextWindowFallback('orcarouter/z-ai/glm-5.3-flash-free')
        .contextWindow,
    ).toBe(1_048_575)
    expect(
      getContextWindowFallback('orcarouter/deepseek/deepseek-v4-flash-free')
        .contextWindow,
    ).toBe(1_048_576)
  })

  test('dated snapshots inherit their parent windows', () => {
    expect(
      getContextWindowFallback('orcarouter/openai/gpt-5.5-2026-04-23')
        .contextWindow,
    ).toBe(getContextWindowFallback('orcarouter/openai/gpt-5.5').contextWindow)
    expect(
      getContextWindowFallback('orcarouter/openai/gpt-5.5-pro-2026-04-23')
        .contextWindow,
    ).toBe(
      getContextWindowFallback('orcarouter/openai/gpt-5.5-pro').contextWindow,
    )
  })

  test('rolling aliases and no-source ids stay on the flagged default', () => {
    for (const id of [
      'orcarouter/google/gemini-flash-latest',
      'orcarouter/google/gemini-pro-latest',
      'orcarouter/openai/gpt-5.2-chat-latest',
      'orcarouter/openai/gpt-5.4-mini-2026-03-17',
      'orcarouter/orcarouter/free',
      'orcarouter/openai/tts-1',
      'orcarouter/openai/text-embedding-3-large',
    ]) {
      expect(getContextWindowFallback(id)).toEqual({
        contextWindow: 200_000,
        source: 'default',
      })
    }
  })
})

describe('FID-2026-1004-002: nvidia gap subset', () => {
  test('every parent-table nvidia row is wired into the Map (census)', () => {
    const keys = censusKeys(parentSource(), 'nvidia')
    expect(keys.length).toBe(9)
    const missing = keys.filter((key) => !CONTEXT_WINDOW_FALLBACKS.has(key))
    expect(missing).toEqual([])
  })

  test('spot windows (cross-gateway consensus / conservative minimum)', () => {
    expect(getContextWindowFallback('nvidia/moonshotai/kimi-k3')).toEqual({
      contextWindow: 1_048_576,
      source: 'fallback-table',
    })
    expect(getContextWindowFallback('nvidia/z-ai/glm-5.3').contextWindow).toBe(
      1_000_000,
    )
    expect(
      getContextWindowFallback('nvidia/z-ai/glm-5.3-flash').contextWindow,
    ).toBe(1_048_575)
    expect(
      getContextWindowFallback('nvidia/deepseek-ai/deepseek-v4.1-flash')
        .contextWindow,
    ).toBe(1_048_576)
    expect(
      getContextWindowFallback('nvidia/nvidia/nemotron-3-super-120b-a12b')
        .contextWindow,
    ).toBe(262_144)
    expect(
      getContextWindowFallback('nvidia/nvidia/nemotron-3.5-lightning-30b-a3b')
        .contextWindow,
    ).toBe(262_144)
    expect(
      getContextWindowFallback('nvidia/poolside/laguna-xs-2.1').contextWindow,
    ).toBe(262_144)
  })

  test('non-chat nvidia ids stay on the flagged default', () => {
    for (const id of [
      'nvidia/nvidia/nv-embedqa-1b-v1',
      'nvidia/nvidia/nemotron-4-340b-reward',
      'nvidia/nvidia/riva-translate-4b-instruct',
      'nvidia/meta/llama2-70b',
    ]) {
      expect(getContextWindowFallback(id)).toEqual({
        contextWindow: 200_000,
        source: 'default',
      })
    }
  })
})

describe('FID-2026-1004-002: vercel non-chat register + provenance flags', () => {
  test('vercel silent voice/tts ids stay on the flagged default', () => {
    for (const id of [
      'vercel/openai/tts-1',
      'vercel/openai/whisper-1',
      'vercel/microsoft/mai-voice-2',
      'vercel/fish-audio/s1',
    ]) {
      expect(getContextWindowFallback(id)).toEqual({
        contextWindow: 200_000,
        source: 'default',
      })
    }
  })

  test('NEEDS-REVIEW provenance flags persist across the derived sections', () => {
    // Mechanical provenance check: rows whose provenance is still weak must
    // stay flagged. Floor re-derived in FID-2026-1004-004: 27 flags
    // legitimately became OR-live consensus (2026-10-04 probe); the survivors
    // are the parent flagged-defaults (hcnsec Qwen3.8-Flash-Next, tokenbom
    // doubao, th-orchestra), bai/gemini-3-flash (no OpenRouter listing), and
    // the rule statements in the section headers. Deleting any survivor
    // still fails here.
    const flags = (parentSource() + sectionSources()).match(/NEEDS-REVIEW/g)
    expect(flags?.length ?? 0).toBeGreaterThanOrEqual(4)
    expect(sectionSources()).toMatch(/NEEDS-REVIEW[^\n]*gemini-3-flash/)
  })
})
