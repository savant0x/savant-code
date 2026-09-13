import { describe, expect, test } from 'bun:test'

import {
  clearWizardReplayGuard,
  isWizardSubmissionReplayed,
  markWizardSubmissionConsumed,
} from '../../utils/provider-wizard'

/**
 * The wizard submission replay guard (FID-2026-0910-004 Loop 9;
 * FID-2026-0913-002 split from provider-add-wizard.test.ts — a guard family
 * with its own unit seams, separate from the machine and router pins).
 */
describe('wizard submission replay guard (FID-2026-0910-004 Loop 9)', () => {
  test('marks a submission and drops its identical replay within the TTL', () => {
    clearWizardReplayGuard()
    markWizardSubmissionConsumed('gw-tui-secret')
    expect(isWizardSubmissionReplayed('gw-tui-secret')).toBe(true)
    // A different submission is never dropped.
    expect(isWizardSubmissionReplayed('different-submit')).toBe(false)
  })

  test('a non-wizard payload (slash command) is never tombstoned', () => {
    clearWizardReplayGuard()
    markWizardSubmissionConsumed('/provider list')
    expect(isWizardSubmissionReplayed('/provider list')).toBe(false)
  })

  test('the tombstone expires after the TTL (replay outside the window passes)', () => {
    // Injected clock (DI over module mocking): no fake timers needed.
    const t0 = 1_000_000
    clearWizardReplayGuard()
    markWizardSubmissionConsumed('gw-tui-secret', t0)
    expect(isWizardSubmissionReplayed('gw-tui-secret', t0 + 500)).toBe(true)
    clearWizardReplayGuard()
    markWizardSubmissionConsumed('gw-tui-secret', t0)
    expect(isWizardSubmissionReplayed('gw-tui-secret', t0 + 1_500)).toBe(false)
  })

  test('cleanup clears the tombstone', () => {
    clearWizardReplayGuard()
    markWizardSubmissionConsumed('gw-tui-secret')
    clearWizardReplayGuard()
    expect(isWizardSubmissionReplayed('gw-tui-secret')).toBe(false)
  })
})
