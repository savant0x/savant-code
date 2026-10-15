import path from 'path'

import { describe, expect, it } from 'bun:test'

import { loadLocalAgents } from '../agents/load-agents'
import { SavantCodeClient } from '../client'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentOutput } from '@savant-code/common/types/session-state'

const DEFAULT_TIMEOUT_MS = 120_000
const EXPECTED_KEYWORD = 'useActionState'
const RESEARCHER_WEB_MAX_AGENT_STEPS = 10
const RUN_LIVE_INTEGRATION = process.env.RUN_SAVANT_CODE_E2E === 'true'

function extractOutputText(output: AgentOutput): string {
  if (output.type === 'error') return output.message
  if (output.type === 'structuredOutput') {
    return JSON.stringify(output.value ?? {})
  }

  const assistantText = output.value.flatMap((message) => {
    if ((message as { role?: unknown }).role !== 'assistant') return []

    const content = (message as { content?: unknown }).content
    if (typeof content === 'string') return [content]
    if (!Array.isArray(content)) return []

    return content.flatMap((part) => {
      if (
        part &&
        typeof part === 'object' &&
        'type' in part &&
        part.type === 'text' &&
        'text' in part
      ) {
        return [String(part.text)]
      }
      return []
    })
  })

  return assistantText.join('\n')
}

describe('researcher-web SDK integration', () => {
  it(
    `runs researcher-web through the SDK and answers with ${EXPECTED_KEYWORD}`,
    async () => {
      if (!RUN_LIVE_INTEGRATION) {
        return
      }

      const agentsPath = path.resolve(
        import.meta.dir,
        '../../../agents/researcher',
      )
      const loadedAgents = await loadLocalAgents({ agentsPath })
      const researcherWeb = loadedAgents['researcher-web']
      expect(researcherWeb).toBeDefined()

      const events: PrintModeEvent[] = []
      const client = new SavantCodeClient({
        cwd: process.cwd(),
      })

      const result = await client.run({
        agent: 'researcher-web',
        agentDefinitions: [researcherWeb],
        maxAgentSteps: RESEARCHER_WEB_MAX_AGENT_STEPS,
        handleEvent: (event) => {
          events.push(event)
        },
        prompt: [
          'Use web search to answer this React docs question.',
          'After searching, fetch exactly three relevant React docs pages with read_url before answering.',
          'In React 19, which hook returns state, a form action, and an isPending value for form actions?',
          'Answer with the exact hook name and one short sentence.',
        ].join(' '),
      })

      const outputText = extractOutputText(result.output)

      expect(result.output.type).not.toBe('error')
      expect(outputText).toContain(EXPECTED_KEYWORD)
      expect(events.some((event) => event.type === 'tool_call')).toBe(true)
      expect(
        events.some(
          (event) =>
            event.type === 'tool_call' && event.toolName === 'web_search',
        ),
      ).toBe(true)
      expect(
        events.some(
          (event) =>
            event.type === 'tool_call' && event.toolName === 'read_url',
        ),
      ).toBe(true)
    },
    DEFAULT_TIMEOUT_MS,
  )
})
