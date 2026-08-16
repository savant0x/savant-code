/**
 * ECHO compliance tracker tests — FID-2026-0804-009.
 *
 * Covers the pure evaluators (verification detection, security paths, new-API
 * heuristic, user-requested-review, Verifier criteria) and the tracker's
 * behavior: Law 1 read-before-write (read-then-write passes, write-without-read
 * flags, new files exempt, content-knowledge exempt), Law 3 verify-after-write,
 * the mechanical Verifier-criteria flag (10+ lines, 2+ files, security,
 * Forge-without-Verifier), FID escalation, and steering budgeting.
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

describe('EchoComplianceTracker — Law 1 (read-before-write)', () => {
  it('passes a write after the file was read', () => {
    const t = new EchoComplianceTracker()
    t.recordRead(['/proj/src/a.ts'])
    const v = t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 5,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })

  it('flags a write without a prior read', () => {
    const t = new EchoComplianceTracker()
    const v = t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 5,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).not.toBeNull()
    expect(v?.law).toBe('law1')
    expect(v?.severity).toBe('warning')
  })

  it('exempts brand-new files (cannot read what does not exist)', () => {
    const t = new EchoComplianceTracker()
    const v = t.recordWrite({
      path: '/proj/src/new.ts',
      lineDelta: 20,
      contentKnowledge: false,
      isNewFile: true,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })

  it('exempts content-knowledge writes (str_replace with exact oldString)', () => {
    const t = new EchoComplianceTracker()
    const v = t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 2,
      contentKnowledge: true,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })

  it('treats a directory read as covering writes beneath it', () => {
    const t = new EchoComplianceTracker()
    t.recordDirectoryRead('/proj/src')
    const v = t.recordWrite({
      path: '/proj/src/deep/nested/a.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })

  it('treats a search pattern as a weak read (substring, case/sep normalized)', () => {
    const t = new EchoComplianceTracker()
    t.recordPatternRead('AUTH')
    const v = t.recordWrite({
      path: '/proj/src/auth/login.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })

  it('keeps recording after the pattern window is saturated (bounded, no throw)', () => {
    const t = new EchoComplianceTracker()
    for (let i = 0; i < 1000; i += 1) {
      t.recordPatternRead(`needle-${i}`)
    }
    // A still-retained weak signal matches; a fresh write never throws.
    const retained = t.recordWrite({
      path: '/proj/src/needle-999/keep.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(retained).toBeNull()
    const unflagged = t.recordWrite({
      path: '/proj/src/unrelated.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(unflagged?.law).toBe('law1')
  })

  it('downgrades to info when the user prompt mentions the file', () => {
    const t = new EchoComplianceTracker({ userPrompt: 'update a.ts please' })
    const v = t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v?.severity).toBe('info')
  })

  it('is a no-op in off mode', () => {
    const t = new EchoComplianceTracker({ mode: 'off' })
    const v = t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })
})

describe('EchoComplianceTracker — Law 3 (verify-after-write)', () => {
  it('flags writes without a subsequent verification command at turn end', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 12,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'law3')).toBe(true)
  })

  it('passes when a verification command ran after the write', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 12,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.recordVerification('bun run --cwd=common typecheck')
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'law3')).toBe(false)
  })

  it('does not fire mid-batch (endingTurn false)', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 12,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: false,
    })
    expect(violations).toEqual([])
  })
})

describe('EchoComplianceTracker — Verifier criteria flag', () => {
  it('flags a 10+ line change without a Verifier or verification', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 10,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'verifier_criteria')).toBe(true)
  })

  it('flags a Forge-written change when the Verifier was never spawned', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 5,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.recordSpawn('forge')
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'verifier_criteria')).toBe(true)
  })

  it('suppresses the flag when the Verifier was spawned', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 50,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.recordSpawn('verifier')
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'verifier_criteria')).toBe(false)
  })

  it('suppresses the flag when verification evidence exists', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 50,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.recordVerification('bun test src/')
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'verifier_criteria')).toBe(false)
  })

  it('escalates to a fid-law warning when a write touches an active FID', () => {
    const t = new EchoComplianceTracker({
      fidPaths: ['/proj/dev/fids/FID-2026-0804-009-x.md'],
    })
    t.recordWrite({
      path: '/proj/dev/fids/FID-2026-0804-009-x.md',
      lineDelta: 2,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'fid')).toBe(true)
    const fid = violations.find((v) => v.law === 'fid')
    expect(fid?.fidId).toBe('FID-2026-0804-009')
  })
})

describe('EchoComplianceTracker — steering', () => {
  it('produces corrective steering for violations, budgeted', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 50,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.evaluateAtStepBoundary({ stepNumber: 1, endingTurn: true })
    const steering = t.takeSteeringMessages()
    expect(steering.length).toBeGreaterThan(0)
    expect(steering[0]).toContain('[ECHO compliance]')
  })

  it('does not re-emit the same violation twice (dedup)', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 50,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.evaluateAtStepBoundary({ stepNumber: 1, endingTurn: true })
    const first = t.takeSteeringMessages()
    // Same step re-evaluation returns the same pending set, but takeSteering
    // clears it, so a second drain is empty.
    t.evaluateAtStepBoundary({ stepNumber: 2, endingTurn: true })
    const second = t.takeSteeringMessages()
    expect(first.length).toBeGreaterThan(0)
    expect(second.length).toBe(0)
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

describe('EchoComplianceTracker — docs classification (FID-2026-0814-004 H-03)', () => {
  it('doc-only writes do not trigger Law 3 or Verifier criteria nags', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/dev/scratchpad/report.md',
      lineDelta: 50,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    // No Law 3 code nag, no verifier_criteria nag for a pure doc write.
    expect(violations.some((v) => v.law === 'verifier_criteria')).toBe(false)
    expect(violations.some((v) => v.law === 'fid')).toBe(false)
    const law3 = violations.filter((v) => v.law === 'law3')
    // The docs-appropriate info reminder may fire, but never the code nag.
    for (const v of law3) {
      expect(v.message).toContain('markdownlint')
      expect(v.severity).toBe('info')
    }
  })

  it('code writes still trigger Law 3 + Verifier criteria exactly as before', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 50,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'law3')).toBe(true)
    expect(violations.some((v) => v.law === 'verifier_criteria')).toBe(true)
  })

  it('running markdownlint clears a doc-only turn without a code nag', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/dev/scratchpad/report.md',
      lineDelta: 50,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.recordVerification('bun run lint:md')
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.filter((v) => v.law === 'law3')).toHaveLength(0)
    expect(violations.some((v) => v.law === 'verifier_criteria')).toBe(false)
  })
})
