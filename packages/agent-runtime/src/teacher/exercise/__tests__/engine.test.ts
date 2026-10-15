import { hashChange } from '@savant-code/common/crypto'
import { describe, expect, test } from 'bun:test'

import { subprocessSandboxBackend } from '../../sandbox'
import { ExerciseEngine } from '../engine'

import type { DetectionGrader, EquivalenceGrader, ForgeFn } from '../grader'
import type {
  CritiqueSubmission,
  MutationContract,
  PrivateChallengePack,
  PublicChallenge,
} from '@savant-code/common/teacher'

const CHALLENGE_HASH = hashChange('vs-max-challenge-v1')

const CHALLENGE: PublicChallenge = {
  id: 'teacher-vs-max',
  version: 1,
  skill: 'behavioral-invariants',
  objective: 'Implement a max(a, b) function',
  prompt: 'Write a function max(a, b) that returns the larger of a and b.',
  visibleGuidance: 'Handle equal values and negative numbers.',
  inputContract: {
    signature: 'function max(a, b)',
    examples: ['max(1, 2) === 2'],
  },
  outputContract: {
    description: 'the larger of a and b',
    examples: ['max(1, 2) === 2'],
  },
  limits: { timeLimitMs: 200, maxOutputBytes: 1024 },
  prerequisites: [],
  challengeHash: CHALLENGE_HASH,
}

const KNOWN_GOOD_SOURCE = `
function max(a, b) { return a > b ? a : b }
`

const HIDDEN_TESTS = `
recordTest('positive', () => max(1, 2) === 2)
recordTest('negative', () => max(-1, -2) === -1)
recordTest('equal', () => max(5, 5) === 5)
`

const MUTATION: MutationContract = {
  mutationId: 'max-lt-flip',
  skillTarget: 'behavioral-invariants',
  changedBehavior: 'returns the smaller value instead of the larger',
  surface: 'the a > b comparison',
  witness: 'max(1, 2) === 1 (should be 2)',
  impact: 'wrong result for every distinct pair',
  severity: 'critical',
  acceptableConcepts: [
    'comparison',
    'greater',
    'larger',
    'flipped',
    'wrong direction',
  ],
  patch: { find: 'a > b', replace: 'a < b' },
  hiddenFromVisibleTests: false,
  graderVersion: 'detection-v1',
}

const PACK: PrivateChallengePack = {
  challengeHash: CHALLENGE_HASH,
  knownGoodHash: hashChange(KNOWN_GOOD_SOURCE),
  hiddenTests: HIDDEN_TESTS,
  mutationContracts: [MUTATION],
  critiqueRubric: {
    concepts: MUTATION.acceptableConcepts,
    requiredEvidence: ['location', 'witness'],
  },
  gradingVersion: 'teacher-grading-v1',
}

const EQUIVALENCE: EquivalenceGrader = {
  graderVersion: 'equivalence-v1',
  async grade({ solutionSource, sandboxResult }) {
    const hardcoded = /return\s+\d+\s*;/.test(solutionSource)
    return {
      passed: sandboxResult.status === 'passed' && !hardcoded,
      testSummary: sandboxResult.testSummary,
      antiCheat: {
        passed: !hardcoded,
        findings: hardcoded ? ['test-specific hardcoding'] : [],
      },
      graderVersion: 'equivalence-v1',
    }
  },
}

const DETECTION: DetectionGrader = {
  graderVersion: 'detection-v1',
  inject({ knownGoodSource, pack }) {
    const mutation = pack.mutationContracts[0]
    return {
      mutation,
      mutatedSource: knownGoodSource.replace(
        mutation.patch.find,
        mutation.patch.replace,
      ),
    }
  },
  grade({ critique, mutation }) {
    const text =
      `${critique.statement} ${critique.location ?? ''} ${critique.witness ?? ''} ${critique.impact ?? ''}`.toLowerCase()
    const identified = mutation.acceptableConcepts.some((concept) =>
      text.includes(concept.toLowerCase()),
    )
    const evidenceCoverage = {
      location: Boolean(critique.location),
      witness: Boolean(critique.witness),
      impact: Boolean(critique.impact),
    }
    return {
      mutationId: mutation.mutationId,
      grade: {
        mutationId: mutation.mutationId,
        identified,
        evidenceCoverage,
        locationMatch: Boolean(critique.location),
        witnessMatch: Boolean(critique.witness),
        impactMatch: Boolean(critique.impact),
        confidence: identified ? 1 : 0,
        reasonCode: identified ? 'identified' : 'vague',
        graderVersion: 'detection-v1',
      },
      graderVersion: 'detection-v1',
    }
  },
}

