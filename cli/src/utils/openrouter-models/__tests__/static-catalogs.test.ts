import { describe, expect, test } from 'bun:test'

import {
  fetchHcnsecModels,
  fetchTokenBomModels,
  fetchTokenRouterModels,
} from '../static-catalogs'
import {
  fetchInfronModels,
  fetchUnorouterModels,
} from '../static-catalogs-gateways'

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

describe('Infron static catalog (FID-2026-0914-001)', () => {
  test('returns exactly the nine curated models', () => {
    const models = fetchInfronModels()
    expect(models.map((m) => m.id).sort()).toEqual([
      'infron/deepseek/deepseek-v4-flash-0731:free',
      'infron/deepseek/deepseek-v4-flash:free',
      'infron/google/gemini-3.1-pro-preview',
      'infron/kwaipilot/kat-coder-pro-v2',
      'infron/moonshotai/kimi-k2.7-code',
      'infron/nvidia/nemotron-3.5-lightning-30b-a3b:free',
      'infron/qwen/qwen3-coder-next',
      'infron/qwen/qwen3.8-27b:free',
      'infron/z-ai/glm-5.3-flash',
    ])
  })

  test('pins vendor-published context windows and display names', () => {
    const byId = new Map(fetchInfronModels().map((m) => [m.id, m] as const))
    // Windows are the vendors' OWN catalog values (api.infron.ai
    // context_length), NOT the family heuristic.
    expect(
      byId.get('infron/deepseek/deepseek-v4-flash:free')?.contextLength,
    ).toBe(1_048_580)
    expect(
      byId.get('infron/deepseek/deepseek-v4-flash-0731:free')?.contextLength,
    ).toBe(1_000_000)
    expect(byId.get('infron/qwen/qwen3.8-27b:free')?.contextLength).toBe(
      256_000,
    )
    expect(
      byId.get('infron/nvidia/nemotron-3.5-lightning-30b-a3b:free')
        ?.contextLength,
    ).toBe(1_048_576)
    expect(byId.get('infron/kwaipilot/kat-coder-pro-v2')?.contextLength).toBe(
      262_140,
    )
    expect(byId.get('infron/moonshotai/kimi-k2.7-code')?.contextLength).toBe(
      262_144,
    )
    expect(byId.get('infron/qwen/qwen3-coder-next')?.contextLength).toBe(
      262_144,
    )
    expect(
      byId.get('infron/google/gemini-3.1-pro-preview')?.contextLength,
    ).toBe(1_048_576)
    expect(byId.get('infron/z-ai/glm-5.3-flash')?.contextLength).toBe(1_000_000)
    expect(byId.get('infron/z-ai/glm-5.3-flash')?.name).toBe('GLM 5.3 Flash')
    expect(byId.get('infron/kwaipilot/kat-coder-pro-v2')?.name).toBe(
      'KAT Coder Pro V2',
    )
  })
})

describe('UnoRouter static catalog (FID-2026-0914-001)', () => {
  test('returns exactly the seventeen curated models', () => {
    const models = fetchUnorouterModels()
    expect(models.map((m) => m.id).sort()).toEqual([
      'unorouter/claude-fable-5.1',
      'unorouter/claude-opus-4.8',
      'unorouter/codestral-latest:free',
      'unorouter/deepseek-v4-flash:free',
      'unorouter/deepseek-v4-pro',
      'unorouter/dots-3-note-preview:free',
      'unorouter/gemini-3.6-flash:free',
      'unorouter/glm-5.3-flash:free',
      'unorouter/gpt-5.5',
      'unorouter/gpt-6-astra',
      'unorouter/gpt-oss-120b:free',
      'unorouter/intern-s2-preview:free',
      'unorouter/north-mini-code:free',
      'unorouter/qwen3.6-35b-a3b:free',
      'unorouter/qwen3.8-27b:free',
      'unorouter/seed-oss-36b:free',
      'unorouter/step-3.7-flash:free',
    ])
  })

  test('pins vendor-published context windows and display names', () => {
    const byId = new Map(fetchUnorouterModels().map((m) => [m.id, m] as const))
    // Windows are the vendor console's own metadata.contextWindow values.
    expect(byId.get('unorouter/glm-5.3-flash:free')?.contextLength).toBe(
      1_000_000,
    )
    expect(byId.get('unorouter/gemini-3.6-flash:free')?.contextLength).toBe(
      1_000_000,
    )
    expect(byId.get('unorouter/seed-oss-36b:free')?.contextLength).toBe(524_288)
    expect(byId.get('unorouter/dots-3-note-preview:free')?.contextLength).toBe(
      512_000,
    )
    expect(byId.get('unorouter/gpt-oss-120b:free')?.contextLength).toBe(131_072)
    expect(byId.get('unorouter/qwen3.6-35b-a3b:free')?.contextLength).toBe(
      262_100,
    )
    // metadata.contextWindow (65,536) wins over the 262.1K tag — flagged in
    // the FID window table.
    expect(byId.get('unorouter/qwen3.8-27b:free')?.contextLength).toBe(65_536)
    expect(byId.get('unorouter/gpt-5.5')?.contextLength).toBe(1_100_000)
    expect(byId.get('unorouter/gpt-6-astra')?.contextLength).toBe(1_100_000)
    expect(byId.get('unorouter/claude-fable-5.1')?.contextLength).toBe(
      1_000_000,
    )
    expect(byId.get('unorouter/claude-opus-4.8')?.contextLength).toBe(1_000_000)
    expect(byId.get('unorouter/deepseek-v4-pro')?.contextLength).toBe(1_000_000)
    expect(byId.get('unorouter/claude-fable-5.1')?.name).toBe(
      'Claude Fable 5.1',
    )
    expect(byId.get('unorouter/gpt-6-astra')?.name).toBe('GPT 6 Astra')
  })
})
