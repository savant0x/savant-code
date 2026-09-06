import { describe, expect, test } from 'bun:test'

import { fetchTokenRouterModels } from '../static-catalogs'

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
