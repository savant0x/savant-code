import fs from 'node:fs'
import path from 'node:path'

import { captureModelRoute } from '@savant-code/common/providers/model-route'
import { getInitialAgentState } from '@savant-code/common/types/session-state'
import { describe, expect, it } from 'bun:test'

import { ContextCompactor } from '../context-compactor'
import {
  extractSubagentContextParams,
  resolveChildContextWindow,
  withParentModel,
} from '../tools/handlers/tool/spawn-agent-utils'

import type { SubagentContextParams } from '../tools/handlers/tool/spawn-agent-utils'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type {
  Message,
  ToolMessage,
} from '@savant-code/common/types/messages/savant-code-message'

// LF-002 (FID-2026-1012-008): a child agent builds its own ContextCompactor
// (run-agent-step/loop-context.ts:239-250) from the loop params it is spawned
// with. The spawn boundary dropped the run's `compression` policy and its
// resolved `contextWindow`, so a child compacted by default — clearing fetched
// research records at 11% of the threshold while the run had micro-compaction
// disabled — and sized its thresholds against a 200,000 fallback instead of
// the model's real window.

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

const template: AgentTemplate = {
  id: 'child',
  displayName: 'Child',
  spawnerPrompt: '',
  model: 'test/model',
  inputSchema: {},
  outputMode: 'last_message',
  includeMessageHistory: false,
  inheritParentSystemPrompt: false,
  mcpServers: {},
  toolNames: [],
  spawnableAgents: [],
  systemPrompt: '',
  instructionsPrompt: '',
  stepPrompt: '',
}

const COMPRESSION = {
  microCompact: false,
  keepRecentTokens: 16_384,
  autoCompactRatio: 0.8,
  forceCompactOffset: 15_000,
  microCompactMaxKeepRecent: 6,
  microCompactFloorTokens: undefined,
  digestHeadChars: 400,
  digestTailChars: 400,
}

/** Minimal spawn context; only the propagated fields are asserted on. */
function spawnParams(compression?: typeof COMPRESSION): SubagentContextParams {
  return {
    clientEnv: {} as never,
    ciEnv: {} as never,
    consumeCreditsWithFallback: (() => {}) as never,
    promptAiSdkStream: (() => {}) as never,
    promptAiSdk: (() => {}) as never,
    promptAiSdkStructured: (() => {}) as never,
    trackEvent: (() => {}) as never,
    logger: noopLogger,
    fetch,
    handleStepsLogChunk: (() => {}) as never,
    requestToolCall: (() => {}) as never,
    requestMcpToolData: (() => {}) as never,
    requestFiles: (() => {}) as never,
    requestOptionalFile: (() => {}) as never,
    sendAction: (() => {}) as never,
    sendSubagentChunk: (() => {}) as never,
    clientSessionId: 'session',
    fileContext: {} as never,
    localAgentTemplates: {},
    repoId: undefined,
    repoUrl: undefined,
    signal: new AbortController().signal,
    userId: undefined,
    compression,
  }
}

function toolResult(toolName: string, toolCallId: string): ToolMessage {
  return {
    role: 'tool',
    toolCallId,
    toolName,
    content: [{ type: 'json', value: { title: `paper ${toolCallId}` } }],
  }
}

/** A scholarly sequence: eight fetched paper records, then synthesis. */
function paperHistory(): Message[] {
  const messages: Message[] = [
    { role: 'user', content: [{ type: 'text', text: 'research this' }] },
  ]
  for (let index = 1; index <= 8; index += 1) {
    messages.push(toolResult('search_papers', `p${index}`))
    messages.push({
      role: 'user',
      content: [{ type: 'text', text: 'keep going' }],
    })
  }
  return messages
}

/** Exactly the option set loop-context builds for a child loop. */
function childCompactor(
  compression: SubagentContextParams['compression'],
  contextWindow: number | undefined,
) {
  return new ContextCompactor({
    logger: noopLogger,
    contextWindow,
    microCompactEnabled: compression?.microCompact,
    autoCompactRatio: compression?.autoCompactRatio,
    microCompactMaxKeepRecent: compression?.microCompactMaxKeepRecent,
    microCompactFloorTokens: compression?.microCompactFloorTokens,
  })
}

