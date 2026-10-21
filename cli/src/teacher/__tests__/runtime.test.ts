import { ProgressionStore } from '@savant-code/agent-runtime/teacher/index'
import {
  fromBase64Url,
  jcsCanonicalize,
  verifyPayload,
} from '@savant-code/common/crypto'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  buildForgePrompt,
  extractSolutionSource,
  resolveTeacherForgeAgent,
  stripCodeFence,
  TEACHER_FORGE_AGENT,
} from '../forge'
import {
  getTeacherSessionState,
  readTeacherProgress,
  resetTeacherSession,
  setTeacherForgeOverride,
  setTeacherStoreOverride,
  startTeacherExercise,
  submitTeacherCritique,
} from '../runtime'

import type { ForgeFn } from '@savant-code/agent-runtime/teacher/index'
import type { PublicChallenge } from '@savant-code/common/teacher'
import type { AgentOutput } from '@savant-code/common/types/session-state'

const KNOWN_GOOD_SOURCE = `
function max(a, b) { return a > b ? a : b }
`

const correctForge: ForgeFn = async () => KNOWN_GOOD_SOURCE
const brokenForge: ForgeFn = async () => `
function max(a, b) { return a * b }
`

const CORRECT_CRITIQUE = {
  statement: 'the comparison is flipped so it returns the smaller value',
  location: 'the a > b check',
  witness: 'max(1, 2) returns 1 instead of 2',
}

const VAGUE_CRITIQUE = { statement: 'this seems wrong' }

afterEach(() => {
  resetTeacherSession()
  setTeacherForgeOverride(null)
  setTeacherStoreOverride(null)
})

describe('teacher forge adapter', () => {
  test('teacher-forge agent is read-only (no tools, last_message)', () => {
    expect(TEACHER_FORGE_AGENT.id).toBe('teacher-forge')
    expect(TEACHER_FORGE_AGENT.toolNames).toEqual([])
    expect(TEACHER_FORGE_AGENT.spawnableAgents).toEqual([])
    expect(TEACHER_FORGE_AGENT.outputMode).toBe('last_message')
  })

  test('buildForgePrompt carries steering and the public contract', () => {
    const challenge = {
      objective: 'Implement a max(a, b) function',
      prompt: 'Write a function max(a, b).',
      visibleGuidance: 'Handle equal values.',
      inputContract: {
        signature: 'function max(a, b)',
        examples: ['max(1, 2) === 2'],
      },
      outputContract: { description: 'the larger of a and b', examples: [] },
    } as unknown as PublicChallenge
    const prompt = buildForgePrompt('return the larger value', challenge)
    expect(prompt).toContain('return the larger value')
    expect(prompt).toContain('function max(a, b)')
    expect(prompt).toContain('max(1, 2) === 2')
    expect(prompt).toContain('Produce only the function source')
  })

  test('extractSolutionSource unwraps a last_message code fence', () => {
    const output: AgentOutput = {
      type: 'lastMessage',
      value: [
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '```js\nfunction max(a, b) { return a > b ? a : b }\n```',
            },
          ],
        },
      ],
    }
    expect(extractSolutionSource(output)).toBe(
      'function max(a, b) { return a > b ? a : b }',
    )
  })

  test('extractSolutionSource falls back to structured output', () => {
    const output: AgentOutput = {
      type: 'structuredOutput',
      value: { solution: 'function max(a, b) { return a > b ? a : b }' },
    }
    expect(extractSolutionSource(output)).toBe(
      'function max(a, b) { return a > b ? a : b }',
    )
  })

  test('extractSolutionSource throws on error output and empty output', () => {
    expect(() =>
      extractSolutionSource({ type: 'error', message: 'boom' }),
    ).toThrow(/boom/)
    expect(() =>
      extractSolutionSource({ type: 'lastMessage', value: [] }),
    ).toThrow(/no solution source/)
  })

  test('stripCodeFence leaves plain text untouched', () => {
    expect(stripCodeFence('function f() {}')).toBe('function f() {}')
  })

  test('resolveTeacherForgeAgent applies the active model override', () => {
    // FID-2026-0814-004 H-08/H-09: the store model is ALWAYS the effective
    // model; the bundled default is display metadata and never a fallback.
    // The paid hardcode (deepseek-v4-pro) is gone — a free-tier selection
    // cannot be silently upgraded to a paid model.
    const overridden = resolveTeacherForgeAgent('nous/tencent/hy3:free')
    expect(overridden).not.toBe(TEACHER_FORGE_AGENT)
    expect(overridden.model).toBe('nous/tencent/hy3:free')
    expect(overridden.toolNames).toEqual([])
    expect(overridden.spawnableAgents).toEqual([])
    expect(overridden.id).toBe('teacher-forge')
    // A store-resolved free default propagates verbatim (never upgraded).
    expect(resolveTeacherForgeAgent('openrouter/free').model).toBe(
      'openrouter/free',
    )
  })
})

