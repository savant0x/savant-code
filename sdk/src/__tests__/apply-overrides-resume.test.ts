import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { describe, expect, test } from 'bun:test'

import { applyOverridesToSessionState } from '../run-state'

import type { StepHandler } from '@savant-code/common/types/agent-template'
import type { SessionState } from '@savant-code/common/types/session-state'
import type { ProcessedAgentTemplate } from '@savant-code/common/util/file'

// Test double: never executed — the test only asserts reference identity is
// preserved through the resume clone. (Throwing satisfies StepGenerator's
// return type without needing a real generator.)
const liveHandleSteps: StepHandler = () => {
  throw new Error('not executed in this test')
}

function makeBaseSession(): SessionState {
  const state = getInitialSessionState({
    projectRoot: '/tmp/proj',
    cwd: '/tmp/proj',
    fileTree: [],
    fileTokenScores: {},
    tokenCallers: {},
    knowledgeFiles: {},
    userKnowledgeFiles: {},
    agentTemplates: {},
    customToolDefinitions: {},
    skills: {},
    gitChanges: {
      status: '',
      diff: '',
      diffCached: '',
      lastCommitMessages: '',
    },
    changesSinceLastChat: {},
    shellConfigFiles: {},
    systemInfo: {
      platform: 'linux',
      shell: 'bash',
      nodeVersion: 'v1',
      arch: 'x64',
      homedir: '/home/u',
      cpus: 4,
      chromeAvailable: false,
    },
  })
  state.fileContext.agentTemplates = {
    'my-agent': {
      id: 'my-agent',
      systemPrompt: 'You are a test agent',
      tools: [],
      handleSteps: liveHandleSteps.toString(),
      handleStepsFn: liveHandleSteps,
    },
  }
  return state
}

describe('applyOverridesToSessionState resume clone (FID-2026-0802-008 R1)', () => {
  test('preserves handleStepsFn through an in-process resume', async () => {
    const base = makeBaseSession()
    const resumed = await applyOverridesToSessionState('/tmp/proj', base, {})

    const template = resumed.fileContext.agentTemplates['my-agent'] as
      ProcessedAgentTemplate | undefined
    expect(template?.handleStepsFn).toBe(liveHandleSteps)
    // The original session is not mutated by the resume clone.
    expect(
      (
        base.fileContext.agentTemplates['my-agent'] as
          ProcessedAgentTemplate | undefined
      )?.handleStepsFn,
    ).toBe(liveHandleSteps)
  })

  test('resume does not share the message history array with the base session', async () => {
    const base = makeBaseSession()
    const resumed = await applyOverridesToSessionState('/tmp/proj', base, {})
    expect(resumed.mainAgentState.messageHistory).not.toBe(
      base.mainAgentState.messageHistory,
    )
  })
})