describe('subagent compaction propagation (LF-002)', () => {
  it("carries the run's compaction policy into the child context params", () => {
    const child = extractSubagentContextParams(spawnParams(COMPRESSION))

    expect(child.compression).toEqual(COMPRESSION)
  })

  it('keeps early research evidence in a child that inherited the policy', () => {
    const inherited = extractSubagentContextParams(spawnParams(COMPRESSION))
    const retained = childCompactor(
      inherited.compression,
      262_144,
    ).microCompact(paperHistory(), 100_000)

    expect(retained.messagesCleared).toBe(0)

    // Control: the pre-fix child (policy absent → microCompactEnabled defaults
    // true) clears the oldest fetched records. This is what the propagation
    // prevents, so the assertion above is load-bearing.
    const dropped = childCompactor(undefined, 262_144).microCompact(
      paperHistory(),
      100_000,
    )
    expect(dropped.messagesCleared).toBeGreaterThan(0)
  })

  it('propagates the resolved window to a same-model child only', () => {
    const parent: AgentTemplate = {
      ...template,
      id: 'parent',
      model: 'openai/gpt-5',
      modelRoute: captureModelRoute('openrouter'),
    }
    const sameModel = withParentModel({ ...template, id: 'detective' }, parent)
    const pinnedModel = withParentModel(
      {
        ...template,
        id: 'thinker',
        model: 'gemini/thinker',
        inheritParentModel: false,
      },
      parent,
    )

    const inherited = resolveChildContextWindow(sameModel, parent, 262_144)
    expect(inherited).toBe(262_144)
    expect(
      resolveChildContextWindow(pinnedModel, parent, 262_144),
    ).toBeUndefined()

    // The resolved value is what sizes the child's thresholds: the inherited
    // window is strictly larger than the 200,000 fallback a foreign child gets.
    const inheritedThresholds = childCompactor(
      COMPRESSION,
      inherited,
    ).getThresholds()
    const fallbackThresholds = childCompactor(
      COMPRESSION,
      resolveChildContextWindow(pinnedModel, parent, 262_144),
    ).getThresholds()
    expect(inheritedThresholds.reactiveCompact).toBeGreaterThan(
      fallbackThresholds.reactiveCompact,
    )
  })

  it('routes both child spawn paths through the policy and the guarded window', () => {
    const spawnSites = [
      '../tools/handlers/tool/spawn-agents-child-run.ts',
      '../tools/handlers/tool/spawn-agent-inline.ts',
    ]

    for (const site of spawnSites) {
      const source = fs.readFileSync(path.join(import.meta.dir, site), 'utf8')
      // A third spawn path that forgets either half fails here.
      expect(source).toContain('resolveChildContextWindow(')
      expect(source).toMatch(/contextWindow:\s*childContextWindow/)
    }

    const toolkit = fs.readFileSync(
      path.join(import.meta.dir, '../tools/handlers/tool/spawn-agent-utils.ts'),
      'utf8',
    )
    expect(toolkit).toContain('compression: params.compression')
  })

  it('leaves the propagation snapshot and the model-scoped window out of the extracted context', () => {
    const child = extractSubagentContextParams(spawnParams(COMPRESSION))

    expect(child.propagation).toBeUndefined()
    // The window is model-scoped: it travels through resolveChildContextWindow
    // at the spawn sites, never through this extractor.
    expect('contextWindow' in child).toBe(false)
  })
})

// Sanity: the fixture really is over the micro-compaction pressure gate.
describe('paperHistory fixture', () => {
  it('holds eight tool results', () => {
    expect(
      paperHistory().filter((message) => message.role === 'tool'),
    ).toHaveLength(8)
    expect(getInitialAgentState().agentId).toBeDefined()
  })
})
