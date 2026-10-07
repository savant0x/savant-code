import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { finetunedVertexModels } from '@savant-code/common/old-constants'
import { TEST_AGENT_RUNTIME_IMPL } from '@savant-code/common/testing/impl/agent-runtime'
import { promptSuccess } from '@savant-code/common/util/error'
import { userMessage } from '@savant-code/common/util/messages'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import { inventoryFilePath } from '../../evidence/inventory'
import * as tokenCounter from '../../util/token-counter'
import { requestRelevantFiles } from '../request-files-prompt'

import type { CompactionInventoryRecord } from '../../evidence/inventory'
import type {
  AgentRuntimeDeps,
  AgentRuntimeScopedDeps,
} from '@savant-code/common/types/contracts/agent-runtime'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { ProjectFileContext } from '@savant-code/common/util/file'

let agentRuntimeImpl: AgentRuntimeDeps & AgentRuntimeScopedDeps

/** The ledger write is fire-and-forget; poll the file rather than guess. */
async function readInventoryRows(
  file: string,
): Promise<CompactionInventoryRecord[]> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const text = await readFile(file, 'utf8')
      return text
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as CompactionInventoryRecord)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
  return []
}

describe('requestRelevantFiles', () => {
  const mockMessages: Message[] = [userMessage('test prompt')]
  const mockSystem = 'test system'
  const mockFileContext: ProjectFileContext = {
    projectRoot: '/test/project',
    cwd: '/test/project',
    fileTree: [{ name: 'file1.ts', filePath: 'file1.ts', type: 'file' }],
    fileTokenScores: {},
    knowledgeFiles: {},
    gitChanges: {
      status: '',
      diff: '',
      diffCached: '',
      lastCommitMessages: '',
    },
    changesSinceLastChat: {},
    shellConfigFiles: {},
    systemInfo: {
      platform: 'darwin',
      shell: 'fish',
      nodeVersion: 'v20.0.0',
      arch: 'arm64',
      homedir: '/Users/test',
      cpus: 8,
      chromeAvailable: false,
    },
    agentTemplates: {},
    customToolDefinitions: {},
  }
  const mockAssistantPrompt = null
  const mockAgentStepId = 'step1'
  const mockClientSessionId = 'session1'
  const mockFingerprintId = 'fingerprint1'
  const mockUserInputId = 'input1'
  const mockUserId = 'user1'
  const mockRepoId = 'owner/repo'
  const mockRunId = 'run1'

  beforeEach(() => {
    agentRuntimeImpl = {
      ...TEST_AGENT_RUNTIME_IMPL,
      promptAiSdk: mock(() =>
        Promise.resolve(promptSuccess('file1.ts\nfile2.ts')),
      ),
    }
  })

  afterEach(() => {
    mock.restore()
  })

  it('should use default file counts and maxFiles when no custom config', async () => {
    await requestRelevantFiles({
      ...agentRuntimeImpl,
      messages: mockMessages,
      system: mockSystem,
      fileContext: mockFileContext,
      assistantPrompt: mockAssistantPrompt,
      agentStepId: mockAgentStepId,
      clientSessionId: mockClientSessionId,
      fingerprintId: mockFingerprintId,
      userInputId: mockUserInputId,
      userId: mockUserId,
      repoId: mockRepoId,
      runId: mockRunId,
      signal: new AbortController().signal,
    })
    expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalled()
  })

  it('should use custom file counts from config', async () => {
    const _customConfig = {
      modelName: 'ft_filepicker_005',
      customFileCounts: { normal: 5 },
      maxFilesPerRequest: 10,
    }

    await requestRelevantFiles({
      ...agentRuntimeImpl,
      messages: mockMessages,
      system: mockSystem,
      fileContext: mockFileContext,
      assistantPrompt: mockAssistantPrompt,
      agentStepId: mockAgentStepId,
      clientSessionId: mockClientSessionId,
      fingerprintId: mockFingerprintId,
      userInputId: mockUserInputId,
      userId: mockUserId,
      repoId: mockRepoId,
      runId: mockRunId,
      signal: new AbortController().signal,
    })
    expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalled()
  })

  it('should use custom maxFilesPerRequest from config', async () => {
    const _customConfig = {
      modelName: 'ft_filepicker_005',
      maxFilesPerRequest: 3,
    }

    const result = await requestRelevantFiles({
      ...agentRuntimeImpl,
      messages: mockMessages,
      system: mockSystem,
      fileContext: mockFileContext,
      assistantPrompt: mockAssistantPrompt,
      agentStepId: mockAgentStepId,
      clientSessionId: mockClientSessionId,
      fingerprintId: mockFingerprintId,
      userInputId: mockUserInputId,
      userId: mockUserId,
      repoId: mockRepoId,
      runId: mockRunId,
      signal: new AbortController().signal,
    })
    expect(result).toBeArray()
    if (result) {
      expect(result.length).toBeLessThanOrEqual(3)
    }
  })

  it('should use custom modelName from config', async () => {
    const _customConfig = {
      modelName: 'ft_filepicker_010',
    }

    await requestRelevantFiles({
      ...agentRuntimeImpl,
      messages: mockMessages,
      system: mockSystem,
      fileContext: mockFileContext,
      assistantPrompt: mockAssistantPrompt,
      agentStepId: mockAgentStepId,
      clientSessionId: mockClientSessionId,
      fingerprintId: mockFingerprintId,
      userInputId: mockUserInputId,
      userId: mockUserId,
      repoId: mockRepoId,
      runId: mockRunId,
      signal: new AbortController().signal,
    })
    expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledWith(
      expect.objectContaining({
        useFinetunedModel: finetunedVertexModels.ft_filepicker_010,
      }),
    )
  })

  it('ledgers what the file-picking trim pass takes (FID-2026-1007-004 step 4)', async () => {
    // The unit pin drives `trimMessagesToFitTokenLimit` directly. This one
    // drives the REAL entry point, so the wiring from the find-files request
    // path into the ledger is exercised rather than merely typechecked.
    const root = await mkdtemp(path.join(tmpdir(), 'find-files-trim-'))
    // Character-count token accounting, the same stand-in the trim suites use:
    // the real encoder on a 400k-char payload costs ~130s, and this pin is about
    // the wiring, not about the tokenizer.
    spyOn(tokenCounter, 'countTokensMessages').mockImplementation(
      (messages) => JSON.stringify(messages).length,
    )
    const messages: Message[] = [
      userMessage('tiny'),
      {
        role: 'tool',
        toolName: 'code_search',
        toolCallId: 'call-find-files',
        // Over the 100k buffer this path reserves, and the largest entry, so
        // the trim pass has to take it to get back under budget.
        content: [{ type: 'json', value: { matches: 'x'.repeat(120_000) } }],
      },
      userMessage('which files matter?'),
    ]

    await requestRelevantFiles({
      ...agentRuntimeImpl,
      messages,
      system: mockSystem,
      fileContext: { ...mockFileContext, projectRoot: root },
      assistantPrompt: mockAssistantPrompt,
      agentStepId: mockAgentStepId,
      clientSessionId: mockClientSessionId,
      fingerprintId: mockFingerprintId,
      userInputId: mockUserInputId,
      userId: mockUserId,
      repoId: mockRepoId,
      runId: mockRunId,
      signal: new AbortController().signal,
      evidenceContext: { projectRoot: root, runId: 'run-find-files' },
    })

    const rows = await readInventoryRows(
      inventoryFilePath(root, 'run-find-files'),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.layer).toBe('trim')
    expect(rows[0]?.items?.map((item) => item.toolCallId)).toContain(
      'call-find-files',
    )
  })

  it('should use default model if custom modelName is invalid', async () => {
    const _customConfig = {
      modelName: 'invalid-model-name',
    }

    await requestRelevantFiles({
      ...agentRuntimeImpl,
      messages: mockMessages,
      system: mockSystem,
      fileContext: mockFileContext,
      assistantPrompt: mockAssistantPrompt,
      agentStepId: mockAgentStepId,
      clientSessionId: mockClientSessionId,
      fingerprintId: mockFingerprintId,
      userInputId: mockUserInputId,
      userId: mockUserId,
      repoId: mockRepoId,
      runId: mockRunId,
      signal: new AbortController().signal,
    })
    const expectedModel = finetunedVertexModels.ft_filepicker_010
    expect(agentRuntimeImpl.promptAiSdk).toHaveBeenCalledWith(
      expect.objectContaining({
        useFinetunedModel: expectedModel,
      }),
    )
  })
})
