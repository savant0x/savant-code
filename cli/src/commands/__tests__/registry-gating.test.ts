import { describe, expect, it } from 'bun:test'

import {
  SAVANT_FREE_ONLY_COMMAND_IDS,
  SAVANT_FREE_REMOVED_COMMAND_IDS,
  SLASH_COMMANDS,
} from '../../data/slash-commands'
import { getProviderSetupGuidance } from '../../utils/provider-setup'
import {
  ALL_COMMAND_DEFINITIONS,
  COMMAND_REGISTRY,
  SAVANT_FREE_ONLY_COMMAND_NAMES,
  SAVANT_FREE_REMOVED_COMMAND_NAMES,
  filterCommandsForBuild,
  findCommand,
} from '../command-registry'

/**
 * FID-2026-0802-007 V4 / U1 / D1 / D2: free-vs-paid gating parity between the
 * command registry and the slash-command menu, plus the guidance/registry
 * contract and /dev definition identity.
 *
 * The gating split lives in TWO files (command-registry.ts and
 * data/slash-commands.ts) with independently-maintained removal sets — this
 * test keeps them in lockstep so a D1-class drift (menu hides a command the
 * registry still executes, or vice versa) fails CI.
 */
describe('registry gating matrix (FID-007)', () => {
  const freeRegistry = filterCommandsForBuild(ALL_COMMAND_DEFINITIONS, true)
  const paidRegistry = filterCommandsForBuild(ALL_COMMAND_DEFINITIONS, false)

  it('free and paid registries exclude exactly their gated command sets', () => {
    const freeNames = new Set(freeRegistry.map((c) => c.name))
    const paidNames = new Set(paidRegistry.map((c) => c.name))

    // Free build removes ads/usage/subscribe/image/publish.
    for (const name of SAVANT_FREE_REMOVED_COMMAND_NAMES) {
      expect(freeNames.has(name)).toBe(false)
      expect(paidNames.has(name)).toBe(true)
    }
    // Paid build removes the free-only commands (connect/plan/end-session).
    for (const name of SAVANT_FREE_ONLY_COMMAND_NAMES) {
      expect(paidNames.has(name)).toBe(false)
      expect(freeNames.has(name)).toBe(true)
    }
  })

  it('menu and registry removal sets are in lockstep (D1 drift guard)', () => {
    // Every command hidden from the free menu must also be excluded from the
    // free registry (a hidden command must not still execute).
    for (const id of SAVANT_FREE_REMOVED_COMMAND_IDS) {
      expect(SAVANT_FREE_REMOVED_COMMAND_NAMES.has(id)).toBe(true)
    }
    for (const name of SAVANT_FREE_REMOVED_COMMAND_NAMES) {
      expect(SAVANT_FREE_REMOVED_COMMAND_IDS.has(name)).toBe(true)
    }
    // Same for the free-only sets.
    for (const id of SAVANT_FREE_ONLY_COMMAND_IDS) {
      expect(SAVANT_FREE_ONLY_COMMAND_NAMES.has(id)).toBe(true)
    }
    for (const name of SAVANT_FREE_ONLY_COMMAND_NAMES) {
      expect(SAVANT_FREE_ONLY_COMMAND_IDS.has(name)).toBe(true)
    }
  })

  it('every slash-menu command resolves in the matching registry (both flavors)', () => {
    // The test environment is the paid flavor, so SLASH_COMMANDS is the paid
    // menu. Reconstruct the free menu from the shared sets: paid menu ids +
    // free-only ids (stripped from the paid menu) - free-removed ids.
    const paidMenuIds = new Set(SLASH_COMMANDS.map((cmd) => cmd.id))
    const freeMenuIds = new Set([
      ...paidMenuIds,
      ...SAVANT_FREE_ONLY_COMMAND_IDS,
    ])
    for (const id of SAVANT_FREE_REMOVED_COMMAND_IDS) {
      freeMenuIds.delete(id)
    }

    const allNames = new Set(ALL_COMMAND_DEFINITIONS.map((cmd) => cmd.name))
    const freeRegistryNames = new Set(freeRegistry.map((cmd) => cmd.name))

    for (const id of paidMenuIds) {
      expect(findCommand(id), `paid menu ${id} should resolve`).toBeDefined()
    }
    for (const id of freeMenuIds) {
      // Only ids that correspond to an actual command definition (e.g.
      // connect is CHATGPT_OAUTH-gated) must resolve in the free registry.
      if (allNames.has(id)) {
        expect(
          freeRegistryNames.has(id),
          `free menu ${id} should resolve in the free registry`,
        ).toBe(true)
      }
    }
    // And every registry command name is discoverable via the menu or is a
    // known hidden command (/dev, skill: prefix).
    for (const cmd of COMMAND_REGISTRY) {
      const inMenu = SLASH_COMMANDS.some((m) => m.id === cmd.name)
      const hidden = cmd.name === 'dev' || cmd.name.startsWith('skill:')
      expect(
        inMenu || hidden,
        `registry ${cmd.name} should be discoverable`,
      ).toBe(true)
    }
  })

  it('U1 guard: guidance references only commands registered in the build that shows it', () => {
    // getProviderSetupGuidance tells users to run /provider — that command is
    // registered in the paid build (where the guidance is shown after FID-007).
    const guidance = getProviderSetupGuidance({
      provider: 'opencode-go',
      envVar: 'OPENCODE_GO_API_KEY',
      label: 'OpenCode Go',
      baseUrl: 'https://opencode.ai/zen/go/v1',
    })
    expect(guidance).toContain('/provider')
    expect(findCommand('provider')).toBeDefined()
    expect(findCommand('model')).toBeDefined()
  })

  it('D2: findCommand returns a stable /dev definition identity', () => {
    expect(findCommand('dev')).toBe(findCommand('dev'))
    expect(findCommand('/dev')).toBe(findCommand('/dev'))
  })
})
