import { describe, expect, test } from 'bun:test'

import { subprocessSandboxBackend } from '../../sandbox'
import {
  BehaviorFirstEquivalenceGrader,
  CatalogDetectionGrader,
  evaluateCalibration,
  gradeCritique,
  type LabeledCritiqueCase,
} from '../index'

import type {
  CritiqueRubric,
  CritiqueSubmission,
  MutationContract,
  PrivateChallengePack,
  PublicChallenge,
  SandboxResult,
  SandboxStatus,
} from '@savant-code/common/teacher'

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

const RUBRIC: CritiqueRubric = {
  concepts: MUTATION.acceptableConcepts,
  requiredEvidence: ['location', 'witness'],
}

const CHALLENGE: PublicChallenge = {
  id: 'teacher-vs-max',
  version: 1,
  skill: 'behavioral-invariants',
  objective: 'max',
  prompt: 'max',
  visibleGuidance: 'max',
  inputContract: { signature: 'max', examples: [] },
  outputContract: { description: 'max', examples: [] },
  limits: { timeLimitMs: 200, maxOutputBytes: 1024 },
  prerequisites: [],
  challengeHash: `sha256:${'0'.repeat(64)}`,
}

const PACK: PrivateChallengePack = {
  challengeHash: CHALLENGE.challengeHash,
  knownGoodHash: `sha256:${'0'.repeat(64)}`,
  hiddenTests: '',
  mutationContracts: [MUTATION],
  critiqueRubric: RUBRIC,
  gradingVersion: 'g',
}

function sandboxResult(
  status: SandboxStatus,
  failedNames: string[] = [],
): SandboxResult {
  return {
    status,
    exitCode: status === 'passed' ? 0 : 1,
    testSummary: {
      total: 3,
      passed: status === 'passed' ? 3 : 0,
      failed: status === 'passed' ? 0 : 3,
      failedNames,
    },
    stdoutHash: `sha256:${'0'.repeat(64)}`,
    stderrSummary: '',
    durationMs: 1,
    policyVersion: 'p',
    runnerVersion: 'r',
    capabilities: subprocessSandboxBackend.capabilities,
  }
}

describe('equivalence grader', () => {
  const grader = new BehaviorFirstEquivalenceGrader()

  test('valid solution passes', async () => {
    const result = await grader.grade({
      solutionSource: 'function max(a, b) { return a > b ? a : b }',
      sandboxResult: sandboxResult('passed'),
      challenge: CHALLENGE,
      pack: PACK,
    })
    expect(result.passed).toBe(true)
    expect(result.antiCheat.passed).toBe(true)
  })

  test('valid alternate implementations pass', async () => {
    for (const source of [
      'function max(a, b) { return Math.max(a, b) }',
      'function max(a, b) { return a >= b ? a : b }',
      'function max(a, b) { if (a > b) return a; return b }',
    ]) {
      const result = await grader.grade({
        solutionSource: source,
        sandboxResult: sandboxResult('passed'),
        challenge: CHALLENGE,
        pack: PACK,
      })
      expect(result.passed).toBe(true)
    }
  })

  test('hardcoded solution is flagged as anti-cheat failure', async () => {
    const hardcoded = `
function max(a, b) {
  if (a === 1 && b === 2) return 2
  if (a === -1 && b === -2) return -1
  if (a === 5 && b === 5) return 5
}
`
    const result = await grader.grade({
      solutionSource: hardcoded,
      sandboxResult: sandboxResult('passed'),
      challenge: CHALLENGE,
      pack: PACK,
    })
    expect(result.passed).toBe(false)
    expect(result.antiCheat.passed).toBe(false)
    expect(result.antiCheat.findings).toContain(
      'test-specific hardcoding suspected',
    )
  })

  test('broken solution fails on behavior', async () => {
    const result = await grader.grade({
      solutionSource: 'function max(a, b) { return a * b }',
      sandboxResult: sandboxResult('failed', ['positive']),
      challenge: CHALLENGE,
      pack: PACK,
    })
    expect(result.passed).toBe(false)
    expect(
      result.antiCheat.findings.some((f) => f.startsWith('hidden tests')),
    ).toBe(true)
  })

  test('timeout surfaces a resource finding', async () => {
    const result = await grader.grade({
      solutionSource: 'function max(a, b) { while (true) {} }',
      sandboxResult: sandboxResult('timed_out'),
      challenge: CHALLENGE,
      pack: PACK,
    })
    expect(result.passed).toBe(false)
    expect(result.antiCheat.findings).toContain('resource limit exceeded')
  })
})

