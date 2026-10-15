// FID-2026-1007-008 — the sweep pins. The unit of truth is the per-model row:
// a route that is down must never be reported as the provider being down (the
// same host answered `glm-5.3-flash` with 200 while `kimi-k3` returned 500 on
// 2026-10-07), and a served label that does not name the requested model must
// be flagged rather than accepted.
import { describe, expect, test } from 'bun:test'

import { buildManifest } from '../lib/identity-manifest'
import { runIdentityMatrix } from '../lib/identity-matrix'

import type { ProbeInvoker } from '../lib/identity-core'

const routes = [
  { model: 'glm-5.3-flash' },
  { model: 'kimi-k3' },
  { model: 'Qwen3.6-35B-A3B' },
]

interface Stub {
  served?: string
  status?: number
  text?: string
}

const invoke = (byModel: Record<string, Stub | undefined>): ProbeInvoker => {
  return async (target, spec) => {
    const stub =
      byModel[`${target.provider}/${target.requestedModel}`] ??
      byModel[target.requestedModel] ??
      {}
    if (stub.status !== undefined && stub.status !== 200) {
      return {
        probeId: spec.id,
        text: '',
        latencyMs: 5,
        failure: { class: `http-${stub.status}`, message: 'stub' },
      }
    }
    return {
      probeId: spec.id,
      text: stub.text ?? 'ALPHA BRAVO CHARLIE',
      servedModel: stub.served,
      latencyMs: 7,
      usage: { inputTokens: 5, outputTokens: 3 },
    }
  }
}

const run = (byModel: Record<string, Stub | undefined>) =>
  runIdentityMatrix({
    version: 'identity-manifest/1',
    provider: 'hcnsec',
    targets: routes,
    buildManifest: (model) =>
      buildManifest({
        provider: 'hcnsec',
        model,
        baseUrl: 'https://api.hcnsec.cn/v1',
        vectors: ['A'],
      }),
    invoke: invoke(byModel),
  })

describe('identity gauntlet sweep (FID-2026-1007-008)', () => {
  test('an answered route is ok and a matching served label is a match', async () => {
    const matrix = await run({
      'glm-5.3-flash': { served: 'glm-5.3-flash' },
      'kimi-k3': { served: 'hcnsec/kimi-k3' },
      'Qwen3.6-35B-A3B': { served: 'qwen3.6-35b-a3b' },
    })
    expect(matrix.rows.map((row) => row.status)).toEqual(['ok', 'ok', 'ok'])
    expect(matrix.rows.map((row) => row.label)).toEqual([
      'match',
      'match',
      'match',
    ])
  })

  test('a served label that does not name the requested model is flagged', async () => {
    const matrix = await run({
      'glm-5.3-flash': { served: 'longcat-2.5-preview-free' },
    })
    const row = matrix.rows[0]!
    expect(row.label).toBe('mismatch')
    expect(row.servedModels).toEqual(['longcat-2.5-preview-free'])
    expect(matrix.summary.labelMismatch).toBe(1)
  })

  test('a route failure is a route failure, not a provider failure', async () => {
    const matrix = await run({
      'glm-5.3-flash': { served: 'glm-5.3-flash' },
      'kimi-k3': { status: 500 },
      'Qwen3.6-35B-A3B': { status: 500 },
    })
    const byModel = Object.fromEntries(
      matrix.rows.map((row) => [row.model, row]),
    )
    expect(byModel['glm-5.3-flash']?.status).toBe('ok')
    expect(byModel['kimi-k3']?.status).toBe('failed')
    expect(byModel['kimi-k3']?.failureClass).toBe('http-500')
    expect(byModel['kimi-k3']?.label).toBe('unknown')
    expect(matrix.summary).toMatchObject({ ok: 1, failed: 2 })
  })

  test('a quota refusal is unavailable (funding), not failed (broken)', async () => {
    const matrix = await run({
      'glm-5.3-flash': { status: 402 },
      'kimi-k3': { status: 403 },
      'Qwen3.6-35B-A3B': { served: 'qwen3.6-35b-a3b' },
    })
    const byModel = Object.fromEntries(
      matrix.rows.map((row) => [row.model, row]),
    )
    expect(byModel['glm-5.3-flash']?.status).toBe('unavailable')
    expect(byModel['kimi-k3']?.status).toBe('failed')
    expect(matrix.summary).toMatchObject({ unavailable: 1, failed: 1, ok: 1 })
  })

  test('the summary counts every route in the sweep', async () => {
    const matrix = await run({})
    expect(matrix.summary.models).toBe(routes.length)
    expect(matrix.rows).toHaveLength(routes.length)
  })

  test('a route with no controls stays inconclusive', async () => {
    const matrix = await run({ 'glm-5.3-flash': { served: 'glm-5.3-flash' } })
    expect(matrix.rows[0]!.verdict).toBe('inconclusive')
  })

  test('a controlled route serving a different family reports mismatch-requiring-review', async () => {
    const matrix = await runIdentityMatrix({
      version: 'identity-manifest/1',
      provider: 'hcnsec',
      targets: [{ model: 'glm-5.3-flash' }],
      buildManifest: (model) =>
        buildManifest({
          provider: 'hcnsec',
          model,
          baseUrl: 'https://api.hcnsec.cn/v1',
          vectors: ['A', 'B'],
          controls: {
            sameModel: {
              provider: 'tokenbom',
              requestedModel: 'glm-5.3-flash',
              baseUrl: 'https://tokenbom.example/v1',
            },
            differentModel: {
              provider: 'openai',
              requestedModel: 'gpt-5',
              baseUrl: 'https://openai.example/v1',
            },
          },
        }),
      invoke: invoke({
        'glm-5.3-flash': {
          served: 'longcat-2.5-preview-free',
          text: 'TARGET-TEXT',
        },
        'tokenbom/glm-5.3-flash': {
          served: 'glm-5.3-flash',
          text: 'CONTROL-TEXT',
        },
        'openai/gpt-5': { served: 'gpt-5', text: 'OTHER-TEXT' },
      }),
    })
    const row = matrix.rows[0]!
    expect(row.label).toBe('mismatch')
    expect(row.verdict).toBe('mismatch-requiring-review')
  })
})
