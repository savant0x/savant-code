import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  createTestAgentRuntimeParams,
  testFileContext,
} from '@savant-code/common/testing/fixtures/agent-runtime'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import {
  assistantMessage,
  jsonToolResult,
  userMessage,
} from '@savant-code/common/util/messages'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import * as agentRegistry from '../templates/agent-registry'
import * as spawnAgentUtils from '../tools/handlers/tool/spawn-agent-utils'
import { handleSpawnAgents } from '../tools/handlers/tool/spawn-agents'
import {
  snapshotDigest,
  sourceContentDigest,
} from '../tools/handlers/tool/spawn-plan'
import { artifactDigest } from '../tools/handlers/tool/spawn-plan-acceptance'

import type {
  SpawnPlanAgentInput,
  SpawnPlanInput,
} from '../tools/handlers/tool/spawn-plan'
import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { AgentState } from '@savant-code/common/types/session-state'

const SOURCE = 'src/a.ts'
const ORIGINAL = 'export const a = 1\n'

type Report = {
  agentType: string
  agentName?: string
  value: { errorMessage?: string } & Record<string, JSONValue>
  planStep?: { id: string; status: string; digest?: string }
}

function templateFor(id: string): AgentTemplate {
  return {
    id,
    displayName: id,
    model: 'test/model',
    inputSchema: {},
    outputMode: 'last_message',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: {},
    toolNames: ['read_files'],
    spawnableAgents: ['scout', 'detective'],
    systemPrompt: '',
    instructionsPrompt: '',
    stepPrompt: '',
  }
}

function readMessage(sourcePath: string, content: string): Message {
  return {
    role: 'tool',
    toolCallId: `read-${sourcePath}`,
    toolName: 'read_files',
    content: jsonToolResult([{ path: sourcePath, content }]),
  }
}

function reports(output: SavantCodeToolOutput<'spawn_agents'>): Report[] {
  const part = output[0]
  if (!part || part.type !== 'json' || !Array.isArray(part.value)) {
    throw new Error('expected a json tool result')
  }
  return part.value as Report[]
}

function planFor(): SpawnPlanInput {
  const sources = [{ path: SOURCE, sha256: sourceContentDigest(ORIGINAL) }]
  return {
    objective: 'Answer the coupled question',
    cancellation_id: 'turn-1',
    snapshot_sha256: snapshotDigest(sources),
    max_output_tokens: 4000,
    sources,
  }
}

function steps(params?: {
  reviewSources?: string[]
  draftRole?: string
}): SpawnPlanAgentInput[] {
  return [
    {
      agent_type: params?.draftRole ?? 'scout',
      id: 'draft',
      prompt: 'Investigate',
      sources: [SOURCE],
      depends_on: [],
    },
    {
      agent_type: 'detective',
      id: 'review',
      prompt: 'Review',
      sources: params?.reviewSources ?? [SOURCE],
      depends_on: ['draft'],
    },
  ]
}

type StepBehavior = { history: Message[]; credits: number; text: string }

let projectRoot: string
let parentState: AgentState
let responder: (input: { agentType: string; prompt: string }) => StepBehavior
let executeCalls: { agentType: string; prompt: string }[]
let outputs: Map<string, JSONValue>

function makeParams(params: {
  plan?: SpawnPlanInput
  agents: SpawnPlanAgentInput[]
  signal?: AbortSignal
}) {
  const base = createTestAgentRuntimeParams()
  const parentTemplate = templateFor('base')
  return {
    ...base,
    agentTemplate: parentTemplate,
    agentState: parentState,
    ancestorRunIds: [],
    clientSessionId: 'test-session',
    fileContext: { ...testFileContext, projectRoot },
    fingerprintId: 'test-fingerprint',
    localAgentTemplates: {},
    previousToolCallFinished: Promise.resolve(),
    repoId: undefined,
    repoUrl: undefined,
    signal: params.signal ?? new AbortController().signal,
    system: 'test system',
    toolCall: {
      toolName: 'spawn_agents' as const,
      toolCallId: 'call-1',
      input: {
        agents: params.agents,
        ...(params.plan === undefined ? {} : { plan: params.plan }),
      },
    },
    userId: 'test-user',
    userInputId: 'turn-1',
    writeToClient: () => {},
  }
}

beforeEach(() => {
  projectRoot = mkdtempSync(path.join(tmpdir(), 'spawn-plan-dispatch-'))
  mkdirSync(path.join(projectRoot, 'src'), { recursive: true })
  writeFileSync(path.join(projectRoot, SOURCE), ORIGINAL)
  parentState = getInitialAgentState()
  executeCalls = []
  outputs = new Map()

  spyOn(agentRegistry, 'getAgentTemplate').mockImplementation(
    async ({ agentId }) => templateFor(agentId),
  )

  spyOn(spawnAgentUtils, 'executeSubagent').mockImplementation(async (args) => {
    const agentType = String(args.agentTemplate.id)
    const prompt = args.prompt ?? ''
    executeCalls.push({ agentType, prompt })
    const behavior = responder({ agentType, prompt })
    const output = {
      type: 'lastMessage' as const,
      value: [assistantMessage(behavior.text)],
    }
    outputs.set(agentType, output)
    return {
      agentState: {
        ...args.agentState,
        creditsUsed: behavior.credits,
        messageHistory: behavior.history,
      },
      output,
    }
  })
})

