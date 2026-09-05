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
  test('defines the complete published 20-model catalog', () => {
    const modelIds = Object.values(tokenharborModels)

    const expectedModelIds: typeof modelIds = [
      'tokenharbor/claude-opus-5',
      'tokenharbor/claude-fable-5',
      'tokenharbor/gpt-5.6-sol',
      'tokenharbor/kimi-k3',
      'tokenharbor/qwen3.8-max',
      'tokenharbor/gpt-5.6-terra',
      'tokenharbor/grok-4.5',
      'tokenharbor/claude-sonnet-5',
      'tokenharbor/gemini-3.6-flash',
      'tokenharbor/glm-5.2',
      'tokenharbor/gpt-5.6-luna',
      'tokenharbor/deepseek-v4-flash',
      'tokenharbor/minimax-m3',
      'tokenharbor/deepseek-v4-pro',
      'tokenharbor/mimo-v2.5-pro',
      'tokenharbor/mimo-v2.5',
      'tokenharbor/kimi-k3:free',
      'tokenharbor/deepseek-v4-flash:free',
      'tokenharbor/mimo-v2.5:free',
      'tokenharbor/th-orchestra',
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
