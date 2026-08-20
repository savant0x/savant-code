import { describe, expect, it } from 'bun:test'

import {
  validateHeadlessApproval,
  validateHeadlessClarity,
} from '../auto-headless'

describe('validateHeadlessApproval', () => {
  it('allows plan-only without an approval signal', () => {
    expect(
      validateHeadlessApproval({ planOnly: true, approve: false }),
    ).toEqual({ ok: true, mode: 'plan-only' })
  })

  it('rejects execution without an approval signal (fail closed)', () => {
    const result = validateHeadlessApproval({ approve: false, planOnly: false })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('--approve')
  })

  it('treats --plan-file + --approve as the reviewed-plan path', () => {
    expect(
      validateHeadlessApproval({
        approve: true,
        planFile: 'plan.md',
        planOnly: false,
      }),
    ).toEqual({ ok: true, mode: 'reviewed-plan' })
  })

  it('treats --approve alone as up-front trust', () => {
    expect(
      validateHeadlessApproval({ approve: true, planOnly: false }),
    ).toEqual({ ok: true, mode: 'upfront-trust' })
  })
})

describe('validateHeadlessClarity', () => {
  it('accepts a --spec', () => {
    expect(validateHeadlessClarity({ goal: 'x', spec: 'a spec' })).toEqual({
      ok: true,
    })
  })

  it('accepts a fully-specified goal', () => {
    expect(validateHeadlessClarity({ goal: 'g'.repeat(80) })).toEqual({
      ok: true,
    })
  })

  it('rejects an underspecified goal with no spec', () => {
    const result = validateHeadlessClarity({ goal: 'fix it' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('--spec')
  })
})
