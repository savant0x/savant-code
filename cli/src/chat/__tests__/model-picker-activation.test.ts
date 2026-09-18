// Regression suite for FID-2026-0917-005 — the /model picker provider
// passthrough. Pins the contract handleModelPickerSelect must satisfy:
// selecting a model activates its provider's runtime routing
// (DIRECT_PROVIDER + INFERENCE_BASE_URL) so requests stop passthrough-ing
// to the SavantCode backend (402 "Out of credits").
//
// The suite exercises `applyModelPickerSelection` — the exact function the
// picker handler imports and calls — so it covers the real persist +
// activation contract end to end (Law 13: one function, one truth). React 19
// + Bun renderHook() is unreliable in this repo (see
// use-input-history-harness.ts), so the handler itself is a one-line
// delegation to this tested seam.

import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { PROVIDER_SETUP_CONFIG } from '../../utils/provider-key-store'
import { applyModelPickerSelection } from '../../utils/provider-setup'
import { loadSettings } from '../../utils/settings'

describe('model picker provider activation (FID-2026-0917-005)', () => {
  let originalConfigDir: string | undefined
  let tempDir: string
  const trackedVars = [
    'DIRECT_PROVIDER',
    'INFERENCE_BASE_URL',
    ...Object.values(PROVIDER_SETUP_CONFIG).map((c) => c.envVar),
  ]
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-model-picker-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    originalEnv = Object.fromEntries(
      trackedVars.map((name) => [name, process.env[name]]),
    )
    for (const name of trackedVars) delete process.env[name]
  })

  afterEach(() => {
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('a model with no provider field resolves to the openrouter default and activates', () => {
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key'

    // provider omitted — must default to 'openrouter', same as the handler's
    // `model.provider ?? 'openrouter'`.
    applyModelPickerSelection({ id: 'openrouter/auto' })

    expect(process.env.DIRECT_PROVIDER).toBe('openrouter')
    expect(process.env.INFERENCE_BASE_URL).toBe(
      PROVIDER_SETUP_CONFIG['openrouter'].baseUrl,
    )
  })

  test('selecting a configured model activates its provider routing', () => {
    process.env.TOKENHARBOR_API_KEY = 'test-tokenharbor-key'

    applyModelPickerSelection({
      id: 'tokenharbor/model',
      provider: 'tokenharbor',
    })

    expect(process.env.DIRECT_PROVIDER).toBe('tokenharbor')
    expect(process.env.INFERENCE_BASE_URL).toBe(
      PROVIDER_SETUP_CONFIG['tokenharbor'].baseUrl,
    )
  })

  test('the model preference is persisted alongside activation', () => {
    process.env.TOKENHARBOR_API_KEY = 'test-tokenharbor-key'

    applyModelPickerSelection({
      id: 'tokenharbor/model',
      provider: 'tokenharbor',
    })

    expect(loadSettings().savantCodeModelPreference).toBe('tokenharbor/model')
  })

  test('an unkeyed provider leaves existing routing untouched (fail-closed)', () => {
    // The operator's explicit route must survive a model pick whose provider
    // has no configured key — activation declines and the request fails with
    // a clear missing-key error instead of silently degrading to the backend.
    process.env.DIRECT_PROVIDER = 'ollama'
    process.env.INFERENCE_BASE_URL = 'https://custom.example/v1'

    applyModelPickerSelection({
      id: 'tokenharbor/model',
      provider: 'tokenharbor',
    })

    expect(process.env.DIRECT_PROVIDER).toBe('ollama')
    expect(process.env.INFERENCE_BASE_URL).toBe('https://custom.example/v1')
  })

  test('an unkeyed provider still persists the picker-section preference', () => {
    // Activation declined, but the next /model open should still default to
    // the selected provider's section.
    applyModelPickerSelection({
      id: 'tokenharbor/model',
      provider: 'tokenharbor',
    })

    expect(loadSettings().savantCodeModelProviderPreference).toBe('tokenharbor')
  })
})
