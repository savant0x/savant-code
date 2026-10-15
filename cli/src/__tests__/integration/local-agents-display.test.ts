import { mkdirSync, realpathSync } from 'fs'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  MODEL_NAME,
  cleanupLocalAgentsTest,
  setupLocalAgentsTest,
  writeAgentFile,
} from './local-agents-test-fixtures'
import {
  initializeAgentRegistry,
  loadLocalAgents,
} from '../../utils/local-agent-registry'

describe('Local Agent Integration — display and cache', () => {
  let context: ReturnType<typeof setupLocalAgentsTest>

  beforeEach(() => {
    context = setupLocalAgentsTest()
  })

  afterEach(() => {
    cleanupLocalAgentsTest(context)
  })

  test('loadLocalAgents returns agent info for UI display', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'ui-agent.ts',
      `
        export default {
          id: 'test-ui-agent',
          displayName: 'UI Display Agent',
          model: '${MODEL_NAME}',
          instructions: 'Agent for UI tests'
        }
      `,
    )

    await initializeAgentRegistry()
    const agents = loadLocalAgents()
    const uiAgent = agents.find((a) => a.id === 'test-ui-agent')

    expect(uiAgent).toBeDefined()
    expect(uiAgent!.displayName).toBe('UI Display Agent')
    expect(uiAgent!.id).toBe('test-ui-agent')
    expect(realpathSync(uiAgent!.filePath!)).toBe(
      realpathSync(path.join(context.agentsDir, 'ui-agent.ts')),
    )
  })

  test('loadLocalAgents sorts agents alphabetically by displayName', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'zebra.ts',
      `
        export default {
          id: 'test-zebra-agent',
          displayName: 'Test Zebra Agent',
          model: '${MODEL_NAME}',
          instructions: 'Z comes last'
        }
      `,
    )
    writeAgentFile(
      context.agentsDir,
      'alpha.ts',
      `
        export default {
          id: 'test-alpha-agent',
          displayName: 'Test Alpha Agent',
          model: '${MODEL_NAME}',
          instructions: 'A comes first'
        }
      `,
    )
    writeAgentFile(
      context.agentsDir,
      'middle.ts',
      `
        export default {
          id: 'test-middle-agent',
          displayName: 'Test Middle Agent',
          model: '${MODEL_NAME}',
          instructions: 'M is in the middle'
        }
      `,
    )

    await initializeAgentRegistry()
    const agents = loadLocalAgents()
    const testAgents = agents.filter((a) =>
      ['test-alpha-agent', 'test-middle-agent', 'test-zebra-agent'].includes(
        a.id,
      ),
    )

    expect(testAgents).toHaveLength(3)
    expect(testAgents[0].displayName).toBe('Test Alpha Agent')
    expect(testAgents[1].displayName).toBe('Test Middle Agent')
    expect(testAgents[2].displayName).toBe('Test Zebra Agent')
  })

  test('loadLocalAgents caches results', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'cached.ts',
      `
        export default {
          id: 'test-cached-agent',
          displayName: 'Cached Agent',
          model: '${MODEL_NAME}',
          instructions: 'For cache testing'
        }
      `,
    )

    await initializeAgentRegistry()
    const firstCall = loadLocalAgents()
    const secondCall = loadLocalAgents()

    expect(firstCall).toBe(secondCall)
    expect(firstCall.find((a) => a.id === 'test-cached-agent')).toBeDefined()
  })
})
