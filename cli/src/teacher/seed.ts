/**
 * Bundled teacher seed corpus — the CLI's default exercise set.
 *
 * The seed is authored as a versioned, reviewable `CorpusSource` (the same
 * schema the build-time pipeline consumes) and validated at module load so a
 * malformed edit fails loudly instead of shipping a broken exercise. The
 * public challenge is learner/Forge-visible; `knownGoodSource`, `hiddenTests`,
 * and `mutationContracts` are private pack material that never reach the
 * learner or the UI.
 */
import { parseCorpusSource } from '@savant-code/agent-runtime/teacher/index'

import type {
  ChallengeSource,
  CorpusSource,
} from '@savant-code/agent-runtime/teacher/index'

const RAW_SEED: CorpusSource = {
  corpusVersion: 'teacher-seed-v1',
  skills: [
    {
      id: 'behavioral-invariants',
      label: 'Behavioral invariants',
      description:
        'Steering an agent toward code whose observable behavior matches a contract across edge cases, not just the visible examples.',
      outcomes: [
        {
          id: 'bi-1',
          statement:
            'Direct a Forge to satisfy a function contract on hidden cases.',
          measuredBy: 'equivalence',
        },
        {
          id: 'bi-2',
          statement:
            'Detect a seeded behavioral defect from its observable surface.',
          measuredBy: 'detection',
        },
      ],
    },
  ],
  challenges: [
    {
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
      knownGoodSource: `
function max(a, b) { return a > b ? a : b }
`,
      hiddenTests: `
recordTest('positive', () => max(1, 2) === 2)
recordTest('negative', () => max(-1, -2) === -1)
recordTest('equal', () => max(5, 5) === 5)
`,
      mutationContracts: [
        {
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
        },
      ],
      critiqueRubric: {
        concepts: [
          'comparison',
          'greater',
          'larger',
          'flipped',
          'wrong direction',
        ],
        requiredEvidence: ['location', 'witness'],
      },
      gradingVersion: 'teacher-grading-v1',
    },
  ],
}

/** Validate and return the bundled seed (throws on a malformed edit). */
export function getSeedCorpus(): CorpusSource {
  return parseCorpusSource(RAW_SEED)
}

/** The default challenge for `/learn start` (V1: the single seed exercise). */
export function getSeedChallenge(): ChallengeSource {
  const corpus = getSeedCorpus()
  const challenge = corpus.challenges[0]
  if (!challenge) throw new Error('Teacher seed corpus has no challenges')
  return challenge
}
