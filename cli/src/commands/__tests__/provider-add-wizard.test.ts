import fs from 'fs'
import os from 'os'
import path from 'path'

import { getReservedCustomProviderIds } from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  cancelWizardSession,
  createWizardSession,
  submitWizardStep,
} from '../../utils/provider-wizard'

import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * The /provider add|edit wizard step machine (FID-2026-0910-004 Step 7,
 * D7 + MQ12): step sequencing, validation + inline re-prompt, edit prefill,
 * key-kept-on-empty, fail-closed save. The machine is pure — persistence is
 * the route handler's job (router e2e: provider-wizard-routing.test.ts).
 */

const VALID_BASE = {
  label: 'My Gateway',
  baseUrl: 'https://gw.example.com/v1',
  envVar: 'MY_GW_KEY',
}

describe('provider add|edit wizard step machine (FID-2026-0910-004 Step 7)', () => {
  // The machine reads loadSettings() to exclude existing custom ids from the
  // id step; redirect the config dir so tests never touch the real one (the
  // pollution lesson — a harness must never delete or write through its own
  // override).
  let tempDir = ''
  let originalConfigDir: string | undefined

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-wizard-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    cancelWizardSession()
  })

  afterEach(() => {
    cancelWizardSession()
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('steps advance in order: id -> label -> baseUrl -> protocol -> envVar -> models -> key (FID-2026-0911-003)', () => {
    const session = createWizardSession('add')
    expect(session.step).toBe('id')

    const afterId = submitWizardStep(session, 'my-gateway')
    expect(afterId.step).toBe('label')

    const afterLabel = submitWizardStep(afterId, VALID_BASE.label)
    expect(afterLabel.step).toBe('baseUrl')

    const afterUrl = submitWizardStep(afterLabel, VALID_BASE.baseUrl)
    expect(afterUrl.step).toBe('protocol')

    // Enter defaults to openai.
    const afterProtocol = submitWizardStep(afterUrl, '')
    expect(afterProtocol.step).toBe('envVar')

    const afterEnvVar = submitWizardStep(afterProtocol, VALID_BASE.envVar)
    expect(afterEnvVar.step).toBe('models')

    const afterModels = submitWizardStep(afterEnvVar, '')
    expect(afterModels.step).toBe('key')
  })

  test('protocol step: anthropic is accepted and recorded on the draft (FID-2026-0911-003)', () => {
    let session = createWizardSession('add')
    session = submitWizardStep(session, 'my-gateway')
    session = submitWizardStep(session, VALID_BASE.label)
    session = submitWizardStep(session, VALID_BASE.baseUrl)
    expect(session.step).toBe('protocol')
    const afterProtocol = submitWizardStep(session, 'anthropic')
    expect(afterProtocol.step).toBe('envVar')
    expect(afterProtocol.draft.protocol).toBe('anthropic')
  })

  test('protocol step: anything but openai/anthropic (case-insensitive) re-prompts (FID-2026-0911-003)', () => {
    let session = createWizardSession('add')
    session = submitWizardStep(session, 'my-gateway')
    session = submitWizardStep(session, VALID_BASE.label)
    session = submitWizardStep(session, VALID_BASE.baseUrl)
    for (const bad of ['gemini', 'grpc', 'openai2']) {
      const rejected = submitWizardStep(session, bad)
      expect(rejected.step).toBe('protocol')
      expect(rejected.error).toContain('protocol')
    }
    // Case-insensitive accept + explicit openai.
    const okLower = submitWizardStep(session, 'Anthropic')
    expect(okLower.step).toBe('envVar')
    expect(okLower.draft.protocol).toBe('anthropic')
  })

  test('id step: reserved ids (built-in or org slug) re-prompt with the problem', () => {
    const session = createWizardSession('add')
    for (const reserved of ['openrouter', 'anthropic']) {
      const rejected = submitWizardStep(session, reserved)
      expect(rejected.step).toBe('id')
      expect(rejected.error).toContain('reserved')
    }
  })

  test('grammar reservation includes test (FID-2026-0911-003)', () => {
    // The reserved set must cover the full command grammar — a custom id
    // named 'test' would shadow /provider test.
    const reserved = getReservedCustomProviderIds()
    for (const word of ['add', 'edit', 'list', 'remove', 'test']) {
      expect(reserved.has(word)).toBe(true)
    }
  })

  test('id step: malformed slug re-prompts with the charset rule', () => {
    const session = createWizardSession('add')
    // Parser parity (Law 13): CUSTOM_ID_PATTERN accepts leading/trailing
    // hyphens ('-ab', 'ab-') — the wizard must reject exactly what the parser
    // rejects, no stricter. Only true charset violations re-prompt here.
    for (const bad of ['A', 'UPPER', 'a', 'a b', 'x'.repeat(33)]) {
      const rejected = submitWizardStep(session, bad)
      expect(rejected.step).toBe('id')
      expect(rejected.error).toContain('id')
    }
  })

  test('envVar step: claimed env vars re-prompt; wrong shape re-prompts', () => {
    let session = createWizardSession('add')
    session = submitWizardStep(session, 'my-gateway')
    session = submitWizardStep(session, VALID_BASE.label)
    session = submitWizardStep(session, VALID_BASE.baseUrl)
    session = submitWizardStep(session, '')

    const claimed = submitWizardStep(session, 'OPENROUTER_API_KEY')
    expect(claimed.step).toBe('envVar')
    expect(claimed.error).toContain('claimed')

    const research = submitWizardStep(session, 'SERPER_API_KEY')
    expect(research.step).toBe('envVar')
    expect(research.error).toContain('claimed')

    const malformed = submitWizardStep(session, 'my-key')
    expect(malformed.step).toBe('envVar')
    expect(malformed.error).toContain('SNAKE_CASE')
  })

  test('baseUrl step: non-http(s) or unparseable URLs re-prompt', () => {
    let session = createWizardSession('add')
    session = submitWizardStep(session, 'my-gateway')
    session = submitWizardStep(session, VALID_BASE.label)

    for (const bad of ['ftp://example.com', 'not a url', '']) {
      const rejected = submitWizardStep(session, bad)
      expect(rejected.step).toBe('baseUrl')
      expect(rejected.error).toContain('URL')
    }
  })

  test('models step: inline ids must carry the my-gateway/ prefix; empty means none', () => {
    let session = createWizardSession('add')
    for (const value of [
      'my-gateway',
      VALID_BASE.label,
      VALID_BASE.baseUrl,
      '', // protocol step (FID-2026-0911-003): Enter = openai default
      VALID_BASE.envVar,
    ]) {
      session = submitWizardStep(session, value)
    }

    const rejected = submitWizardStep(session, 'unprefixed-model=Model X')
    expect(rejected.step).toBe('models')
    expect(rejected.error).toContain('my-gateway/')

    const accepted = submitWizardStep(
      session,
      'my-gateway/model-a=Model A, my-gateway/model-b=Model B',
    )
    expect(accepted.step).toBe('key')
    expect(accepted.draft?.catalog).toEqual({
      source: 'inline',
      models: {
        'my-gateway/model-a': 'Model A',
        'my-gateway/model-b': 'Model B',
      },
    })

    // None source: empty input finalizes the catalog as { source: 'none' }.
    let session2 = createWizardSession('add')
    for (const value of [
      'my-gateway',
      VALID_BASE.label,
      VALID_BASE.baseUrl,
      '', // protocol step (FID-2026-0911-003): Enter = openai default
      VALID_BASE.envVar,
    ]) {
      session2 = submitWizardStep(session2, value)
    }
    const none = submitWizardStep(session2, '')
    expect(none.step).toBe('key')
    expect(none.draft?.catalog).toEqual({ source: 'none' })
  })

  test('edit mode prefills the stored definition and locks the id step', () => {
    const stored: CustomProviderConfig = {
      id: 'my-gateway',
      label: 'My Gateway',
      baseUrl: 'https://gw.example.com/v1',
      apiKeyEnvVar: 'MY_GW_KEY',
      catalog: { source: 'none' },
    }
    const session = createWizardSession('edit', stored)
    expect(session.step).toBe('label')
    expect(session.draft?.label).toBe('My Gateway')

    // The id step never appears in edit mode: submitting label moves on.
    const afterLabel = submitWizardStep(session, 'Renamed Gateway')
    expect(afterLabel.step).toBe('baseUrl')
    expect(afterLabel.draft?.id).toBe('my-gateway')
  })

  test('key step keeps the stored key on empty submit (edit mode only)', () => {
    const stored: CustomProviderConfig = {
      id: 'my-gateway',
      label: 'My Gateway',
      baseUrl: 'https://gw.example.com/v1',
      apiKeyEnvVar: 'MY_GW_KEY',
      catalog: { source: 'none' },
    }
    let session = createWizardSession('edit', stored)
    // Full walk: id is locked in edit mode, so the first submit lands at label.
    session = submitWizardStep(session, 'Renamed')
    session = submitWizardStep(session, VALID_BASE.baseUrl)
    session = submitWizardStep(session, '') // protocol default (0911-003)
    session = submitWizardStep(session, VALID_BASE.envVar)
    session = submitWizardStep(session, '')
    expect(session.step).toBe('key')

    // Empty key in edit mode: keep the existing key (which lives outside the
    // machine — finalize must succeed without a new key).
    const finalize = submitWizardStep(session, '')
    expect(finalize.step).toBe('done')
    expect(finalize.final).toBeDefined()
    expect(finalize.final?.id).toBe('my-gateway')
    expect(finalize.final?.label).toBe('Renamed')
    expect(finalize.final?.apiKeyEnvVar).toBe('MY_GW_KEY')
  })

  test('key step in add mode: empty key re-prompts', () => {
    let session = createWizardSession('add')
    for (const value of [
      'my-gateway',
      VALID_BASE.label,
      VALID_BASE.baseUrl,
      '', // protocol step (FID-2026-0911-003)
      VALID_BASE.envVar,
      '',
    ]) {
      session = submitWizardStep(session, value)
    }
    expect(session.step).toBe('key')
    const rejected = submitWizardStep(session, '')
    expect(rejected.step).toBe('key')
    expect(rejected.error).toContain('key')
  })

  test('finalize emits a validated CustomProviderConfig (parseCustomProviders truth)', () => {
    let session = createWizardSession('add')
    for (const value of [
      'my-gateway',
      VALID_BASE.label,
      VALID_BASE.baseUrl,
      '', // protocol step (FID-2026-0911-003)
      VALID_BASE.envVar,
      'my-gateway/m1=M One',
      'gw-secret-key',
    ]) {
      session = submitWizardStep(session, value)
    }
    expect(session.step).toBe('done')
    expect(session.final).toEqual({
      id: 'my-gateway',
      label: VALID_BASE.label,
      baseUrl: VALID_BASE.baseUrl,
      apiKeyEnvVar: VALID_BASE.envVar,
      protocol: 'openai',
      catalog: { source: 'inline', models: { 'my-gateway/m1': 'M One' } },
    })
  })
})

// FID-2026-0913-002: e2e + seam pins -> provider-wizard-routing.test.ts; replay pins -> provider-wizard-replay.test.ts.
