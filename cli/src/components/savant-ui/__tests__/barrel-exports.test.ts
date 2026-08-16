import { describe, expect, test } from 'bun:test'

import * as savantUi from '../index'

describe('savant-ui barrel governance exports (FID-2026-0813-009/022)', () => {
  test('exports the trust matrix component and its pure reducer', () => {
    expect(savantUi.TrustMatrix).toBeDefined()
    expect(typeof savantUi.reduceTrustMatrixEvents).toBe('function')
  })

  test('exports the learn overlay component and its pure reducer', () => {
    expect(savantUi.LearnOverlay).toBeDefined()
    expect(typeof savantUi.reduceLearnState).toBe('function')
  })

  test('reducers stay pure data functions with no control callbacks', () => {
    // Arity guards against smuggled control-channel parameters: the display
    // reducers take exactly the event/challenge inputs and nothing else.
    expect(savantUi.reduceTrustMatrixEvents.length).toBe(1)
    expect(savantUi.reduceLearnState.length).toBe(2)
  })
})
