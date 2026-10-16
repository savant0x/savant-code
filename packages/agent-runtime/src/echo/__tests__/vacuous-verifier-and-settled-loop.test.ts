import { describe, expect, test } from 'bun:test'

import { EchoEnforcement } from '../enforcement'
import { detectVacuousVerification } from '../enforcement/vacuous-verifier'
import { resetForNewTurn } from '../enforcement-state'

describe('verification credit and settled checks', () => {
  test.each([
    '0 pass\n0 fail',
    'No tests found',
    'collected 0 items',
    '[no test files]',
    '0 specs, 0 failures',
  ])('rejects empty runner: %s', (text) => {
    const enforcement = new EchoEnforcement('hybrid', { gateArmed: false })
    enforcement.state.dirtyFiles.add('src/change.ts')
    enforcement.state.failureAttributedFiles.add('src/change.ts')
    const result = enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun test' },
      result: { text },
      commandSucceeded: true,
    })
    expect(result.warnings[0]?.law).toBe(3)
    expect(enforcement.state.verifiedFiles.size).toBe(0)
    expect(enforcement.state.failureAttributedFiles.has('src/change.ts')).toBe(
      true,
    )
  })

  test.each([
    ['bun test', '12 pass\n0 fail'],
    ['bun test', '0 pass\n12 pass\n0 fail'],
    ['tsc --noEmit', ''],
    ['bun run typecheck', ''],
    ['eslint .', ''],
  ])('credits valid %s', (command, text) => {
    const enforcement = new EchoEnforcement('hybrid', { gateArmed: false })
    enforcement.state.dirtyFiles.add('src/change.ts')
    enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command },
      result: { text },
      commandSucceeded: true,
    })
    expect(enforcement.state.verifiedFiles.has('src/change.ts')).toBe(true)
  })

  test('recognizes nested workspace test commands', () => {
    expect(
      detectVacuousVerification('bun run --cwd=common test', 'No tests found')
        .vacuous,
    ).toBe(true)
    expect(
      detectVacuousVerification('bun run lint', 'No tests found').vacuous,
    ).toBe(false)
  })

  test('warns, blocks, and resets on a write, different check, or new turn', () => {
    const enforcement = new EchoEnforcement('hybrid', { gateArmed: false })
    const call = () =>
      enforcement.beforeToolCall({
        toolName: 'code_search',
        input: { pattern: 'consumer' },
        agentId: 'root',
      })
    expect(call().blocked).toBe(false)
    expect(call().blocked).toBe(false)
    expect(enforcement.takeSteeringMessages().join('')).toContain(
      'Bridge crossed',
    )
    expect(call().blocked).toBe(true)
    enforcement.state.writeCount++
    expect(call().blocked).toBe(false)
    expect(call().blocked).toBe(false)
    resetForNewTurn(enforcement.state)
    expect(call().blocked).toBe(false)
    enforcement.beforeToolCall({
      toolName: 'glob',
      input: { pattern: '*.ts' },
      agentId: 'root',
    })
    expect(call().blocked).toBe(false)
  })
})
