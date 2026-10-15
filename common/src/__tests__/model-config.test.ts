import { describe, expect, test } from 'bun:test'

import {
  COMMANDCODE_PROTOCOLS,
  commandcodeModels,
  openrouterModels,
  supportsAssistantPrefill,
  tokenharborModels,
} from '../constants/model-config'

describe('CommandCode catalog', () => {
  test('defines a protocol for every catalog model', () => {
    const modelIds = Object.values(commandcodeModels)

    expect(modelIds.length).toBeGreaterThan(0)
    expect(new Set(modelIds).size).toBe(modelIds.length)
    expect(Object.keys(COMMANDCODE_PROTOCOLS).sort()).toEqual(
      [...modelIds].sort(),
    )
  })
})

describe('TokenHarbor catalog', () => {
  // FID-2026-1010-001: the exact-list pin mirrors the vendor's own
  // authenticated /v1/models roster order (probed 2026-10-10, 68 rows), so
  // refreshing the catalog is a literal re-copy and this pin is the drift
  // alarm. Supersedes the 17-id pin the FID-2026-0916-004 realignment left.
  test('defines the complete published 68-model catalog', () => {
    const modelIds = Object.values(tokenharborModels)

    const expectedModelIds: typeof modelIds = [
      'tokenharbor/claude-sonnet-4.6',
      'tokenharbor/claude-opus-5.5',
      'tokenharbor/claude-opus-5',
      'tokenharbor/claude-sonnet-5',
      'tokenharbor/grok-4.6',
      'tokenharbor/kimi-k3',
      'tokenharbor/glm-5.3',
      'tokenharbor/kimi-k2.6',
      'tokenharbor/mimo-v2.5-pro',
      'tokenharbor/mimo-v2.5',
      'tokenharbor/gemini-3.8-flash',
      'tokenharbor/deepseek-v4-flash',
      'tokenharbor/claude-fable-5.1',
      'tokenharbor/qwen3.7-max',
      'tokenharbor/glm-5.1',
      'tokenharbor/deepseek-v4-pro',
      'tokenharbor/claude-fable-5',
      'tokenharbor/claude-opus-4.8',
      'tokenharbor/gpt-5.5',
      'tokenharbor/qwen3.8-max',
      'tokenharbor/glm-5.3-flash',
      'tokenharbor/mimo-v2.6-pro',
      'tokenharbor/claude-sonnet-5.5',
      'tokenharbor/gpt-6-luna',
      'tokenharbor/mistral-large-2512',
      'tokenharbor/gemini-3.7-flash',
      'tokenharbor/grok-4.5',
      'tokenharbor/muse-spark-1.2',
      'tokenharbor/gpt-6-astra',
      'tokenharbor/muse-spark-1-3',
      'tokenharbor/deepseek-v4.1-flash',
      'tokenharbor/gemini-3.6-flash',
      'tokenharbor/glm-5.2',
      'tokenharbor/gpt-5.6-luna',
      'tokenharbor/gpt-5.6-sol',
      'tokenharbor/gpt-5.6-terra',
      'tokenharbor/muse-spark-1.1',
      'tokenharbor/qwen3.6-27b',
      'tokenharbor/qwen3.6-flash',
      'tokenharbor/deepseek-v3.2',
      'tokenharbor/qwen3.5-27b',
      'tokenharbor/qwen3.7-flash',
      'tokenharbor/qwen3.8-27b',
      'tokenharbor/qwen3.8-flash',
      'tokenharbor/claude-opus-5-fast',
      'tokenharbor/kimi-k3-fast',
      'tokenharbor/gpt-5.6-luna-fast',
      'tokenharbor/gpt-5.6-sol-fast',
      'tokenharbor/gpt-5.6-terra-fast',
      'tokenharbor/gpt-6-astra-fast',
      'tokenharbor/glm-5.3-fast',
      'tokenharbor/glm-5.3-flashx',
      'tokenharbor/grok-4.7',
      'tokenharbor/mimo-v2.6-flash',
      'tokenharbor/claude-opus-5.5-fast',
      'tokenharbor/gpt-6-luna-fast',
      'tokenharbor/gpt-6-sol',
      'tokenharbor/gpt-6-sol-fast',
      'tokenharbor/gpt-6.1-sol',
      'tokenharbor/gpt-6.1-sol-fast',
      'tokenharbor/mistral-large-4',
      'tokenharbor/claude-haiku-5.5',
      'tokenharbor/apex',
      'tokenharbor/mimo-v2.5:free',
      'tokenharbor/deepseek-v4-flash:free',
      'tokenharbor/deepseek-v4.1-flash:free',
      'tokenharbor/mimo-v2.6-flash:free',
      'tokenharbor/claude-haiku-5.5:free',
    ]

    expect(modelIds).toEqual(expectedModelIds)
    expect(new Set(modelIds).size).toBe(modelIds.length)
    expect(modelIds.every((id) => id.startsWith('tokenharbor/'))).toBe(true)
  })
})

describe('OpenRouter catalog', () => {
  test('defines stable upstream slugs with provider attribution', () => {
    const modelIds = Object.values(openrouterModels)

    expect(modelIds.length).toBeGreaterThan(0)
    expect(new Set(modelIds).size).toBe(modelIds.length)
    // Every static OpenRouter catalog entry must include the upstream
    // vendor prefix (e.g. `z-ai/glm-5.3-free`). The live fetch can reshare
    // bare upstream slugs, but the static table must preserve attribution so
    // provider/prefix lookup logic stays predictable.
    expect(
      modelIds.every(
        (id) =>
          id.startsWith('anthropic/') ||
          id.startsWith('google/') ||
          id.startsWith('openai/') ||
          id.startsWith('x-ai/') ||
          id.startsWith('tencent/') ||
          id.startsWith('z-ai/'),
      ),
    ).toBe(true)
  })
})

describe('supportsAssistantPrefill', () => {
  test('rejects prefill for Claude 4.6+', () => {
    expect(supportsAssistantPrefill('anthropic/claude-opus-4.6')).toBe(false)
    expect(supportsAssistantPrefill('anthropic/claude-opus-4.7')).toBe(false)
    expect(supportsAssistantPrefill('anthropic/claude-sonnet-4.6')).toBe(false)
    expect(supportsAssistantPrefill('anthropic/claude-fable-5')).toBe(false)
  })

  test('allows prefill for Claude before 4.6', () => {
    expect(supportsAssistantPrefill('anthropic/claude-sonnet-4.5')).toBe(true)
    expect(supportsAssistantPrefill('anthropic/claude-opus-4')).toBe(true)
    expect(supportsAssistantPrefill('anthropic/claude-3-5-sonnet')).toBe(true)
    expect(
      supportsAssistantPrefill('anthropic/claude-haiku-4-5-20251001'),
    ).toBe(true)
  })

  test('allows prefill for non-Claude models', () => {
    expect(supportsAssistantPrefill('openai/gpt-5.1')).toBe(true)
    expect(supportsAssistantPrefill('deepseek/deepseek-v4-pro')).toBe(true)
    expect(supportsAssistantPrefill('moonshotai/kimi-k2.6')).toBe(true)
  })
})
