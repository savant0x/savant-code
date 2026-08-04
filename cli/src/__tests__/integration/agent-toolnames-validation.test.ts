import { toolNames } from '@savant-code/common/tools/constants'
import { describe, expect, it } from 'bun:test'

import { bundledAgents } from '../../agents/bundled-agents.generated'

/**
 * FID-2026-0802-006 AG3: prompt/tool drift guard for the bundled agent roster.
 *
 * Every bundled agent's `toolNames` must reference tools that actually exist in
 * the executor allowlist (`common/src/tools/constants.ts`). A typo or a rename
 * in one place now fails CI instead of surfacing as a mystery runtime denial.
 *
 * Validates the generated bundle directly (what ships in the binary) rather
 * than `loadAgentDefinitions()`, which would also pull in whatever user agents
 * exist in ~/.agents on the developer's machine and make this test
 * environment-sensitive (and would write the roster to the DB as a side effect).
 */
describe('agent toolNames validation (AG3)', () => {
  it('every bundled agent toolNames entry exists in the executor allowlist', () => {
    const agents = Object.values(bundledAgents)
    const knownTools = new Set<string>(toolNames)

    const unknownTools: Array<{ agentId: string; tool: string }> = []

    for (const agent of agents) {
      const names = agent.toolNames ?? []
      if (names.length === 0) continue
      for (const tool of names) {
        if (!knownTools.has(tool)) {
          unknownTools.push({ agentId: agent.id, tool })
        }
      }
    }

    expect(unknownTools).toEqual([])
  })

  it('every bundled agent programmaticToolNames entry exists in the allowlist', () => {
    const agents = Object.values(bundledAgents)
    const knownTools = new Set<string>(toolNames)

    const unknownTools: Array<{ agentId: string; tool: string }> = []

    for (const agent of agents) {
      const names = agent.programmaticToolNames ?? []
      if (names.length === 0) continue
      for (const tool of names) {
        if (!knownTools.has(tool)) {
          unknownTools.push({ agentId: agent.id, tool })
        }
      }
    }

    expect(unknownTools).toEqual([])
  })

  it('thinker-with-files-gemini declares read_files programmatically, not to the model (ECHO-2)', () => {
    const thinker = bundledAgents['thinker-with-files-gemini']

    expect(thinker.toolNames).toEqual([])
    expect(thinker.programmaticToolNames).toContain('read_files')
  })
})
