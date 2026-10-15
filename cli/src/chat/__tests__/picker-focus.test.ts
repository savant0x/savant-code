// Regression suite for FID-2026-0907-001 — the picker focus transition.
// Pins the contract consumed by useChatPickers' focus effect: blur while any
// picker overlay is open, restore exactly once on the close transition (via
// Escape, backdrop click, or select — the dismissal path is what leaked focus
// before the fix), and never fire on mount or steady-state closed renders.

import { describe, expect, test } from 'bun:test'

import { pickerFocusAction } from '../picker-focus-transition'

describe('pickerFocusAction (FID-2026-0907-001)', () => {
  test('blur while any picker is open', () => {
    expect(pickerFocusAction(true, false)).toBe('blur')
    expect(pickerFocusAction(true, true)).toBe('blur')
  })

  test('restore on the close transition after an open (dismissal path)', () => {
    // Escape / backdrop / select all collapse to the same store transition:
    // was-open → all-closed. The dismissal leak was the missing restore here.
    expect(pickerFocusAction(false, true)).toBe('restore')
  })

  test('no-op on mount and steady-state closed renders', () => {
    expect(pickerFocusAction(false, false)).toBe('none')
  })

  test('full open→close→open→close cycle restores on every close', () => {
    let wasOpen = false
    // open
    expect(pickerFocusAction(true, wasOpen)).toBe('blur')
    wasOpen = true
    // close (Escape)
    expect(pickerFocusAction(false, wasOpen)).toBe('restore')
    wasOpen = false
    // reopen
    expect(pickerFocusAction(true, wasOpen)).toBe('blur')
    wasOpen = true
    // close again (select)
    expect(pickerFocusAction(false, wasOpen)).toBe('restore')
  })

  test('reopen without an intervening close stays in blur', () => {
    // Model picker opens while provider picker closes in one commit —
    // anyOpen is still true, so no restore fires mid-swap.
    expect(pickerFocusAction(true, true)).toBe('blur')
  })

  test('contract is total over the boolean domain', () => {
    for (const open of [false, true]) {
      for (const wasOpen of [false, true]) {
        const action = pickerFocusAction(open, wasOpen)
        expect(['blur', 'restore', 'none']).toContain(action)
      }
    }
  })
})