const CORRECT_CRITIQUE: CritiqueSubmission = {
  statement: 'The comparison is flipped so it returns the smaller value',
  location: 'the a > b check',
  witness: 'max(1, 2) returns 1 instead of 2',
  impact: 'wrong result for all distinct pairs',
}

const VAGUE_CRITIQUE: CritiqueSubmission = {
  statement: 'this seems wrong',
}

function makeEngine(
  forge: ForgeFn,
  overrides: Partial<Parameters<typeof makeDeps>[0]> = {},
) {
  return new ExerciseEngine(makeDeps(forge, overrides))
}

type Deps = {
  forge?: ForgeFn
  sandbox?: typeof subprocessSandboxBackend
  challenge?: PublicChallenge
  pack?: PrivateChallengePack
}

function makeDeps(forge: ForgeFn, overrides: Deps = {}) {
  return {
    challenge: overrides.challenge ?? CHALLENGE,
    pack: overrides.pack ?? PACK,
    sandbox: overrides.sandbox ?? subprocessSandboxBackend,
    forge,
    equivalence: EQUIVALENCE,
    detection: DETECTION,
    knownGoodSource: KNOWN_GOOD_SOURCE,
    now: () => new Date('2026-08-13T12:00:00.000Z'),
  }
}

const correctForge: ForgeFn = async () => KNOWN_GOOD_SOURCE
const brokenForge: ForgeFn = async () => `
function max(a, b) { return a * b }
`

describe('headless exercise engine (vertical slice)', () => {
  test('correct steering + correct critique completes as passed', async () => {
    const engine = makeEngine(correctForge)
    const result = await engine.run('return the larger value', CORRECT_CRITIQUE)

    expect(result.completionState).toBe('passed')
    expect(result.equivalenceResult.passed).toBe(true)
    expect(result.detectionResult.grade.identified).toBe(true)
    expect(result.detectionResult.mutationId).toBe('max-lt-flip')
    expect(result.challengeHash).toBe(CHALLENGE_HASH)
  })

  test('broken steering fails even with a correct critique', async () => {
    const engine = makeEngine(brokenForge)
    const result = await engine.run('multiply the inputs', CORRECT_CRITIQUE)

    expect(result.completionState).toBe('failed')
    expect(result.equivalenceResult.passed).toBe(false)
    expect(result.equivalenceResult.testSummary.failed).toBeGreaterThan(0)
  })

  test('vague critique fails detection even with correct steering', async () => {
    const engine = makeEngine(correctForge)
    const result = await engine.run('return the larger value', VAGUE_CRITIQUE)

    expect(result.completionState).toBe('failed')
    expect(result.equivalenceResult.passed).toBe(true)
    expect(result.detectionResult.grade.identified).toBe(false)
  })

  test('unavailable sandbox ends honestly as unavailable', async () => {
    const unavailableSandbox = {
      ...subprocessSandboxBackend,
      run: async () => ({
        status: 'unavailable' as const,
        exitCode: null,
        testSummary: { total: 0, passed: 0, failed: 0, failedNames: [] },
        stdoutHash: hashChange(''),
        stderrSummary: 'sandbox unavailable',
        durationMs: 0,
        policyVersion: 'p',
        runnerVersion: 'r',
        capabilities: subprocessSandboxBackend.capabilities,
      }),
    }
    const engine = makeEngine(correctForge, { sandbox: unavailableSandbox })
    const result = await engine.run('return the larger value', CORRECT_CRITIQUE)

    expect(result.completionState).toBe('unavailable')
  })
})
