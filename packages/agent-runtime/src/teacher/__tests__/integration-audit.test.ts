import fs from 'node:fs'
import path from 'node:path'

import { deriveRoleKeypair } from '@savant-code/common/crypto'
import { describe, expect, test } from 'bun:test'

import { buildPack, validateChallenge, type ChallengeSource } from '../corpus'
import { ExerciseEngine, type ForgeFn } from '../exercise'
import {
  behaviorFirstEquivalenceGrader,
  catalogDetectionGrader,
} from '../grading'
import {
  adaptAttemptReceipt,
  buildProgressionRecord,
  ProgressionStore,
} from '../progression'
import { subprocessSandboxBackend } from '../sandbox'

import type { MutationContract } from '@savant-code/common/teacher'

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
  acceptableConcepts: ['comparison', 'flipped', 'wrong direction'],
  patch: { find: 'a > b', replace: 'a < b' },
  hiddenFromVisibleTests: false,
  graderVersion: 'detection-v1',
}

const SOURCE: ChallengeSource = {
  id: 'teacher-vs-max',
  version: 1,
  skill: 'behavioral-invariants',
  objective: 'Implement max(a, b)',
  prompt: 'Return the larger of a and b.',
  visibleGuidance: 'Handle negatives and ties.',
  inputContract: {
    signature: 'function max(a, b)',
    examples: ['max(1, 2) === 2'],
  },
  outputContract: { description: 'larger', examples: ['max(1, 2) === 2'] },
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

const forge: ForgeFn = async () => KNOWN_GOOD

const CORRECT_CRITIQUE = {
  statement: 'The comparison is flipped so it returns the smaller value',
  location: 'the a > b check',
  witness: 'max(1, 2) returns 1 instead of 2',
  impact: 'wrong result for all distinct pairs',
}

describe('teacher integration audit (FID-2026-0813-020)', () => {
  test('full pipeline: corpus → sandbox → engine → progression → ZTAP', async () => {
    const { public: challenge, private: pack } = buildPack(SOURCE)

    // Corpus gate: known-good repeatability + mutation witness.
    const validation = await validateChallenge(
      SOURCE,
      subprocessSandboxBackend,
      3,
    )
    expect(validation.valid).toBe(true)

    // Engine with the real graders.
    const engine = new ExerciseEngine({
      challenge,
      pack,
      sandbox: subprocessSandboxBackend,
      forge,
      equivalence: behaviorFirstEquivalenceGrader,
      detection: catalogDetectionGrader,
      knownGoodSource: KNOWN_GOOD,
    })
    const result = await engine.run(
      'return the larger of the two inputs',
      CORRECT_CRITIQUE,
    )
    expect(result.completionState).toBe('passed')

    // Progression + honest ZTAP adapter.
    const seed = new Uint8Array(32)
    crypto.getRandomValues(seed)
    const keypair = await deriveRoleKeypair(
      seed,
      'teacher-integration',
      'teacher',
    )
    const receipt = adaptAttemptReceipt(result, challenge, keypair)
    expect(receipt).not.toBeNull()
    expect(receipt?.over).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(receipt?.sig).toBeTruthy()

    const store = ProgressionStore.open(':memory:')
    const record = buildProgressionRecord(result, challenge, receipt)
    expect(store.recordAttempt(record)).toBe(true)
    const persisted = store.getAttempt(result.attemptId)
    expect(persisted?.receiptStatus).toBe('ztap-signed')
    expect(persisted?.receipt?.over).toBe(receipt?.over)
    expect(persisted?.completionState).toBe('passed')
    store.close()
  })

  test('unavailable sandbox blocks execution and awards no progression', async () => {
    const { public: challenge, private: pack } = buildPack(SOURCE)
    const unavailable = {
      ...subprocessSandboxBackend,
      run: async () => ({
        status: 'unavailable' as const,
        exitCode: null,
        testSummary: { total: 0, passed: 0, failed: 0, failedNames: [] },
        stdoutHash: `sha256:${'0'.repeat(64)}`,
        stderrSummary: 'unavailable',
        durationMs: 0,
        policyVersion: 'p',
        runnerVersion: 'r',
        capabilities: subprocessSandboxBackend.capabilities,
      }),
    }
    const engine = new ExerciseEngine({
      challenge,
      pack,
      sandbox: unavailable,
      forge,
      equivalence: behaviorFirstEquivalenceGrader,
      detection: catalogDetectionGrader,
      knownGoodSource: KNOWN_GOOD,
    })
    const result = await engine.run('steering', CORRECT_CRITIQUE)
    expect(result.completionState).toBe('unavailable')
  })
})

describe('teacher trust-domain call-graph scans (FID-2026-0813-020)', () => {
  const teacherRoot = path.join(import.meta.dir, '..')

  test('sandbox child runner is builtins-only with no cross-package imports', () => {
    const source = fs.readFileSync(
      path.join(teacherRoot, 'sandbox', 'runner.ts'),
      'utf8',
    )
    expect(source).not.toContain('@savant-code/')
    expect(source).not.toContain("from '../")
    expect(source).not.toContain('require(')
  })

  test('common/teacher contracts have no agent-runtime dependency', () => {
    const commonTeacher = path.join(
      import.meta.dir,
      '../../../../../common/src/teacher',
    )
    const files = fs
      .readdirSync(commonTeacher)
      .filter((name) => name.endsWith('.ts'))
    for (const file of files) {
      const source = fs.readFileSync(path.join(commonTeacher, file), 'utf8')
      // Check the actual import specifier, not prose that explains the
      // dependency direction in comments.
      expect(source).not.toMatch(/from\s+['"]@savant-code\/agent-runtime['"]/)
      expect(source).not.toMatch(/from\s+['"]agent-runtime['"]/)
      expect(source).not.toMatch(
        /import\s*\(\s*['"]@savant-code\/agent-runtime['"]/,
      )
    }
  })

  test('exercise/corpus/grading/progression modules import only the public teacher index', () => {
    // The sandbox backend is the only module allowed to spawn a subprocess.
    const engineSource = fs.readFileSync(
      path.join(teacherRoot, 'exercise', 'engine.ts'),
      'utf8',
    )
    expect(engineSource).not.toContain('node:child_process')
    expect(engineSource).not.toContain('Bun.spawn')

    const sandboxSource = fs.readFileSync(
      path.join(teacherRoot, 'sandbox', 'subprocess.ts'),
      'utf8',
    )
    expect(sandboxSource).toContain('node:child_process')
  })
})
