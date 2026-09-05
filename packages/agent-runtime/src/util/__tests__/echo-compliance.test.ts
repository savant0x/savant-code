/**
 * ECHO compliance tracker tests — FID-2026-0804-009.
 *
 * Pure evaluators (verification detection, security paths, new-API heuristic,
 * user-requested-review, Verifier criteria, file-kind classification) and the
 * provenance-ready write record. Tracker behavior (Law 1, Law 3, steering,
 * docs classification) lives in echo-compliance-*.test.ts siblings of the
 * Loop-344 decomposition.
 */

import { describe, expect, it } from 'bun:test'

import {
  EchoComplianceTracker,
  classifyFileKind,
  detectsVerificationCommand,
  hasNewApiDeclaration,
  isSecuritySensitivePath,
  meetsVerifierCriteria,
  userRequestedReview,
} from '../echo-compliance'

describe('EchoComplianceTracker — provenance-ready write record (FID-2026-0813-002)', () => {
  it('stores agent identity, phase, and law-check outcomes on the write record', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 5,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
      agentId: 'agent-1',
      agentType: 'forge',
      fsmPhase: 'green',
      lawChecks: [{ law: 7, outcome: 'advisory' }],
    })
    const writes = t.getWriteRecords()
    expect(writes).toHaveLength(1)
    expect(writes[0].agentId).toBe('agent-1')
    expect(writes[0].agentType).toBe('forge')
    expect(writes[0].fsmPhase).toBe('green')
    expect(writes[0].lawChecks).toEqual([{ law: 7, outcome: 'advisory' }])
  })

  it('resolves fidId exactly against the active-FID set', () => {
    const t = new EchoComplianceTracker({
      fidPaths: ['/proj/dev/fids/FID-2026-0813-001-ztap-provenance-master.md'],
    })
    t.recordWrite({
      path: '/proj/dev/fids/FID-2026-0813-001-ztap-provenance-master.md',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(t.getWriteRecords()[0].fidId).toBe('FID-2026-0813-001')
  })

  it('resolves fidId from the active FID directory rule as fallback', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/dev/fids/FID-2026-0813-004-ztap-write-boundary-interception.md',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(t.getWriteRecords()[0].fidId).toBe('FID-2026-0813-004')
  })

  it('leaves fidId undefined for non-FID writes', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/regular.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(t.getWriteRecords()[0].fidId).toBeUndefined()
  })

  it('does not break existing FID escalation when fields are absent', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/dev/fids/FID-2026-0813-001-ztap-provenance-master.md',
      lineDelta: 20,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'fid')).toBe(true)
  })
})

describe('detectsVerificationCommand', () => {
  it('detects typecheck / test / lint / build-verify commands', () => {
    expect(detectsVerificationCommand('bun run --cwd=common typecheck')).toBe(
      true,
    )
    expect(detectsVerificationCommand('bun test src/')).toBe(true)
    expect(detectsVerificationCommand('bun x eslint . --max-warnings 0')).toBe(
      true,
    )
    expect(detectsVerificationCommand('cargo check')).toBe(true)
    expect(detectsVerificationCommand('go test ./...')).toBe(true)
    expect(detectsVerificationCommand('npm run lint:md')).toBe(true)
  })

  it('does not flag non-verification commands', () => {
    expect(detectsVerificationCommand('git status')).toBe(false)
    expect(detectsVerificationCommand('ls -la')).toBe(false)
    expect(detectsVerificationCommand('cat README.md')).toBe(false)
    expect(detectsVerificationCommand('bun install')).toBe(false)
  })
})

describe('isSecuritySensitivePath', () => {
  it('flags auth/payment/credential/token paths', () => {
    expect(isSecuritySensitivePath('src/auth/login.ts')).toBe(true)
    expect(isSecuritySensitivePath('src/payment/checkout.ts')).toBe(true)
    expect(isSecuritySensitivePath('src/credentials.ts')).toBe(true)
    expect(isSecuritySensitivePath('.env')).toBe(true)
    expect(isSecuritySensitivePath('src/webhook/stripe.ts')).toBe(true)
  })

  it('does not flag ordinary paths', () => {
    expect(isSecuritySensitivePath('src/components/button.tsx')).toBe(false)
    expect(isSecuritySensitivePath('src/utils/format.ts')).toBe(false)
    expect(isSecuritySensitivePath('README.md')).toBe(false)
  })
})

describe('hasNewApiDeclaration', () => {
  it('flags export function / export const / class declarations', () => {
    expect(hasNewApiDeclaration('export function createUser() {}')).toBe(true)
    expect(hasNewApiDeclaration('export const handler = () => {}')).toBe(true)
    expect(hasNewApiDeclaration('class UserService {}')).toBe(true)
    expect(hasNewApiDeclaration('export interface User {}')).toBe(true)
  })

  it('does not flag ordinary code', () => {
    expect(hasNewApiDeclaration('const x = 1')).toBe(false)
    expect(hasNewApiDeclaration('console.log("hi")')).toBe(false)
  })
})

describe('userRequestedReview', () => {
  it('detects review/audit/verify requests in the prompt', () => {
    expect(userRequestedReview('please review my changes')).toBe(true)
    expect(userRequestedReview('audit the auth flow')).toBe(true)
    expect(userRequestedReview('add a login page')).toBe(false)
  })
})

describe('meetsVerifierCriteria', () => {
  it('triggers on 10+ lines, 2+ files, new API, security, Forge, or review request', () => {
    const base = {
      linesAdded: 0,
      filesTouched: 1,
      newApiHint: false,
      securitySensitive: false,
      forgeUsed: false,
      userRequestedReview: false,
    }
    expect(meetsVerifierCriteria({ ...base, linesAdded: 10 })).toBe(true)
    expect(meetsVerifierCriteria({ ...base, linesAdded: 9 })).toBe(false)
    expect(meetsVerifierCriteria({ ...base, filesTouched: 2 })).toBe(true)
    expect(meetsVerifierCriteria({ ...base, newApiHint: true })).toBe(true)
    expect(meetsVerifierCriteria({ ...base, securitySensitive: true })).toBe(
      true,
    )
    expect(meetsVerifierCriteria({ ...base, forgeUsed: true })).toBe(true)
    expect(meetsVerifierCriteria({ ...base, userRequestedReview: true })).toBe(
      true,
    )
    expect(meetsVerifierCriteria(base)).toBe(false)
  })
})

describe('classifyFileKind (FID-2026-0814-004 H-03)', () => {
  it('classifies markdown and harness doc directories as docs', () => {
    expect(classifyFileKind('/proj/dev/scratchpad/report.md')).toBe('docs')
    expect(classifyFileKind('/proj/docs/design/ztap.md')).toBe('docs')
    expect(classifyFileKind('/proj/CHANGELOG.md')).toBe('docs')
    expect(classifyFileKind('/proj/dev/session-summaries/2026-08-14.md')).toBe(
      'docs',
    )
    expect(classifyFileKind('/proj/dev/test-prompts/az.md')).toBe('docs')
  })

  it('keeps source paths as code, including markdown under a source tree', () => {
    expect(classifyFileKind('/proj/src/a.ts')).toBe('code')
    expect(classifyFileKind('/proj/src/docs/helper.ts')).toBe('code')
    expect(classifyFileKind('/proj/packages/x/src/a.ts')).toBe('code')
  })
})