afterEach(() => {
  mock.restore()
  rmSync(projectRoot, { recursive: true, force: true })
})

describe('research plan dispatch (FID-2026-1017-004)', () => {
  it('runs the dependent stage after its predecessor and delivers the exact artifact', async () => {
    responder = ({ agentType, prompt }) =>
      agentType === 'scout'
        ? {
            history: [readMessage(SOURCE, ORIGINAL)],
            credits: 7,
            text: 'draft answer',
          }
        : {
            history: [userMessage(prompt), readMessage(SOURCE, ORIGINAL)],
            credits: 3,
            text: 'review answer',
          }

    const result = await handleSpawnAgents(
      makeParams({ plan: planFor(), agents: steps() }),
    )

    expect(executeCalls.map((call) => call.agentType)).toEqual([
      'scout',
      'detective',
    ])
    const draftOutput = outputs.get('scout')
    expect(draftOutput).toBeDefined()
    const digest = artifactDigest(draftOutput ?? null)
    expect(executeCalls[1]?.prompt).toContain(
      `<research_plan_artifact step="draft" digest="${digest}">`,
    )

    const values = reports(result.output)
    expect(values.map((entry) => entry.planStep?.status)).toEqual([
      'accepted',
      'accepted',
    ])
    expect(values[1]?.planStep?.digest).toBe(
      artifactDigest(outputs.get('detective') ?? null),
    )
    expect(parentState.creditsUsed).toBe(10)
  })

  it('blocks the review when the draft never read its pinned source', async () => {
    responder = ({ agentType }) =>
      agentType === 'scout'
        ? { history: [], credits: 7, text: 'unverified draft' }
        : { history: [], credits: 3, text: 'review' }

    const result = await handleSpawnAgents(
      makeParams({ plan: planFor(), agents: steps() }),
    )

    expect(executeCalls.map((call) => call.agentType)).toEqual(['scout'])
    const values = reports(result.output)
    expect(values[0]?.value.errorMessage).toContain(
      'Missing verified source read: src/a.ts',
    )
    expect(values[1]?.value.errorMessage).toContain(
      'Predecessor step "draft" was rejected',
    )
    expect(parentState.creditsUsed).toBe(7)
  })

  it('invalidates the plan when a source changes after the first stage', async () => {
    responder = ({ agentType }) => {
      if (agentType === 'scout') {
        writeFileSync(path.join(projectRoot, SOURCE), 'changed\n')
      }
      return {
        history: [readMessage(SOURCE, ORIGINAL)],
        credits: 4,
        text: 'draft',
      }
    }

    const result = await handleSpawnAgents(
      makeParams({ plan: planFor(), agents: steps() }),
    )

    expect(executeCalls.map((call) => call.agentType)).toEqual(['scout'])
    const values = reports(result.output)
    expect(values[0]?.planStep?.status).toBe('accepted')
    expect(values[1]?.planStep?.status).toBe('rejected')
    expect(values[1]?.value.errorMessage).toContain(
      'Source changed during the plan',
    )
  })

  it('stops dispatch on cancellation and retains the spend', async () => {
    const controller = new AbortController()
    responder = ({ agentType }) => {
      if (agentType === 'scout') controller.abort()
      return {
        history: [readMessage(SOURCE, ORIGINAL)],
        credits: 5,
        text: 'draft',
      }
    }

    const result = await handleSpawnAgents(
      makeParams({
        plan: planFor(),
        agents: steps(),
        signal: controller.signal,
      }),
    )

    expect(executeCalls.map((call) => call.agentType)).toEqual(['scout'])
    const values = reports(result.output)
    expect(values[0]?.planStep?.status).toBe('cancelled')
    expect(values[1]?.value.errorMessage).toContain('was cancelled')
    expect(parentState.creditsUsed).toBe(5)
  })

  it('refuses a non-research role before any child starts', async () => {
    responder = () => ({ history: [], credits: 0, text: 'never' })

    await expect(
      handleSpawnAgents(
        makeParams({
          plan: planFor(),
          agents: steps({ draftRole: 'forge' }),
        }),
      ),
    ).rejects.toThrow('not a read-only research role')

    expect(executeCalls).toHaveLength(0)
  })

  it('refuses a write request before any child starts', async () => {
    responder = () => ({ history: [], credits: 0, text: 'never' })
    const agents = steps()
    agents[0] = { ...agents[0], writeScope: ['src/**'] }

    await expect(
      handleSpawnAgents(makeParams({ plan: planFor(), agents })),
    ).rejects.toThrow('plan steps are read-only')

    expect(executeCalls).toHaveLength(0)
  })
})
