import { describe, expect, test } from 'bun:test'

import { subprocessSandboxBackend } from '../../sandbox'
import {
  buildPack,
  parseCorpusSource,
  scanIsolation,
  validateChallenge,
} from '../index'

import type { ChallengeSource, CorpusSource } from '../index'
import type { MutationContract, Skill } from '@savant-code/common/teacher'

const KNOWN_GOOD = `
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

const SKILL: Skill = {
  id: 'behavioral-invariants',
  label: 'Behavioral invariants',
  description: 'State behavioral invariants and acceptance criteria',
  outcomes: [
    {
      id: 'bi-1',
      statement: 'state behavioral invariants',
      measuredBy: 'equivalence',
    },
  ],
}

const CHALLENGE_SOURCE: ChallengeSource = {
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
  knownGoodSource: KNOWN_GOOD,
  hiddenTests: HIDDEN_TESTS,
  mutationContracts: [MUTATION],
  critiqueRubric: {
    concepts: MUTATION.acceptableConcepts,
    requiredEvidence: ['location', 'witness'],
  },
  gradingVersion: 'teacher-grading-v1',
}

const CORPUS: CorpusSource = {
  corpusVersion: '1.0.0',
  skills: [SKILL],
  challenges: [CHALLENGE_SOURCE],
}

describe('corpus pack builder', () => {
  test('produces stable content-addressed hashes', () => {
    const first = buildPack(CHALLENGE_SOURCE)
    const second = buildPack(CHALLENGE_SOURCE)

    expect(first.public.challengeHash).toBe(second.public.challengeHash)
    expect(first.private.knownGoodHash).toBe(second.private.knownGoodHash)
    expect(first.public.challengeHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(first.private.knownGoodHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(first.private.challengeHash).toBe(first.public.challengeHash)
  })

  test('public pack excludes all private answer material', () => {
    const { public: pub, private: priv } = buildPack(CHALLENGE_SOURCE)

    expect(pub).not.toHaveProperty('knownGoodSource')
    expect(pub).not.toHaveProperty('hiddenTests')
    expect(pub).not.toHaveProperty('mutationContracts')
    expect(JSON.stringify(pub)).not.toContain(KNOWN_GOOD)
    expect(JSON.stringify(pub)).not.toContain(HIDDEN_TESTS)

    expect(priv.hiddenTests).toBe(HIDDEN_TESTS)
    expect(priv.mutationContracts).toHaveLength(1)
    expect(priv.knownGoodHash).toBeDefined()
  })

  test('challenge hash changes when public fields change', () => {
    const a = buildPack(CHALLENGE_SOURCE)
    const b = buildPack({
      ...CHALLENGE_SOURCE,
      objective: 'Different objective',
    })
    expect(a.public.challengeHash).not.toBe(b.public.challengeHash)
  })
})

describe('corpus validation', () => {
  test('valid challenge passes the full pipeline', async () => {
    const report = await validateChallenge(
      CHALLENGE_SOURCE,
      subprocessSandboxBackend,
      3,
    )
    expect(report.valid).toBe(true)
    expect(report.knownGood.allPassed).toBe(true)
    expect(report.mutations).toHaveLength(1)
    expect(report.mutations[0].witnessReal).toBe(true)
    expect(report.isolation.passed).toBe(true)
  })

  test('known-good repeatability gate (20 runs) holds', async () => {
    const report = await validateChallenge(
      CHALLENGE_SOURCE,
      subprocessSandboxBackend,
      20,
    )
    expect(report.knownGood.runs).toBe(20)
    expect(report.knownGood.allPassed).toBe(true)
    expect(
      report.knownGood.statuses.every((status) => status === 'passed'),
    ).toBe(true)
  })

  test('broken known-good fails validation', async () => {
    const broken: ChallengeSource = {
      ...CHALLENGE_SOURCE,
      knownGoodSource: `function max(a, b) { return a * b }`,
    }
    const report = await validateChallenge(broken, subprocessSandboxBackend, 2)
    expect(report.valid).toBe(false)
    expect(report.knownGood.allPassed).toBe(false)
  })

  test('mutation with no behavioral witness fails validation', async () => {
    const weak: ChallengeSource = {
      ...CHALLENGE_SOURCE,
      mutationContracts: [
        { ...MUTATION, patch: { find: 'a > b', replace: 'a > b' } },
      ],
    }
    const report = await validateChallenge(weak, subprocessSandboxBackend, 2)
    expect(report.valid).toBe(false)
    expect(report.mutations[0].witnessReal).toBe(false)
  })

  test('non-applicable mutation patch fails validation', async () => {
    const bad: ChallengeSource = {
      ...CHALLENGE_SOURCE,
      mutationContracts: [
        { ...MUTATION, patch: { find: 'NOPE_NOT_HERE', replace: 'x' } },
      ],
    }
    const report = await validateChallenge(bad, subprocessSandboxBackend, 2)
    expect(report.valid).toBe(false)
    expect(report.mutations[0].applied).toBe(false)
    expect(report.errors.some((error) => error.includes('did not apply'))).toBe(
      true,
    )
  })

  test('isolation scan flags private answer material in public prose', () => {
    const leaked: ChallengeSource = {
      ...CHALLENGE_SOURCE,
      prompt: `The answer is: ${KNOWN_GOOD}`,
    }
    const report = scanIsolation(leaked)
    expect(report.passed).toBe(false)
    expect(report.findings.length).toBeGreaterThan(0)
  })

  test('isolation scan is clean for a well-formed source', () => {
    const report = scanIsolation(CHALLENGE_SOURCE)
    expect(report.passed).toBe(true)
    expect(report.findings).toEqual([])
  })
})

describe('corpus source parsing', () => {
  test('parses a valid corpus manifest', () => {
    const parsed = parseCorpusSource(CORPUS)
    expect(parsed.challenges).toHaveLength(1)
    expect(parsed.skills).toHaveLength(1)
  })

  test('rejects a malformed manifest', () => {
    const malformed = { ...CORPUS, challenges: [{ id: 'no-hidden-tests' }] }
    expect(() => parseCorpusSource(malformed)).toThrow(/Invalid corpus source/)
  })
})
