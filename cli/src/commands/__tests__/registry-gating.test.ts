import { describe, expect, test } from 'bun:test'

import {
  BACKEND_ONLY_COMMAND_IDS,
  buildSlashCommands,
  SLASH_COMMANDS,
} from '../../data/slash-commands'
import { getProviderSetupGuidance } from '../../utils/provider-setup'
import { COMMAND_REGISTRY, findCommand } from '../command-registry'

describe('Savant-Code command availability', () => {
  test('the retired session command cannot shadow model selection', () => {
    expect(findCommand('end-session')).toBeUndefined()
    expect(findCommand('model')?.name).toBe('model')
    expect(SLASH_COMMANDS.some((cmd) => cmd.id === 'end-session')).toBe(false)
  })

  test('every menu command resolves and registry entries remain discoverable', () => {
    for (const item of SLASH_COMMANDS)
      expect(findCommand(item.id)).toBeDefined()
    for (const command of COMMAND_REGISTRY) {
      const visible = SLASH_COMMANDS.some((item) => item.id === command.name)
      const hidden =
        command.name === 'dev' ||
        command.name.startsWith('skill:') ||
        BACKEND_ONLY_COMMAND_IDS.has(command.name)
      expect(visible || hidden, command.name).toBe(true)
    }
  })

  test('direct-provider menus exclude only entries requiring a backend', () => {
    const direct = buildSlashCommands({ directProvider: true })
    const backend = buildSlashCommands({ directProvider: false })
    for (const id of BACKEND_ONLY_COMMAND_IDS) {
      expect(direct.some((item) => item.id === id)).toBe(false)
      expect(backend.some((item) => item.id === id)).toBe(true)
    }
  })

  test('provider guidance names available commands', () => {
    const guidance = getProviderSetupGuidance({
      provider: 'tokenharbor',
      envVar: 'TOKENHARBOR_API_KEY',
      label: 'TokenHarbor',
      baseUrl: 'https://tokenharbor.ai/v1',
    })
    expect(guidance).toContain('/provider')
    expect(findCommand('provider')).toBeDefined()
    expect(findCommand('dev')).toBe(findCommand('dev'))
  })
})
