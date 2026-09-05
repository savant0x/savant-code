// FID-2026-0819-005 Loop 226: extractPrunerSummaryFromHistory suite (moved
// verbatim from spawn-agent-inline-compaction-summary.test.ts) plus the
// non-pruner-spawns test (Loop 226 second cut, harness segments copied
// verbatim). Parent over the 300-line ceiling. See the parent for the
// spawn-boundary suites' contract (FID-2026-0828-001).

import { TEST_USER_ID } from '@savant-code/common/old-constants'
import { emptyMcpServers } from '@savant-code/common/testing/fixtures/agent-runtime'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { userMessage } from '@savant-code/common/util/messages'
import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from 'bun:test'

import { mockFileContext } from './test-utils'
import * as runAgentStep from '../run-agent-step'
// Import order matters: entering the handlers chain via `list` (as the
// sibling spawn-agent test files do through their earlier imports) avoids a
// TDZ circular-import error in `handlers/list.ts` that occurs when this
// module is entered via `spawn-agent-inline` directly.
import '../tools/handlers/list'
import { handleSpawnAgentInline } from '../tools/handlers/tool/spawn-agent-inline'
import { extractPrunerSummaryFromHistory } from '../tools/handlers/tool/spawn-agent-inline-summary'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

describe('handleSpawnAgentInline compaction_summary emission (FID-2026-0828-001)', () => {
  let mockWriteToClient: ReturnType<typeof mock>
  let baseParams: ParamsExcluding<
    typeof handleSpawnAgentInline,
    'agentState' | 'agentTemplate' | 'localAgentTemplates' | 'toolCall'
  >

  const createMockAgent = (
    id: string,
    spawnableAgents: string[] = [],
  ): AgentTemplate => ({
    id,
    displayName: `Mock ${id}`,
    outputMode: 'last_message' as const,
    inputSchema: {
      prompt: {
        safeParse: () => ({ success: true }),
      } as unknown as AgentTemplate['inputSchema']['prompt'],
    },
    spawnerPrompt: '',
    model: '',
    includeMessageHistory: true,
    inheritParentSystemPrompt: false,
    mcpServers: emptyMcpServers,
    toolNames: [],
    spawnableAgents,
    systemPrompt: '',
    instructionsPrompt: '',
    stepPrompt: '',
  })

  // Realistic programmatic-pruner output: the summary embedded in a
  // conversation_summary memory message (summary-assembly.ts buildFullSummary),
  // NOT streamed as text chunks.
  const compactedHistory = () => [
    userMessage(
      '<conversation_summary>\n' +
        '<historical_memory>\n' +
        '<compaction-summary>\n' +
        '<structured_state>\n' +
        'Goal: summarize what changed and why.\n' +
        '</structured_state>\n' +
        '\n' +
        '---\n' +
        '\n' +
        '## Standing facts & constraints\n' +
        '\n' +
        '[USER] The user asked to list files, then enabled the compaction feature flag.\n' +
        '[ASSISTANT] The change enabled the compaction feature flag; tests passed across the twelve workspaces.\n' +
        '</compaction-summary>\n' +
        '</historical_memory>\n' +
        '</conversation_summary>\n' +
        '\n' +
        'The above is a historical memory artifact.',
    ),
  ]

  beforeEach(() => {
    mockWriteToClient = mock(() => {})
    baseParams = {
      ...TEST_AGENT_RUNTIME_IMPL,
      ancestorRunIds: [],
      clientSessionId: 'test-session',
      fileContext: mockFileContext,
      fingerprintId: 'test-fingerprint',
      previousToolCallFinished: Promise.resolve(),
      repoId: undefined,
      repoUrl: undefined,
      sendSubagentChunk: mock(() => {}),
      signal: new AbortController().signal,
      system: 'Test system prompt',
      userId: TEST_USER_ID,
      userInputId: 'test-input',
      writeToClient: mockWriteToClient as unknown as (
        chunk: string | PrintModeEvent,
      ) => void,
      tools: {},
    }

    // Simulate the real programmatic pruner: it does NOT stream summary text;
    // it only replaces the history with its conversation_summary memory
    // message via set_messages.
    spyOn(runAgentStep, 'loopAgentSteps').mockImplementation(
      async (options) => {
        return {
          agentState: {
            ...options.agentState,
            messageHistory: compactedHistory(),
          },
          output: {
            type: 'lastMessage',
            value: compactedHistory(),
          },
        }
      },
    )
  })

  afterEach(() => {
    mock.restore()
  })

  const compactionSummaryEvents = () =>
    mockWriteToClient.mock.calls
      .map((call) => call[0])
      .filter(
        (
          chunk,
        ): chunk is Extract<PrintModeEvent, { type: 'compaction_summary' }> =>
          typeof chunk === 'object' &&
          chunk !== null &&
          (chunk as { type?: string }).type === 'compaction_summary',
      )

  it('does NOT emit for non-pruner inline spawns', async () => {
    const parentAgent = createMockAgent('savant', ['thinker'])
    const thinkerAgent = createMockAgent('thinker')
    const sessionState = getInitialSessionState(mockFileContext)
    await handleSpawnAgentInline({
      ...baseParams,
      agentState: sessionState.mainAgentState,
      agentTemplate: parentAgent,
      localAgentTemplates: { thinker: thinkerAgent },
      toolCall: {
        toolName: 'spawn_agent_inline' as const,
        toolCallId: 'test-thinker-call',
        input: { agent_type: 'thinker', prompt: 'think' },
      },
    })

    expect(compactionSummaryEvents().length).toBe(0)
  })
})

