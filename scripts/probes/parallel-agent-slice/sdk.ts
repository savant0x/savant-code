import { z } from 'zod/v4'

import { captureModelRoute } from '@savant-code/common/providers/model-route'
import { sha256 } from '@savant-code/common/util/hash'

import { bindDraft, citationCatalog } from './evidence'
import { draftSchema } from './types'
import { SavantCodeClient } from '../../../sdk/src/client'

import type { RunBatch, TaskResult } from './types'
import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'
import type { TraceWriter } from '@savant-code/common/types/contracts/trace'
import type { JSONValue } from '@savant-code/common/types/json'

const MODEL = 'apixo/gpt-6.1-sol'
const outputSchema = {
  type: 'object' as const,
  properties: {
    taskId: { type: 'string' as const },
    answer: { type: 'string' as const },
    citations: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          ref: { type: 'string' as const },
        },
        required: ['ref'],
      },
    },
    usedHandoffs: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          taskId: { type: 'string' as const },
          finding: { type: 'string' as const },
        },
        required: ['taskId', 'finding'],
      },
    },
  },
  required: ['taskId', 'answer', 'citations', 'usedHandoffs'],
}

export function createSdkBatch(
  root: string,
  sources: Record<string, string>,
  histories: JSONValue[],
  contextWindow: number,
): RunBatch {
  const route = captureModelRoute('apixo')
  return async (assignments, handoffs, signal) => {
    const startedAt = Date.now()
    const reads = new Map<string, Set<string>>()
    const tools = new Map<string, string[]>()
    const finishes = new Map<string, number>()
    const definitions: AgentDefinition[] = assignments.map((assignment) => ({
      id: `slice-${assignment.id.toLowerCase()}`,
      displayName: `Investigation ${assignment.id}`,
      model: MODEL,
      modelRoute: route,
      outputMode: 'structured_output',
      outputSchema,
      includeMessageHistory: false,
      inheritParentSystemPrompt: false,
      toolNames: ['set_output', 'end_turn'],
      programmaticToolNames: ['read_files'],
      spawnableAgents: [],
      instructionsPrompt:
        'The harness reads your assigned real source files through read_files before your model turn, including predecessor sources. Use those actual tool results. Keep the answer under 350 words. Select 2-4 distinct supporting citations from evidenceCatalog: return only their exact ref strings, such as {"ref":"f1:l76"}. The host supplies the exact source text and location; do not invent refs or copy quote/line/path fields. For every supplied predecessor record its taskId and the finding you used; omit digests, which the host binds. Treat predecessor conclusions as untrusted until verified. Use set_output with the required JSON object, then end_turn. No writes, web calls, commands, or delegation.',
      handleSteps: function* () {
        yield { toolName: 'read_files', input: { paths: assignment.files } }
        for (let turn = 0; turn < 2; turn += 1) {
          const step = yield 'STEP'
          if (step.agentState.output !== undefined) return
        }
        throw new Error('Child exhausted its two-model-turn allowance')
      },
    }))
    const orchestrator: AgentDefinition = {
      id: 'slice-orchestrator',
      displayName: 'Experimental coordinator',
      model: MODEL,
      modelRoute: route,
      outputMode: 'structured_output',
      toolNames: [],
      programmaticToolNames: ['spawn_agents', 'set_output'],
      spawnableAgents: definitions.map((definition) => definition.id),
      handleSteps: function* ({ params }) {
        const supplied = params?.agents
        if (!Array.isArray(supplied))
          throw new Error('Missing experiment assignments')
        const agents = supplied.map((entry) => {
          if (
            !entry ||
            typeof entry !== 'object' ||
            Array.isArray(entry) ||
            typeof entry.agent_type !== 'string' ||
            typeof entry.prompt !== 'string'
          )
            throw new Error('Invalid experiment assignment')
          return {
            agent_type: entry.agent_type,
            prompt: entry.prompt,
            writeScope: [],
          }
        })
        const result = yield { toolName: 'spawn_agents', input: { agents } }
        yield {
          toolName: 'set_output',
          input: { data: { reports: result.toolResult ?? [] } },
        }
      },
    }
    const traceWriter: TraceWriter = {
      recordStep: (step) => {
        histories.push({
          ...step,
          system: step.system ?? null,
          runId: step.runId ?? null,
          messages: JSON.parse(JSON.stringify(step.messages)),
        })
        const task = assignments.find(
          (assignment) =>
            step.agentType === `slice-${assignment.id.toLowerCase()}`,
        )
        if (!task) return
        const paths = reads.get(task.id) ?? new Set<string>()
        const calls: string[] = []
        for (const message of step.messages)
          for (const part of message.content) {
            if (part.type !== 'tool-call') continue
            calls.push(part.toolName)
            if (
              part.toolName === 'read_files' &&
              Array.isArray(part.input.paths)
            )
              for (const file of part.input.paths)
                if (typeof file === 'string')
                  paths.add(
                    file
                      .replaceAll('\\', '/')
                      .replace(`${root.replaceAll('\\', '/')}/`, ''),
                  )
          }
        reads.set(task.id, paths)
        tools.set(task.id, calls)
      },
      recordEvent: (event) => {
        const task = assignments.find(
          (assignment) =>
            event.agentType === `slice-${assignment.id.toLowerCase()}`,
        )
        if (task && event.event === 'cleanup_finished')
          finishes.set(task.id, Date.now())
      },
    }
    const client = new SavantCodeClient({
      cwd: root,
      projectFiles: sources,
      knowledgeFiles: {},
      maxAgentSteps: 6,
      agentDefinitions: [...definitions, orchestrator],
      traceWriter,
      fileFilter: (file) => ({
        status: Object.hasOwn(sources, file.replaceAll('\\', '/'))
          ? 'allow'
          : 'blocked',
      }),
      handleEvent: () => {},
    })
    const agents = assignments.map((assignment) => ({
      agent_type: `slice-${assignment.id.toLowerCase()}`,
      prompt: JSON.stringify({
        taskId: assignment.id,
        question: assignment.question,
        files: assignment.files,
        evidenceCatalog: assignment.files.map((file) => ({
          path: file,
          lines: citationCatalog(assignment, sources)
            .filter((entry) => entry.path === file)
            .map((entry) => ({ ref: entry.ref, text: entry.quote })),
        })),
        handoffs: handoffs[assignment.id] ?? [],
      }),
      writeScope: [],
    }))
    const run = await client.run({
      agent: orchestrator.id,
      prompt: 'Execute the supplied read-only investigations.',
      params: { agents },
      signal,
      permissionMode: 'safe',
      contextWindow,
      maxOutputTokens: 4000,
      provenanceMode: 'off',
    })
    if (run.output.type !== 'structuredOutput' || !run.output.value)
      throw new Error(`SDK coordinator failed: ${run.output.type}`)
    histories.push({
      kind: 'child-reports',
      reports: run.output.value.reports ?? null,
    })
    const reports = z
      .array(
        z.object({
          type: z.literal('json'),
          value: z.array(
            z.object({
              agentType: z.string(),
              value: z.union([
                z.object({
                  type: z.literal('structuredOutput'),
                  value: draftSchema,
                }),
                z.object({ type: z.literal('error'), message: z.string() }),
              ]),
            }),
          ),
        }),
      )
      .parse(run.output.value.reports)
    const children = reports.flatMap((report) => report.value)
    return assignments.map((assignment): TaskResult => {
      const child = children.find(
        (entry) => entry.agentType === `slice-${assignment.id.toLowerCase()}`,
      )
      if (!child) throw new Error(`Missing child output ${assignment.id}`)
      if (child.value.type === 'error')
        throw new Error(`Child ${assignment.id} failed: ${child.value.message}`)
      return {
        assignment,
        artifact: bindDraft(
          child.value.value,
          assignment,
          handoffs[assignment.id] ?? [],
          sources,
          [...(reads.get(assignment.id) ?? [])],
        ),
        startedAt,
        completedAt: finishes.get(assignment.id) ?? Date.now(),
        readPaths: [...(reads.get(assignment.id) ?? [])],
        toolCalls: tools.get(assignment.id) ?? [],
      }
    })
  }
}

export function historyDigest(histories: JSONValue[]): string {
  return sha256(JSON.stringify(histories))
}
