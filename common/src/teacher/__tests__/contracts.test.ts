/**
 * Teacher contract validation — FID-2026-0813-012.
 *
 * Proves the trust-boundary guards reject malformed payloads (child-process
 * results, persisted attempts, packs) instead of trusting them structurally.
 */
import { describe, expect, test } from 'bun:test'

import {
  parseCritiqueGrade,
  parsePrivateChallengePack,
  parsePublicChallenge,
  parseSandboxResult,
} from '../parse'

import type { PublicChallenge, PrivateChallengePack } from '../challenge'
import type { MutationContract } from '../mutation'
import type { SandboxResult } from '../sandbox'

const HASH = 'sha256:' + 'a'.repeat(64)

function publicChallenge(
  overrides: Partial<PublicChallenge> = {},
): PublicChallenge {
  return {
    id: 'js-reverse',
    version: 1,
    skill: 'js-strings',
    objective:
      'Write a function that reverses a string and handles edge cases.',
    prompt: 'Implement reverse(input).',
    visibleGuidance: 'Consider empty input, whitespace, and unicode.',
    inputContract: {
      signature: 'reverse(input: string): string',
      examples: ['abc'],
    },
    outputContract: { description: 'The reversed string.', examples: ['cba'] },
    limits: { timeLimitMs: 5000, maxOutputBytes: 64 * 1024 },
    prerequisites: [],
    challengeHash: HASH,
    ...overrides,
  }
}

function mutation(): MutationContract {
  return {
    mutationId: 'm1',
    skillTarget: 'js-strings',
    changedBehavior: 'Fails to reverse the final character.',
    surface: 'reverse',
    witness: "reverse('abc') === 'cba'",
    impact: 'Wrong output for every non-empty input.',
    severity: 'high',
    acceptableConcepts: ['off-by-one', 'skips last character'],
    patch: { find: 'return', replace: 'return ' },
    hiddenFromVisibleTests: true,
    graderVersion: '1',
  }
}

function privatePack(
  overrides: Partial<PrivateChallengePack> = {},
): PrivateChallengePack {
  return {
    challengeHash: HASH,
    knownGoodHash: HASH,
    hiddenTests: '// hidden tests',
    mutationContracts: [mutation()],
    critiqueRubric: {
      concepts: ['off-by-one'],
      requiredEvidence: ['location', 'witness', 'impact'],
    },
    gradingVersion: '1',
    ...overrides,
  }
}

function sandboxResult(): SandboxResult {
  return {
    status: 'passed',
    exitCode: 0,
    testSummary: { total: 3, passed: 3, failed: 0, failedNames: [] },
    stdoutHash: HASH,
    stderrSummary: '',
    durationMs: 12,
    policyVersion: '1',
    runnerVersion: '1',
    capabilities: {
      temp_workspace: 'enforced',
      no_project_access: 'not_enforced',
      no_corpus_access: 'not_enforced',
      no_home_access: 'not_enforced',
      no_network: 'not_enforced',
      stripped_environment: 'enforced',
      no_child_process: 'not_enforced',
      no_native_modules: 'not_enforced',
      output_cap: 'enforced',
      timeout: 'enforced',
      deterministic_runtime: 'enforced',
      path_traversal_containment: 'not_enforced',
      symlink_containment: 'not_enforced',
      cancellation: 'enforced',
      cleanup: 'enforced',
    },
  }
}

describe('teacher contracts — trust-boundary guards', () => {
  test('accepts a well-formed public challenge and private pack', () => {
    expect(parsePublicChallenge(publicChallenge()).id).toBe('js-reverse')
    expect(parsePrivateChallengePack(privatePack()).challengeHash).toBe(HASH)
  })

  test('rejects a public challenge with a malformed content hash', () => {
    expect(() =>
      parsePublicChallenge(publicChallenge({ challengeHash: 'not-a-hash' })),
    ).toThrow(/Invalid public challenge/)
  })

  test('rejects a sandbox result with an invalid status', () => {
    const result = sandboxResult()
    ;(result as { status: string }).status = 'exploded'
    expect(() => parseSandboxResult(result)).toThrow(/Invalid sandbox result/)
  })

  test('rejects a sandbox result missing a capability dimension', () => {
    const result = sandboxResult()
    const { cleanup: _cleanup, ...rest } = result.capabilities
    void _cleanup
    const malformed = { ...result, capabilities: rest }
    expect(() => parseSandboxResult(malformed)).toThrow(
      /Invalid sandbox result/,
    )
  })

  test('rejects a critique grade with out-of-range confidence', () => {
    const grade = {
      mutationId: 'm1',
      identified: true,
      evidenceCoverage: { location: true, witness: true, impact: true },
      locationMatch: true,
      witnessMatch: true,
      impactMatch: true,
      confidence: 2,
      reasonCode: 'identified',
      graderVersion: '1',
    }
    expect(() => parseCritiqueGrade(grade)).toThrow(/Invalid critique grade/)
  })
})
