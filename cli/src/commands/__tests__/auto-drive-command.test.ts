import { describe, expect, it } from 'bun:test'

import { SLASH_COMMANDS } from '../../data/slash-commands'
import { handleAutoCommand } from '../auto-drive'
import { findCommand } from '../command-registry'

/**
 * FID-2026-0818-002: Auto Drive discoverability. The feature is named "Auto
 * Drive", so the canonical slash command is `/auto-drive`; `/auto`, `/drive`,
 * and `/autodrive` are hidden aliases that resolve to the same handler. This
 * test pins that every spelling triggers the drive and that the menu surfaces
 * the feature name (not the pre-rename `/auto` label).
 */
describe('Auto Drive command discoverability', () => {
  it('canonical /auto-drive resolves to handleAutoCommand', () => {
    expect(findCommand('auto-drive')?.name).toBe('auto-drive')
    expect(findCommand('auto-drive')?.handler).toBe(handleAutoCommand)
  })

  it('hidden aliases /auto, /drive, /autodrive resolve to the same definition', () => {
    const canonical = findCommand('auto-drive')
    expect(canonical).toBeDefined()
    for (const alias of ['auto', 'drive', 'autodrive']) {
      expect(findCommand(alias), `/${alias} should resolve`).toBe(canonical)
    }
  })

  it('the slash menu surfaces the auto-drive label with all aliases', () => {
    const entry = SLASH_COMMANDS.find((cmd) => cmd.id === 'auto-drive')
    expect(entry).toBeDefined()
    expect(entry?.label).toBe('auto-drive')
    expect(entry?.aliases).toEqual(['auto', 'drive', 'autodrive'])
  })
})