// FID-2026-1021-003: every test below drives the REAL sandbox backend — one
// `mkdtempSync` workspace plus a `spawn(process.execPath, …)` child per attempt —
// and that backend allows `timeLimitMs: 200` plus a 2 s kill margin before it
// kills the child, so a single attempt's designed worst case is 2.2 s before the
// spawn itself is counted. The declared budget is the repository's
// `testing.test_timeout: 30` (`protocol.config.yaml`), passed as the per-test
// third argument because `cli/bunfig.toml` records that a `[test] timeout` key is
// inert under Bun 1.3.14. Measured 2026-10-21: 95–135 ms per test in the
// whole-workspace leg, with one 6,326.73 ms outlier against Bun's implicit
// 5,000 ms ceiling, which then cascaded into a critique submitted from
// `sandbox_running`. A test that spawns a process inherits the host's
// scheduling; the ceiling must not be the machine's.
describe('live exercise runtime (Forge + sandbox + graders)', () => {
  test('correct steering reaches critique-await, then a correct critique passes', async () => {
    setTeacherForgeOverride(correctForge)

    const early = await startTeacherExercise('return the larger value')
    expect(early).toBeNull()

    const state = getTeacherSessionState()
    expect(state.phase).toBe('learner_critique')
    expect(state.challenge?.id).toBe('teacher-vs-max')
    const types = state.events.map((event) => event.type)
    expect(types).toEqual([
      'steering_submitted',
      'forge_running',
      'sandbox_running',
      'equivalence_review',
      'detection_review',
      'learner_critique',
    ])

    const result = submitTeacherCritique(CORRECT_CRITIQUE)
    expect(result.completionState).toBe('passed')
    expect(result.equivalenceResult.passed).toBe(true)
    expect(result.detectionResult.grade.identified).toBe(true)

    // The attempt's evidence hashes are signed by an ephemeral teacher key and
    // the receipt is independently verifiable from its public key + evidence.
    const receipt = getTeacherSessionState().receipt
    expect(receipt).not.toBeNull()
    expect(receipt?.schema).toBe('savant.teacher.attempt-receipt.v1')
    expect(receipt?.role).toBe('teacher')
    expect(receipt?.over).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(receipt?.evidence.evidenceHashes).toEqual(result.evidenceHashes)
    const publicKey = fromBase64Url(receipt!.publicKey)
    expect(publicKey).not.toBeNull()
    expect(
      verifyPayload(
        publicKey!,
        { kind: 'jcs', canonical: jcsCanonicalize(receipt!.evidence) },
        receipt!.sig,
        receipt!.over,
      ),
    ).toBe(true)
  }, 30_000)

  test('a broken solution fails equivalence even with a correct critique', async () => {
    setTeacherForgeOverride(brokenForge)

    await startTeacherExercise('multiply the inputs')
    const result = submitTeacherCritique(CORRECT_CRITIQUE)

    expect(result.completionState).toBe('failed')
    expect(result.equivalenceResult.passed).toBe(false)
  }, 30_000)

  test('a vague critique fails detection', async () => {
    setTeacherForgeOverride(correctForge)

    await startTeacherExercise('return the larger value')
    const result = submitTeacherCritique(VAGUE_CRITIQUE)

    expect(result.completionState).toBe('failed')
    expect(result.detectionResult.grade.identified).toBe(false)
  }, 30_000)

  test('reset clears the session and returns to ready', async () => {
    setTeacherForgeOverride(correctForge)
    await startTeacherExercise('return the larger value')

    resetTeacherSession()
    const state = getTeacherSessionState()
    expect(state.challenge).toBeNull()
    expect(state.phase).toBe('ready')
    expect(state.events).toEqual([])
    expect(state.attemptId).toBeNull()
  }, 30_000)

  test('getTeacherSessionState returns an events snapshot copy, not a live alias', async () => {
    setTeacherForgeOverride(correctForge)
    await startTeacherExercise('return the larger value')

    const first = getTeacherSessionState()
    const second = getTeacherSessionState()
    expect(first.events).toEqual(second.events)
    // FID-2026-0813-022: the copy keeps the sidebar's memoized reducer honest —
    // a shared live array would never change identity across snapshots.
    expect(first.events).not.toBe(second.events)
  }, 30_000)

  test('readTeacherProgress exposes the versioned competency record', async () => {
    setTeacherForgeOverride(correctForge)
    const store = ProgressionStore.open(':memory:')
    setTeacherStoreOverride(store)

    await startTeacherExercise('return the larger value')
    submitTeacherCritique(CORRECT_CRITIQUE)

    const progress = readTeacherProgress()
    expect(progress).not.toBeNull()
    expect(progress?.totalAttempts).toBe(1)
    expect(progress?.entries).toHaveLength(1)
    const entry = progress?.entries[0]
    expect(entry?.skill).toBe('behavioral-invariants')
    expect(entry?.state).toBe('completed')
    expect(entry?.attemptCount).toBe(1)
    expect(entry?.evidenceAttempts).toBe(1)
    expect(entry?.latest?.completionState).toBe('passed')
    expect(entry?.latest?.receiptStatus).toBe('ztap-signed')
    expect(entry?.latest?.versions).toEqual({
      corpus: '1',
      sandboxPolicy: 'teacher-sandbox-policy-v1',
      grader: 'teacher-grading-v1',
      mutation: 'detection-v1',
    })

    store.close()
  }, 30_000)

  test('a passed attempt is persisted as a versioned competency record', async () => {
    setTeacherForgeOverride(correctForge)
    const store = ProgressionStore.open(':memory:')
    setTeacherStoreOverride(store)

    await startTeacherExercise('return the larger value')
    const result = submitTeacherCritique(CORRECT_CRITIQUE)

    expect(result.completionState).toBe('passed')
    const state = getTeacherSessionState()
    expect(state.persisted).toBe(true)
    expect(state.competencyState).toBe('completed')

    const attempt = store.getAttempt(result.attemptId)
    expect(attempt).not.toBeNull()
    expect(attempt?.receiptStatus).toBe('ztap-signed')
    expect(attempt?.receipt).not.toBeNull()
    expect(attempt?.receipt?.evidence.evidenceHashes).toEqual(
      result.evidenceHashes,
    )

    const edge = store.getCompetency('behavioral-invariants')
    expect(edge?.state).toBe('completed')
    expect(edge?.evidence).toContain(result.attemptId)

    store.close()
  }, 30_000)
})
