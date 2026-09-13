import { describe, expect, test } from 'bun:test'

import {
  fetchHcnsecModels,
  fetchTokenBomModels,
  fetchTokenRouterModels,
} from '../static-catalogs'

describe('TokenRouter static catalog', () => {
  test('returns one entry per cli-side model id', () => {
    const models = fetchTokenRouterModels()

    expect(models.length).toBe(35)
    expect(
      models.find((m) => m.id === 'tokenrouter/z-ai/glm-5.3-free'),
    ).toBeDefined()
    expect(
      models.find((m) => m.id === 'tokenrouter/z-ai/glm-5.3-free')?.name,
    ).toBe('GLM 5.3 Free')
  })

  test('assigns every known display name through the cli-side map', () => {
    const models = fetchTokenRouterModels()
    const byId = new Map(models.map((m) => [m.id, m.name] as const))
    const known = {
      'tokenrouter/z-ai/glm-5.3-free': 'GLM 5.3 Free',
      'tokenrouter/anthropic/claude-fable-5': 'Claude Fable 5',
      'tokenrouter/openai/gpt-5.6-sol': 'GPT 5.6 Sol',
    } as const

    for (const [id, name] of Object.entries(known)) {
      expect(byId.get(id)).toBe(name)
    }
  })
})

describe('HCNSec static catalog (FID-2026-0913-001)', () => {
  test('returns exactly the seven audited allowlist models', () => {
    const models = fetchHcnsecModels()
    expect(models.map((m) => m.id).sort()).toEqual([
      'hcnsec/DeepSeek-V4-Flash',
      'hcnsec/Qwen3.6-35B-A3B',
      'hcnsec/Qwen3.8-Flash-Next',
      'hcnsec/deepseek-v4-flash-vision-exp',
      'hcnsec/glm-5.3-flash',
      'hcnsec/kimi-k3',
      'hcnsec/step-3.7-flash',
    ])
  })

  test('pins OpenRouter-sourced context windows and display names', () => {
    const byId = new Map(fetchHcnsecModels().map((m) => [m.id, m] as const))
    // Pinned 2026-09-13 from openrouter.ai/api/v1/models (source ids in the
    // FID table); NOT the family heuristic.
    expect(byId.get('hcnsec/kimi-k3')?.contextLength).toBe(1_048_576)
    expect(byId.get('hcnsec/glm-5.3-flash')?.contextLength).toBe(1_310_720)
    expect(byId.get('hcnsec/DeepSeek-V4-Flash')?.contextLength).toBe(1_310_720)
    expect(byId.get('hcnsec/deepseek-v4-flash-vision-exp')?.contextLength).toBe(
      1_048_576,
    )
    expect(byId.get('hcnsec/Qwen3.6-35B-A3B')?.contextLength).toBe(262_144)
    expect(byId.get('hcnsec/Qwen3.8-Flash-Next')?.contextLength).toBe(1_000_000)
    expect(byId.get('hcnsec/step-3.7-flash')?.contextLength).toBe(262_144)
    expect(byId.get('hcnsec/glm-5.3-flash')?.name).toBe('GLM 5.3 Flash')
    expect(byId.get('hcnsec/step-3.7-flash')?.name).toBe('Step 3.7 Flash')
    expect(byId.get('hcnsec/DeepSeek-V4-Flash')?.name).toBe('DeepSeek V4 Flash')
  })
})

describe('TokenBom static catalog (FID-2026-0913-001)', () => {
  test('returns exactly the seven audited allowlist models', () => {
    const models = fetchTokenBomModels()
    expect(models.map((m) => m.id).sort()).toEqual([
      'tokenbom/doubao-seed-2.1-pro',
      'tokenbom/gpt-5.3-codex',
      'tokenbom/gpt-5.5',
      'tokenbom/gpt-5.6-luna',
      'tokenbom/grok-4.6',
      'tokenbom/kimi-k3',
      'tokenbom/minimax-m3',
    ])
  })

  test('pins OpenRouter-sourced context windows and display names', () => {
    const byId = new Map(fetchTokenBomModels().map((m) => [m.id, m] as const))
    expect(byId.get('tokenbom/kimi-k3')?.contextLength).toBe(1_048_576)
    expect(byId.get('tokenbom/minimax-m3')?.contextLength).toBe(1_048_576)
    expect(byId.get('tokenbom/gpt-5.6-luna')?.contextLength).toBe(1_050_000)
    expect(byId.get('tokenbom/gpt-5.5')?.contextLength).toBe(1_050_000)
    expect(byId.get('tokenbom/gpt-5.3-codex')?.contextLength).toBe(400_000)
    expect(byId.get('tokenbom/grok-4.6')?.contextLength).toBe(500_000)
    // No OpenRouter listing for ByteDance Seed — conservative default,
    // flagged NEEDS-REVIEW in the FID.
    expect(byId.get('tokenbom/doubao-seed-2.1-pro')?.contextLength).toBe(
      200_000,
    )
    expect(byId.get('tokenbom/minimax-m3')?.name).toBe('MiniMax M3')
    expect(byId.get('tokenbom/gpt-5.6-luna')?.name).toBe('GPT-5.6 Luna')
    expect(byId.get('tokenbom/doubao-seed-2.1-pro')?.name).toBe(
      'Doubao Seed 2.1 Pro',
    )
  })
})
