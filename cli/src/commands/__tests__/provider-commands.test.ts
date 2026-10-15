import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  CFG,
  makeParams,
  readSettings as readSettingsFile,
  restoreProviderCommandEnv,
  seedCredentials as seedCredentialsFile,
  seedSettings as seedSettingsFile,
  setupProviderCommandEnv,
} from './provider-commands-harness'
import { useChatStore } from '../../state/chat-store'
import { useProviderPickerStore } from '../../state/provider-picker-store'
import {
  createWizardSession,
  getActiveWizardSession,
  submitWizardStep,
} from '../../utils/provider-wizard'
import {
  getActiveProvider,
  loadSavantCodeModelPreference,
  saveActiveProvider,
} from '../../utils/settings'

import type { ChatMessage } from '../../types/chat'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * The /provider add|edit|list|remove grammar (FID-2026-0910-004 Step 8, C4):
 * subcommand dispatch wiring the Step 7 wizard to users, picker inclusion of
 * customs (effective view — one truth), the remove flow's active-provider
 * warn + selection reset (MQ1), grammar-reserved wizard ids, and wizard
 * input-mode continuity (the Step 7 route handler must keep the user IN the
 * wizard between steps — the prior e2e pin re-set the mode manually and
 * masked the defect; corrected here, recorded in Loop 8).
 */