/** The single user text part used by the helper fixtures below. */
const textUserMessage = (text: string): Message => ({
  role: 'user',
  content: [{ type: 'text', text }],
})

/**
 * FID-2026-0828-001: the summary-recovery helper contract — the tag-walking
 * order that mirrors the pruner's own summary-assembly.ts memory message.
 */
describe('extractPrunerSummaryFromHistory', () => {
  it('recovers the <compaction-summary> inner block from the memory message', () => {
    const history: Message[] = [
      textUserMessage(
        '<conversation_summary>\n' +
          '## Memory of this conversation\n\n' +
          '<historical_memory>\n' +
          '<compaction-summary>\n' +
          '# Standing facts\n\n' +
          '[USER] asked to list files.\n' +
          '</compaction-summary>\n' +
          '</historical_memory>\n' +
          '</conversation_summary>\n' +
          '\n' +
          'Disclaimer text that must not leak into the excerpt.',
      ),
    ]

    const summary = extractPrunerSummaryFromHistory(history)
    expect(summary).toContain('# Standing facts')
    expect(summary).toContain('asked to list files')
    expect(summary).not.toContain('<compaction-summary>')
    expect(summary).not.toContain('<historical_memory>')
    expect(summary).not.toContain('<conversation_summary>')
    expect(summary).not.toContain('Disclaimer')
  })

  it('returns the empty string when no conversation_summary message exists', () => {
    const history: unknown[] = [
      textUserMessage('plain user message'),
      // assistant text messages carry the role-checked guard too
      { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
      textUserMessage('another plain user message'),
    ]
    expect(extractPrunerSummaryFromHistory(history)).toBe('')
  })

  it('skips non-user messages and returns the empty string', () => {
    const history: unknown[] = [
      { role: 'assistant', content: [{ type: 'text', text: 'x' }] },
      { role: 'tool', content: [{ type: 'text', text: 'y' }] },
    ]
    expect(extractPrunerSummaryFromHistory(history)).toBe('')
  })

  it('tolerates a user message with string content', () => {
    const history: unknown[] = [
      {
        role: 'user',
        content:
          '<conversation_summary>\n<historical_memory>\n<compaction-summary>\nSTRING-ONLY SUMMARY\n</compaction-summary>\n</historical_memory>\n</conversation_summary>',
      },
    ]
    expect(extractPrunerSummaryFromHistory(history)).toBe('STRING-ONLY SUMMARY')
  })
})
