import { describe, expect, test } from 'bun:test'

import {
  CFG,
  makeParams,
  seedSettings as seedSettingsFile,
  setupProviderCommandEnv,
  restoreProviderCommandEnv,
} from './provider-commands-harness'

import type { ChatMessage } from '../../types/chat'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * `/provider list` ordering (FID-2026-1001-001): label sort WITHIN the
 * built-ins segment and within the customs segment — the same contract as
 * the /provider picker; registry insertion order is not display order.
 */
describe('/provider list ordering (FID-2026-1001-001)', () => {
  let tempDir = ''
  let originals: Record<string, string | undefined> = {}

  const seedSettings = (customs: CustomProviderConfig[]): void =>
    seedSettingsFile(tempDir, customs)

  test('renders alphabetically within each segment', async () => {
    ;({ tempDir, originals } = setupProviderCommandEnv())
    // Distinct env vars + no catalogs: a custom pair sharing one env var
    // fails the custom-registration validation and is dropped wholesale.
    seedSettings([
      {
        id: 'zeta',
        label: 'Zeta Gateway',
        baseUrl: 'https://zeta.example.com/v1',
        apiKeyEnvVar: 'ZETA_KEY',
        protocol: 'openai',
        catalog: { source: 'none' },
      },
      {
        id: 'alpha',
        label: 'Alpha Relay',
        baseUrl: 'https://alpha.example.com/v1',
        apiKeyEnvVar: 'ALPHA_KEY',
        protocol: 'openai',
        catalog: { source: 'none' },
      },
    ] satisfies CustomProviderConfig[])
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider list', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    const output = JSON.stringify(messages)
    // Built-ins segment: sorted among themselves.
    const builtinLabels = [
      'Atria AI',
      'Clean APIs',
      'KiosAPI',
      'OpenAI',
      'OpenRouter',
    ]
    const builtinPositions = builtinLabels.map((label) => output.indexOf(label))
    for (const [index, position] of builtinPositions.entries()) {
      expect(position, builtinLabels[index]).toBeGreaterThan(-1)
    }
    expect(builtinPositions).toEqual(
      [...builtinPositions].sort((a, b) => a - b),
    )
    // Customs segment follows the built-ins segment and is sorted within it
    // ('Alpha Relay' intentionally sorts after every built-in — segment rule).
    const alphaAt = output.indexOf('Alpha Relay')
    const zetaAt = output.indexOf('Zeta Gateway')
    expect(alphaAt).toBeGreaterThan(-1)
    expect(zetaAt).toBeGreaterThan(-1)
    expect(zetaAt).toBeGreaterThan(alphaAt)
    expect(alphaAt).toBeGreaterThan(output.indexOf('Vercel AI Gateway'))
    restoreProviderCommandEnv(originals, tempDir)
  })

  test('markers still render (configured, custom) alongside the sort', async () => {
    ;({ tempDir, originals } = setupProviderCommandEnv())
    seedSettings([CFG])
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider list', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    const text = JSON.stringify(messages)
    expect(text).toContain('My Gateway')
    expect(text).toContain('custom')
    restoreProviderCommandEnv(originals, tempDir)
  })
})
