import { describe, expect, test } from 'bun:test'

import { SAVANT_DISCORD_CLIENT_ID } from '../../utils/settings'
import { handlePresenceCommand } from '../presence'

import type { ChatMessage } from '../../types/chat'

function run(action: string): ChatMessage[] {
  return handlePresenceCommand(action)([])
}

describe('Discord presence command (hardcoded client id)', () => {
  test('pins the Savant application client id', () => {
    expect(SAVANT_DISCORD_CLIENT_ID).toBe('1539431002089328710')
  })

  test('rejects the removed `client <id>` subcommand with the usage line', () => {
    const messages = run('client 999999999999999999')
    expect(messages[0]?.content).toContain(
      'Usage: /presence [status|enable|disable]',
    )
    expect(messages[0]?.content).not.toContain('Client ID set to')
  })

  test('reports status without an unconfigured client id state', () => {
    const messages = run('status')
    expect(messages[0]?.content).toContain('Discord Rich Presence')
    expect(messages[0]?.content).not.toContain('unconfigured')
  })

  test('unknown subcommands fall back to the client-less usage line', () => {
    const messages = run('bogus')
    expect(messages[0]?.content).toBe(
      'Usage: /presence [status|enable|disable]',
    )
  })
})
