import {
  subprocessSandboxBackend,
  ProgressionStore,
} from '@savant-code/agent-runtime/teacher/index'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import {
  resetTeacherSession,
  setTeacherForgeOverride,
  setTeacherSandboxOverride,
  setTeacherStoreOverride,
} from '../../teacher/runtime'
import { handleLearnCommand, parseCritique } from '../learn'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'
import type {
  SandboxBackend,
  ForgeFn,
} from '@savant-code/agent-runtime/teacher/index'

const KNOWN_GOOD_SOURCE = `
function max(a, b) { return a > b ? a : b }
`

const correctForge: ForgeFn = async () => KNOWN_GOOD_SOURCE

const fakeSandbox: SandboxBackend = {
  ...subprocessSandboxBackend,
  async run() {
    return {
      status: 'passed',
      exitCode: 0,
      testSummary: { total: 3, passed: 3, failed: 0, failedNames: [] },
      stdoutHash: 'sha256:00',
      stderrSummary: '',
      durationMs: 0,
      policyVersion: 'p',
      runnerVersion: 'r',
      capabilities: subprocessSandboxBackend.capabilities,
    }
  },
}

let renderedMessages: ChatMessage[]
let store: ProgressionStore

function makeParams(inputValue = '/learn'): RouterParams {
  renderedMessages = []
  return {
    setMessages: mock(
      (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
        renderedMessages =
          typeof update === 'function' ? update(renderedMessages) : update
      },
    ),
    saveToHistory: mock(() => {}),
    setInputValue: mock(() => {}),
    inputValue,
    agentMode: 'HYBRID',
  } as unknown as RouterParams
}

function renderedText(): string {
  return renderedMessages.map((message) => message.content ?? '').join('\n')
}

beforeEach(() => {
  setTeacherForgeOverride(correctForge)
  setTeacherSandboxOverride(fakeSandbox)
  store = ProgressionStore.open(':memory:')
  setTeacherStoreOverride(store)
})

afterEach(() => {
  resetTeacherSession()
  setTeacherForgeOverride(null)
  setTeacherSandboxOverride(null)
  setTeacherStoreOverride(null)
  store.close()
})

describe('/learn command (FID-2026-0813-018)', () => {
  test('overview lists the lifecycle and commands', async () => {
    await handleLearnCommand(makeParams('/learn'), '')
    const text = renderedText()
    expect(text).toContain('Agent-Steering Teacher')
    expect(text).toContain('steering_submitted')
    expect(text).toContain('adjudication')
    expect(text).toContain('/learn start')
    expect(text).toContain('/learn critique')
    expect(text).toContain('/learn progress')
    expect(text).toContain('/learn cancel')
    expect(text).toContain('/learn exit')
  })

  test('start without a steering constraint shows usage', async () => {
    await handleLearnCommand(makeParams('/learn'), 'start')
    expect(renderedText()).toContain('Provide a steering constraint')
  })

  test('start runs Forge + sandbox + graders and waits for critique', async () => {
    await handleLearnCommand(
      makeParams('/learn'),
      'start return the larger value',
    )
    const text = renderedText()
    expect(text).toContain('Starting exercise')
    expect(text).toContain('Forge producing a solution')
    expect(text).toContain('sandbox running hidden tests')
    expect(text).toContain('equivalence review')
    expect(text).toContain('awaiting your critique')
    expect(text).toContain('/learn critique')
  })

  test('critique with concept + required evidence completes as passed', async () => {
    await handleLearnCommand(
      makeParams('/learn'),
      'start return the larger value',
    )
    await handleLearnCommand(
      makeParams('/learn'),
      'critique the comparison is flipped --location "the a > b check" --witness "max(1, 2) returns 1"',
    )
    const text = renderedText()
    expect(text).toContain('Exercise result')
    expect(text).toContain('PASSED')
    expect(text).toContain('flaw identified')
    expect(text).toContain('ZTAP receipt: signed by teacher over sha256:')
    expect(text).toContain('Progression: recorded (competency completed)')
    expect(store.getCompetency('behavioral-invariants')?.state).toBe(
      'completed',
    )
  })

  test('critique without a statement shows usage', async () => {
    await handleLearnCommand(makeParams('/learn'), 'critique')
    expect(renderedText()).toContain('Usage:')
  })

  test('cancel describes cleanup and no-credit', async () => {
    await handleLearnCommand(makeParams('/learn'), 'cancel')
    const text = renderedText()
    expect(text).toContain('cancelled')
    expect(text).toContain('no credit')
  })

  test('exit restores chat without mutation', async () => {
    const params = makeParams('/learn')
    await handleLearnCommand(params, 'exit')
    expect(renderedText()).toContain('Leaving the teacher')
    expect(params.saveToHistory).toHaveBeenCalledWith('/learn')
  })

  test('progress with an empty store shows no records', async () => {
    await handleLearnCommand(makeParams('/learn'), 'progress')
    const text = renderedText()
    expect(text).toContain('Teacher progress')
    expect(text).toContain('No competency records yet')
  })

  test('progress after a completed attempt shows the versioned record', async () => {
    await handleLearnCommand(
      makeParams('/learn'),
      'start return the larger value',
    )
    await handleLearnCommand(
      makeParams('/learn'),
      'critique the comparison is flipped --location "the a > b check" --witness "max(1, 2) returns 1"',
    )
    await handleLearnCommand(makeParams('/learn'), 'progress')
    const text = renderedText()
    expect(text).toContain('Teacher progress')
    expect(text).toContain('Attempts recorded: 1')
    expect(text).toContain('Skill: behavioral-invariants — completed')
    expect(text).toContain('attempts 1 · evidence 1')
    expect(text).toContain('latest: passed (ztap-signed)')
    expect(text).toContain('versions: corpus 1')
    expect(text).toContain('sandbox teacher-sandbox-policy-v1')
    expect(text).toContain('grader teacher-grading-v1')
    expect(text).toContain('mutation detection-v1')
  })

  test('parseCritique extracts structured evidence flags', () => {
    const submission = parseCritique(
      'comparison flipped --location "the a > b check" --witness max(1,2)==1 --impact "wrong result"',
    )
    expect(submission.statement).toBe('comparison flipped')
    expect(submission.location).toBe('the a > b check')
    expect(submission.witness).toBe('max(1,2)==1')
    expect(submission.impact).toBe('wrong result')
  })
})
