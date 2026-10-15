import { describe, expect, test } from 'bun:test'

import savantDefault from '../savant/savant'
import savantStrict from '../savant/savant-strict'

describe('savant-strict (FID-2026-0805-001)', () => {
  test('is the STRICT mode agent definition', () => {
    expect(savantStrict.id).toBe('savant-strict')
    expect(savantStrict.displayName).toBe('Savant the Ceremony Orchestrator')
  })

  test('system prompt carries the full-ceremony contract', () => {
    const system = savantStrict.systemPrompt ?? ''
    expect(system).toContain('STRICT mode')
    expect(system).toContain('Full ECHO Loop for every change')
    expect(system).toContain('no hybrid fallback')
    expect(system).toContain('spawn Forge')
    expect(system).toContain('spawn the Verifier')
    expect(system).toContain('do not verify your own work')
  })

  test('instructions prompt mandates the mandatory workflow', () => {
    const instructions = savantStrict.instructionsPrompt ?? ''
    expect(instructions).toContain('**STRICT mode**')
    expect(instructions).toContain('full ECHO Perfection Loop')
    expect(instructions).toContain('spawn the Recorder')
    expect(instructions).toContain('spawn the Detective')
    expect(instructions).toContain('spawn Forge')
    expect(instructions).toContain('spawn the Verifier')
    expect(instructions).toContain('Do NOT self-verify')
    expect(instructions).toContain('Do NOT write or edit source files directly')
  })

  test('strict mode does not inherit the hybrid default flow', () => {
    const system = savantStrict.systemPrompt ?? ''
    expect(system).not.toContain('Hybrid Mode (Default')
    expect(system).not.toContain('Smart Phase Transitions')
  })

  test('default savant still runs the hybrid flow', () => {
    const system = savantDefault.systemPrompt ?? ''
    expect(system).toContain('Hybrid Mode (Default')
  })
})
