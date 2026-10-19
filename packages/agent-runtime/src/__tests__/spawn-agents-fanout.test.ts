import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createTestAgentRuntimeParams } from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { promptSuccess } from '@savant-code/common/util/error'
import { describe, expect, test } from 'bun:test'

// Match production initialization: the loop registers its handler graph
// before a leaf handler is called directly by this integration regression.
import '../run-agent-step'
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { PromptAiSdkStreamFn } from '@savant-code/common/types/contracts/llm'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

function barrier() {
  let resolve = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('FID-2026-1019-002: real child loop fan-out', () => {
  for (const roles of [
    ['verifier', 'verifier', 'verifier'],
    ['scout', 'detective', 'verifier'],
  ]) {
    test(`overlaps ${roles.join('/')} and waits for all reports`, async () => {
      const root = mkdtempSync(path.join(tmpdir(), 'savant-fanout-'))
      const base = createTestAgentRuntimeParams()
      const parent = getInitialAgentState()
      parent.runId = 'parent-run'
      parent.creditsUsed = 10
      parent.provenanceMode = 'off'
      const templates: Record<string, AgentTemplate> = {}
      for (const role of roles) {
        templates[role] = {
          ...base.agentTemplate,
          id: role,
          displayName: role,
          toolNames: [],
          spawnableAgents: [],
          includeMessageHistory: true,
          outputMode: 'last_message',
        }
      }
      const parentTemplate: AgentTemplate = {
        ...base.agentTemplate,
        id: 'fanout-parent',
        spawnableAgents: [...new Set(roles)],
      }
      const releases = roles.map(() => barrier())
      const entered = barrier()
      const finished = roles.map(() => barrier())
      const events: PrintModeEvent[] = []
      const indices = new Map<string, number>()
      let modelCalls = 0
      let settled = false
      let timeout: ReturnType<typeof setTimeout> | undefined
      const inference: PromptAiSdkStreamFn = async function* (request) {
        const index =
          request.agentId === undefined
            ? undefined
            : indices.get(request.agentId)
        if (index === undefined) throw new Error('Missing child spawn identity')
        modelCalls++
        if (modelCalls === roles.length) entered.resolve()
        await releases[index].promise
        await request.onCostCalculated?.(index + 1)
        yield { type: 'text', text: `REPORT-${index}` }
        yield { type: 'text', text: '.' }
        return promptSuccess(`message-${index}`)
      }
      const run = handleSpawnAgents({
        ...base,
        promptAiSdkStream: inference,
        agentState: parent,
        agentTemplate: parentTemplate,
        ancestorRunIds: [],
        clientSessionId: 'fanout-test',
        fileContext: { ...base.fileContext, projectRoot: root, cwd: root },
        fingerprintId: 'fanout-test',
        localAgentTemplates: templates,
        previousToolCallFinished: Promise.resolve(),
        repoId: undefined,
        repoUrl: undefined,
        signal: new AbortController().signal,
        system: 'Fan-out regression',
        toolCall: {
          toolName: 'spawn_agents',
          toolCallId: 'batch',
          input: {
            agents: roles.map((agent_type, index) => ({
              agent_type,
              prompt: `Check ${index}`,
            })),
          },
        },
        userId: undefined,
        userInputId: 'fanout-turn',
        writeToClient: (event) => {
          if (typeof event === 'string') return
          events.push(event)
          if (event.type === 'subagent_start') {
            const origin = event.spawnOrigin
            if (!origin) throw new Error('Child omitted batch origin')
            indices.set(event.agentId, origin.index)
          }
          if (event.type === 'subagent_finish') {
            const origin = event.spawnOrigin
            if (!origin) throw new Error('Child finish omitted batch origin')
            finished[origin.index].resolve()
          }
        },
      }).then((result) => {
        settled = true
        return result
      })
      try {
        await Promise.race([
          entered.promise,
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Children did not overlap')),
              2000,
            )
          }),
        ])
        expect(modelCalls).toBe(3)
        expect(settled).toBe(false)
        releases[2].resolve()
        await finished[2].promise
        expect(settled).toBe(false)
        releases[0].resolve()
        await finished[0].promise
        expect(settled).toBe(false)
        releases[1].resolve()
        const { output } = await run
        expect(settled).toBe(true)
        const result = output[0]
        expect(result).toMatchObject({
          type: 'json',
          value: roles.map((agentType, index) => ({
            agentType,
            value: {
              type: 'lastMessage',
              value: [
                {
                  role: 'assistant',
                  content: [{ type: 'text', text: `REPORT-${index}` }],
                },
                { role: 'assistant', content: [{ type: 'text', text: '.' }] },
              ],
            },
          })),
        })
        expect(parent.creditsUsed).toBe(16)
        expect(
          events
            .filter((event) => event.type === 'subagent_finish')
            .map((event) => event.spawnOrigin?.index),
        ).toEqual([2, 0, 1])
        expect(new Set(indices.keys()).size).toBe(3)
      } finally {
        if (timeout) clearTimeout(timeout)
        for (const release of releases) release.resolve()
        await run
        rmSync(root, { recursive: true, force: true })
      }
    })
  }
})
