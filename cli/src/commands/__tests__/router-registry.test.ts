import { describe, test, expect } from 'bun:test'

import { SLASH_COMMANDS } from '../../data/slash-commands'
import { MODE_DESCRIPTIONS } from '../../utils/constants'
import { findCommand, COMMAND_REGISTRY } from '../command-registry'

// FID-2026-0819-005 Loop 177: command-registry suites split verbatim from
// router-input.test.ts (router-utils suites stay in the parent).

describe('command-registry', () => {
  describe('findCommand', () => {
    test('finds command by name', () => {
      const login = findCommand('login')
      expect(login).toBeDefined()
      expect(login?.name).toBe('login')

      const usage = findCommand('usage')
      expect(usage).toBeDefined()
      expect(usage?.name).toBe('usage')
    })

    test('finds command by alias', () => {
      const credits = findCommand('credits')
      expect(credits).toBeDefined()
      expect(credits?.name).toBe('usage')

      // Legacy pre-rename aliases (model:edit / mode:edit) resolve to HYBRID
      // (FID-2026-0805-001 renamed EDIT → HYBRID).
      const modelEdit = findCommand('model:edit')
      expect(modelEdit).toBeDefined()
      expect(modelEdit?.name).toBe('mode:hybrid')
      const modeEdit = findCommand('mode:edit')
      expect(modeEdit).toBeDefined()
      expect(modeEdit?.name).toBe('mode:hybrid')

      const quit = findCommand('quit')
      expect(quit).toBeDefined()
      expect(quit?.name).toBe('exit')

      const signin = findCommand('signin')
      expect(signin).toBeDefined()
      expect(signin?.name).toBe('login')
    })

    test('returns undefined for unknown command', () => {
      expect(findCommand('unknown')).toBeUndefined()
      expect(findCommand('notacommand')).toBeUndefined()
    })

    test('is case insensitive', () => {
      expect(findCommand('LOGIN')?.name).toBe('login')
      expect(findCommand('UsAgE')?.name).toBe('usage')
      expect(findCommand('CREDITS')?.name).toBe('usage')
    })
  })

  describe('COMMAND_REGISTRY', () => {
    test('all commands have unique names', () => {
      const names = COMMAND_REGISTRY.map((c) => c.name)
      const uniqueNames = new Set(names)
      expect(names.length).toBe(uniqueNames.size)
    })

    test('all aliases are unique across all commands', () => {
      const allAliases = COMMAND_REGISTRY.flatMap((c) => c.aliases)
      const uniqueAliases = new Set(allAliases)
      expect(allAliases.length).toBe(uniqueAliases.size)
    })

    test('no alias conflicts with command names', () => {
      const names = new Set(COMMAND_REGISTRY.map((c) => c.name))
      const allAliases = COMMAND_REGISTRY.flatMap((c) => c.aliases)
      for (const alias of allAliases) {
        expect(names.has(alias)).toBe(false)
      }
    })

    test('slash command metadata maps to registered commands', () => {
      const registered = new Set([
        ...COMMAND_REGISTRY.map((c) => c.name),
        ...COMMAND_REGISTRY.flatMap((c) => c.aliases),
      ])

      // Commands with insertText are UI-only shortcuts that insert text into
      // the input field instead of executing a command.
      const executableCommands = SLASH_COMMANDS.filter((cmd) => !cmd.insertText)

      for (const slashCommand of executableCommands) {
        expect(registered.has(slashCommand.id)).toBe(true)
        for (const alias of slashCommand.aliases ?? []) {
          expect(registered.has(alias)).toBe(true)
        }
      }
    })

    test('mode commands expose model aliases for slash suggestions', () => {
      const modeCommands = SLASH_COMMANDS.filter((cmd) =>
        cmd.id.startsWith('mode:'),
      )
      expect(modeCommands.length).toBeGreaterThan(0)

      for (const command of modeCommands) {
        const modeName = command.id.slice('mode:'.length)
        expect(command.aliases).toContain(`model:${modeName}`)
      }
    })

    test('mode commands carry the MODE_DESCRIPTIONS contracts as descriptions', () => {
      // The slash menu shows each mode's contract (shared single source with
      // the toggle hovertip) so STRICT's ceremony is visible without hovering
      // (FID-2026-0805-001).
      const modeCommands = SLASH_COMMANDS.filter((cmd) =>
        cmd.id.startsWith('mode:'),
      )
      expect(modeCommands.length).toBe(4)

      for (const command of modeCommands) {
        const modeName = command.id
          .slice('mode:'.length)
          .toUpperCase() as keyof typeof MODE_DESCRIPTIONS
        expect(command.description).toBe(MODE_DESCRIPTIONS[modeName])
      }

      // The bare /mode entry is present for menu discovery.
      const bareMode = SLASH_COMMANDS.find((cmd) => cmd.id === 'mode')
      expect(bareMode).toBeDefined()
    })

    test('connect command is not available in savant-code (savant-free-only)', () => {
      const hasConnectSlashCommand = SLASH_COMMANDS.some(
        (cmd) => cmd.id === 'connect',
      )
      expect(hasConnectSlashCommand).toBe(false)
    })

    test('connect:chatgpt command is not available in savant-code (savant-free-only)', () => {
      const command = findCommand('connect:chatgpt')
      expect(command).toBeUndefined()
    })
  })
})
