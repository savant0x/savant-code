import { describe, expect, test } from 'bun:test'

import definition from '../scribe-proposer/scribe-proposer'

describe('FID-2026-0912-004: scribe-proposer agent definition (handoff isolation)', () => {
  test('is cold-spawned: includeMessageHistory is false', () => {
    expect(definition.includeMessageHistory).toBe(false)
  })

  test('is a Scribe-role variant: S2-B toolset (skill_manage present, no spawn)', () => {
    const tools = definition.toolNames ?? []
    expect(tools).toContain('skill_manage')
    expect(tools).not.toContain('spawn_agents')
    expect(tools).not.toContain('str_replace')
    expect(tools).not.toContain('bash')
  })

  test('prompt bakes the atomic-proposal contract', () => {
    const prompt = definition.instructionsPrompt ?? ''
    expect(prompt).toContain('at most ONE')
    expect(prompt.toLowerCase()).not.toContain('conversation history')
  })

  test('savant roster can spawn the proposer', () => {
    const savant = require('../savant/savant').default as {
      spawnableAgents?: string[]
    }
    expect(savant.spawnableAgents).toContain('scribe-proposer')
  })
})
