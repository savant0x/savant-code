// ECHO compliance tracker — Law 3 (verify-after-write) cumulative behavior,
// the mechanical Verifier-criteria flag, FID escalation, and steering
// budgeting. Sibling of the Loop-344 decomposition (parent:
// echo-compliance.test.ts).
import { describe, expect, it } from 'bun:test'

import { EchoComplianceTracker } from '../echo-compliance'

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

  it('is cumulative: passes when verification ran between writes (FID-2026-0819-001)', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 10,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.recordVerification('bun test src/')
    t.recordWrite({
      path: '/proj/src/b.ts',
      lineDelta: 10,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.recordVerification('bun run typecheck')
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    expect(violations.some((v) => v.law === 'law3')).toBe(false)
  })

  it('is cumulative: flags only the unverified later write (FID-2026-0819-001)', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 10,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.recordVerification('bun test src/')
    t.recordWrite({
      path: '/proj/src/b.ts',
      lineDelta: 10,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    const law3 = violations.find((v) => v.law === 'law3')
    expect(law3).toBeDefined()
    expect(law3!.message).toContain('/proj/src/b.ts')
    expect(law3!.message).not.toContain('/proj/src/a.ts')
  })

  it('flags both writes when no verification runs (FID-2026-0819-001)', () => {
    const t = new EchoComplianceTracker()
    t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 10,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    t.recordWrite({
      path: '/proj/src/b.ts',
      lineDelta: 10,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    const violations = t.evaluateAtStepBoundary({
      stepNumber: 1,
      endingTurn: true,
    })
    const law3 = violations.find((v) => v.law === 'law3')
    expect(law3).toBeDefined()
    expect(law3!.message).toContain('/proj/src/a.ts')
    expect(law3!.message).toContain('/proj/src/b.ts')
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