describe('detection grader', () => {
  const correct: CritiqueSubmission = {
    statement: 'The comparison is flipped so it returns the smaller value',
    location: 'the a > b check',
    witness: 'max(1, 2) returns 1 instead of 2',
    impact: 'wrong result for all distinct pairs',
  }

  test('correct critique is identified', () => {
    const grade = gradeCritique(correct, MUTATION, RUBRIC)
    expect(grade.identified).toBe(true)
    expect(grade.reasonCode).toBe('identified')
    expect(grade.confidence).toBe(1)
  })

  test('concept match without required evidence is partial', () => {
    const grade = gradeCritique(
      { statement: 'the comparison is flipped' },
      MUTATION,
      RUBRIC,
    )
    expect(grade.identified).toBe(false)
    expect(grade.reasonCode).toBe('partial')
  })

  test('vague critique is rejected', () => {
    const grade = gradeCritique(
      { statement: 'this is wrong' },
      MUTATION,
      RUBRIC,
    )
    expect(grade.identified).toBe(false)
    expect(grade.reasonCode).toBe('vague')
  })

  test('unrelated critique is rejected', () => {
    const grade = gradeCritique(
      { statement: 'the variable names should be more descriptive' },
      MUTATION,
      RUBRIC,
    )
    expect(grade.identified).toBe(false)
    expect(grade.reasonCode).toBe('unrelated')
  })

  test('inject applies the mutation deterministically', () => {
    const grader = new CatalogDetectionGrader()
    const knownGood = 'function max(a, b) { return a > b ? a : b }'
    const injected = grader.inject({ knownGoodSource: knownGood, pack: PACK })
    expect(injected.mutation.mutationId).toBe('max-lt-flip')
    expect(injected.mutatedSource).toContain('a < b')
    expect(injected.mutatedSource).not.toBe(knownGood)
  })

  test('calibration meets the declared V1 thresholds', () => {
    const cases: LabeledCritiqueCase[] = [
      {
        critique: correct,
        mutation: MUTATION,
        rubric: RUBRIC,
        expectedIdentified: true,
      },
      {
        critique: {
          statement: 'the greater-than check is backwards',
          location: 'the comparison operator',
          witness: 'max(3, 4) gives 3',
        },
        mutation: MUTATION,
        rubric: RUBRIC,
        expectedIdentified: true,
      },
      {
        critique: {
          statement: 'the wrong direction operator',
          location: 'the comparison',
          witness: 'max(1, 2) gives 1',
        },
        mutation: MUTATION,
        rubric: RUBRIC,
        expectedIdentified: true,
      },
      {
        critique: { statement: 'this is wrong' },
        mutation: MUTATION,
        rubric: RUBRIC,
        expectedIdentified: false,
      },
      {
        critique: { statement: 'rename the parameters for clarity' },
        mutation: MUTATION,
        rubric: RUBRIC,
        expectedIdentified: false,
      },
    ]

    const report = evaluateCalibration(
      cases,
      new CatalogDetectionGrader().grade.bind(new CatalogDetectionGrader()),
    )

    expect(report.acceptanceRateOfCorrect).toBe(1)
    expect(report.acceptanceRateOfVague).toBe(0)
    expect(report.acceptanceRateOfCorrect).toBeGreaterThanOrEqual(0.95)
    expect(report.acceptanceRateOfVague).toBeLessThanOrEqual(0.05)
  })
})
