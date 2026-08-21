import { mkdirSync } from 'fs'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  MODEL_NAME,
  cleanupLocalAgentsTest,
  setupLocalAgentsTest,
  writeAgentFile,
} from './local-agents-test-fixtures'
import {
  announceLoadedAgents,
  getLoadedAgentsData,
  getLoadedAgentsMessage,
  initializeAgentRegistry,
} from '../../utils/local-agent-registry'

describe('Local Agent Integration — UI data', () => {
  let context: ReturnType<typeof setupLocalAgentsTest>

  beforeEach(() => {
    context = setupLocalAgentsTest()
  })

  afterEach(() => {
    cleanupLocalAgentsTest(context)
  })

  test('getLoadedAgentsData returns null when no user agents directory', async () => {
    await initializeAgentRegistry()
    const data = getLoadedAgentsData()

    if (data) {
      expect(data.agents.find((a) => a.id.startsWith('test-'))).toBeUndefined()
    }
  })

  test('getLoadedAgentsData returns agent info when agents exist', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'data-test.ts',
      `
        export default {
          id: 'test-data-agent',
          displayName: 'Data Test Agent',
          model: '${MODEL_NAME}',
          instructions: 'For getLoadedAgentsData test'
        }
      `,
    )

    await initializeAgentRegistry()
    const data = getLoadedAgentsData()

    expect(data).not.toBeNull()
    expect(data!.agentsDir).toBe(context.agentsDir)
    expect(data!.agents.length).toBeGreaterThan(0)
    expect(data!.agents.some((a) => a.id === 'test-data-agent')).toBe(true)
  })

  test('getLoadedAgentsMessage returns null when no user agents', async () => {
    await initializeAgentRegistry()
    const message = getLoadedAgentsMessage()

    if (message) {
      expect(message).not.toContain('test-')
    }
  })

  test('getLoadedAgentsMessage returns formatted message with agents', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'message-test.ts',
      `
        export default {
          id: 'test-message-agent',
          displayName: 'Message Test Agent',
          model: '${MODEL_NAME}',
          instructions: 'For getLoadedAgentsMessage test'
        }
      `,
    )

    await initializeAgentRegistry()
    const message = getLoadedAgentsMessage()

    expect(message).not.toBeNull()
    expect(message).toContain('Loaded')
    expect(message).toContain('local agent')
    expect(message).toContain(context.agentsDir)
    expect(message).toContain('Message Test Agent')
  })

  test('announceLoadedAgents logs agent information', async () => {
    mkdirSync(context.agentsDir, { recursive: true })
    writeAgentFile(
      context.agentsDir,
      'announce-test.ts',
      `
        export default {
          id: 'test-announce-agent',
          displayName: 'Announce Test Agent',
          model: '${MODEL_NAME}',
          instructions: 'For announceLoadedAgents test'
        }
      `,
    )

    await initializeAgentRegistry()
    announceLoadedAgents()

    const data = getLoadedAgentsData()
    expect(data).not.toBeNull()
    expect(data!.agents.some((a) => a.id === 'test-announce-agent')).toBe(true)
    expect(
      data!.agents.some((a) => a.displayName === 'Announce Test Agent'),
    ).toBe(true)
  })
})
