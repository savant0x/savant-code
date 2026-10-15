import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { captureModelRoute } from '@savant-code/common/providers/model-route'
import { describe, expect, test } from 'bun:test'

import { readProviderAlternatives } from '../../../utils/provider-alternatives'
import { monitorProviderHealth } from '../../../utils/provider-health-monitor'
import { rateLimitHint, quotaHint } from '../send-message/fallback-hints'

import type { ProviderAlternative } from '@savant-code/common/providers/provider-alternatives'

const now = Date.now()
const row: ProviderAlternative = {
  providerId: 'openrouter',
  host: 'openrouter.ai',
  modelId: 'qwen/coder',
  observedAt: now,
  supported: true,
  credentialReady: true,
  boundary: 'boundary-ok',
}
describe('429 alternatives', () => {
  test('ranks exact advertised IDs before family matches, caps two, never changes the route', () => {
    const before = process.env.DIRECT_PROVIDER
    const hint = rateLimitHint({
      error: { status: 429 },
      modelId: 'qwen/coder',
      now,
      readAlternatives: () => [
        {
          ...row,
          providerId: 'similar',
          host: 'similar.test',
          modelId: 'qwen/other',
        },
        row,
        {
          ...row,
          providerId: 'third',
          host: 'third.test',
          modelId: 'qwen/third',
        },
      ],
    })
    expect(hint.indexOf('openrouter')).toBeLessThan(hint.indexOf('similar'))
    expect(hint).toContain('exact model ID')
    expect(hint).toContain('similar model family')
    expect(hint).not.toContain('third')
    expect(hint).toContain('unverified')
    expect(process.env.DIRECT_PROVIDER).toBe(before)
  })
  test('unsafe, stale, future, removed, denied, unsupported and unconfigured rows are excluded', () => {
    for (const change of [
      { observedAt: now - 25 * 3600_000 },
      { observedAt: now + 1 },
      { removed: true },
      { rejected: true },
      { supported: false },
      { credentialReady: false },
      { boundary: 'open-relay-reject' },
    ]) {
      const hint = rateLimitHint({
        error: { status: 429 },
        modelId: row.modelId,
        now,
        readAlternatives: () => [{ ...row, ...change }],
      })
      expect(hint).toContain('No confirmed eligible alternative')
    }
  })
  test('deduplicates the failure episode, permits a new failure, and ignores non-429 errors', () => {
    const error = { statusCode: 429 }
    const params = {
      error,
      modelId: row.modelId,
      now,
      readAlternatives: () => [row],
    }
    expect(rateLimitHint(params)).toContain('openrouter')
    expect(rateLimitHint(params)).toBe('')
    expect(rateLimitHint({ ...params, error: { statusCode: 429 } })).toContain(
      'openrouter',
    )
    expect(rateLimitHint({ ...params, error: { statusCode: 500 } })).toBe('')
  })
  test('ordinary projects read the same profile catalog and dated boundary evidence', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hint-profile-'))
    const prior = process.env.SAVANT_CODE_CONFIG_DIR
    const key = process.env.OPENROUTER_API_KEY
    process.env.SAVANT_CODE_CONFIG_DIR = dir
    process.env.OPENROUTER_API_KEY = 'placeholder'
    try {
      writeFileSync(
        join(dir, 'free-options.json'),
        JSON.stringify({
          fetchedAt: new Date(now).toISOString(),
          totalModels: 1,
          models: [
            {
              id: row.modelId,
              providerId: row.providerId,
              context_length: null,
            },
          ],
          newModelIds: [],
          archivedModels: [],
        }),
      )
      // Dated boundary evidence must come from the production writer: it
      // stamps the resolved-config fact the reader binds the verdict to
      // (FID-2026-1003-006 — a rotated endpoint invalidates old evidence).
      await monitorProviderHealth(
        captureModelRoute('openrouter'),
        true,
        new AbortController().signal,
        () => now,
        async () => ({
          reachable: true,
          modelsCount: 1,
          modelsShapeOk: true,
          latencyMs: 5,
          boundary: 'boundary-ok',
          boundaryHttpStatus: 401,
          error: null,
        }),
      )
      expect(readProviderAlternatives(now)[0]).toMatchObject({
        providerId: 'openrouter',
        credentialReady: true,
        boundary: 'boundary-ok',
      })
    } finally {
      if (prior === undefined) delete process.env.SAVANT_CODE_CONFIG_DIR
      else process.env.SAVANT_CODE_CONFIG_DIR = prior
      if (key === undefined) delete process.env.OPENROUTER_API_KEY
      else process.env.OPENROUTER_API_KEY = key
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
describe('quota refusal explanation', () => {
  test('declared quota notes cover 402, typed quota codes and the reported balance error', () => {
    for (const error of [
      { status: 402 },
      { code: 'insufficient_user_quota' },
      { message: 'credit insufficient balance: balance=0' },
    ]) {
      expect(
        quotaHint({ error, providerId: 'bai', modelId: 'openai/gpt-5' }),
      ).toContain('B.AI')
    }
    expect(quotaHint({ error: { status: 402 }, modelId: 'bai/hy3' })).toContain(
      '/health',
    )
    expect(
      quotaHint({ error: { status: 402 }, providerId: 'openrouter' }),
    ).toBe('')
    expect(quotaHint({ error: { status: 500 }, providerId: 'bai' })).toBe('')
    expect(quotaHint({ error: { status: 402 } })).toBe('')
  })
})