describe('provider command grammar (FID-2026-0910-004 Step 8)', () => {
  // Shared harness (FID-2026-0913-002): isolated config dir, clean routing
  // env, store resets, seeding, and the RouterParams mock live in
  // provider-commands-harness.ts.
  let tempDir = ''
  let originals: Record<string, string | undefined> = {}

  beforeEach(() => {
    ;({ tempDir, originals } = setupProviderCommandEnv())
  })

  afterEach(() => {
    restoreProviderCommandEnv(originals, tempDir)
  })

  const seedSettings = (customs: CustomProviderConfig[]): void =>
    seedSettingsFile(tempDir, customs)
  const seedCredentials = (keys: Record<string, string>): void =>
    seedCredentialsFile(tempDir, keys)
  const readSettings = (): { customProviders?: CustomProviderConfig[] } =>
    readSettingsFile(tempDir)

  test('/provider add starts the wizard at the id step', async () => {
    const messages: ChatMessage[] = []
    const { params, saveToHistory } = makeParams('/provider add', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(useChatStore.getState().inputMode).toBe('providerAdd')
    expect(getActiveWizardSession()?.step).toBe('id')
    expect(saveToHistory).toHaveBeenCalledWith('/provider add')
    expect(JSON.stringify(messages)).toContain('Provider id')
  })

  test('an intermediate wizard submit keeps the wizard input mode', async () => {
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider add', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    // Continuity (the Step 7 defect): submitting the id must keep the user in
    // the wizard — the next submit is the label, not a chat message.
    params.inputValue = 'my-gateway'
    await routeUserPrompt(params)

    expect(useChatStore.getState().inputMode).toBe('providerAdd')
    expect(getActiveWizardSession()?.step).toBe('label')
  })

  test('a full add walk stays in wizard mode and returns to default on done', async () => {
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider add', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    // No manual mode re-set anywhere: the handler must carry the mode across
    // steps, including the masked key step (providerAddKey) and back to
    // default on done. The empty models submit is meaningful (no catalog).
    // [FID-2026-0913-002 repair — pre-existing stale walk: the protocol step
    // added by FID-2026-0911-003 (commit 89847116) left this walk behind;
    // proven failing at HEAD pre-split by stash test. The empty submit is the
    // protocol default (Enter = openai).]
    for (const value of [
      'my-gateway',
      'My Gateway',
      'https://gw.example.com/v1',
      '', // protocol step (FID-2026-0911-003): Enter = openai default
      'MY_GW_KEY',
      'my-gateway/m1=M One',
    ]) {
      params.inputValue = value
      await routeUserPrompt(params)
    }
    expect(useChatStore.getState().inputMode).toBe('providerAddKey')

    params.inputValue = 'gw-secret-key'
    await routeUserPrompt(params)

    expect(useChatStore.getState().inputMode).toBe('default')
    expect(getActiveWizardSession()).toBeUndefined()
    expect(readSettings().customProviders).toEqual([CFG])
  })

  test('/provider edit <id> opens the prefilled edit session (custom-only)', async () => {
    seedSettings([CFG])
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider edit my-gateway', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(useChatStore.getState().inputMode).toBe('providerAdd')
    const session = getActiveWizardSession()
    expect(session?.mode).toBe('edit')
    expect(session?.step).toBe('label')
    expect(session?.draft?.label).toBe('My Gateway')
    expect(JSON.stringify(messages)).toContain('Editing My Gateway')
  })

  test('/provider edit <unknown> reports without starting a session', async () => {
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider edit nope', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(getActiveWizardSession()).toBeUndefined()
    expect(JSON.stringify(messages)).toContain('No custom provider')
  })

  test('/provider list shows built-ins and registered customs with markers', async () => {
    seedSettings([CFG])
    seedCredentials({ MY_GW_KEY: 'stored-key' })
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider list', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    const text = JSON.stringify(messages)
    expect(text).toContain('OpenRouter')
    expect(text).toContain('My Gateway')
    expect(text).toContain('custom')
    expect(text).toContain('configured')
  })

  test('/provider remove <custom> deletes it and re-registers the registry', async () => {
    seedSettings([CFG])
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider remove my-gateway', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(readSettings().customProviders).toEqual([])
    expect('my-gateway' in getEffectiveProviderRegistry()).toBe(false)
    expect(JSON.stringify(messages)).toContain('removed')
  })

  test('removing the active provider warns and resets selection + routing', async () => {
    seedSettings([CFG])
    seedCredentials({ MY_GW_KEY: 'stored-key' })
    saveActiveProvider('my-gateway')
    process.env.DIRECT_PROVIDER = 'my-gateway'
    process.env.INFERENCE_BASE_URL = CFG.baseUrl
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider remove my-gateway', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(getActiveProvider()).toBe('openrouter')
    expect(
      (loadSavantCodeModelPreference() ?? '').startsWith('my-gateway/'),
    ).toBe(false)
    expect(process.env.DIRECT_PROVIDER).toBeUndefined()
    expect(process.env.INFERENCE_BASE_URL).toBeUndefined()
    expect(JSON.stringify(messages)).toContain('active provider')
  })

  test('/provider remove rejects built-ins', async () => {
    seedSettings([CFG])
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider remove openrouter', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(JSON.stringify(messages)).toContain('Built-in')
    expect('openrouter' in getEffectiveProviderRegistry()).toBe(true)
    expect(readSettings().customProviders).toEqual([CFG])
  })

  test('the wizard id step rejects command words (grammar-reserved)', () => {
    const session = createWizardSession('add')
    for (const word of ['add', 'edit', 'list', 'remove']) {
      const rejected = submitWizardStep(session, word)
      expect(rejected.step).toBe('id')
      expect(rejected.error).toContain('reserved')
    }
  })

  test('/provider (picker) includes customs with configured badges', async () => {
    seedSettings([CFG])
    seedCredentials({ MY_GW_KEY: 'stored-key' })
    const messages: ChatMessage[] = []
    const { params } = makeParams('/provider', messages)

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    const picker = useProviderPickerStore.getState()
    expect(picker.isOpen).toBe(true)
    const custom = picker.providers.find((p) => p.name === 'my-gateway')
    expect(custom).toBeDefined()
    expect(custom?.configured).toBe(true)
    expect(custom?.label).toContain('custom')
    // Built-ins still present, ordered before customs.
    const builtinIndex = picker.providers.findIndex(
      (p) => p.name === 'openrouter',
    )
    expect(builtinIndex).toBeGreaterThanOrEqual(0)
    expect(builtinIndex).toBeLessThan(
      picker.providers.findIndex((p) => p.name === 'my-gateway'),
    )
  })

  test('parseProviderArgs preserves the <name> update semantics', async () => {
    const { parseProviderArgs } = await import('../provider-subcommands')

    expect(parseProviderArgs('nous update')).toEqual({
      kind: 'provider',
      name: 'nous',
      wantsKeyUpdate: true,
    })
    expect(parseProviderArgs('my-gateway/model extra update')).toEqual({
      kind: 'provider',
      name: 'my-gateway/model extra',
      wantsKeyUpdate: true,
    })
    expect(parseProviderArgs('add')).toEqual({
      kind: 'subcommand',
      subcommand: 'add',
      rest: '',
    })
    expect(parseProviderArgs('remove my-gateway')).toEqual({
      kind: 'subcommand',
      subcommand: 'remove',
      rest: 'my-gateway',
    })
    expect(parseProviderArgs('openrouter')).toEqual({
      kind: 'provider',
      name: 'openrouter',
      wantsKeyUpdate: false,
    })
  })
})
