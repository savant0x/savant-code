/**
 * Pure transition model for the picker-overlay focus effect
 * (FID-2026-0907-001). Extracted so the open/restore contract is
 * unit-testable — React 19 + Bun + RTL renderHook() is unreliable
 * (see hooks/__tests__/use-input-history-harness.ts), so the repo pattern
 * is a pure decision function consumed by the hook's effect.
 *
 * Contract (symmetric with the blur-on-open behavior):
 * - any picker open          → 'blur'    (input must not steal keystrokes)
 * - all closed, after an open→ 'restore' (close transition: Escape,
 *   backdrop click, or select — all must hand focus back to the input)
 * - all closed, never opened  → 'none'    (mount / steady state: no-op, so
 *   the effect never fights other focus owners like feedback or ask-user)
 */

export type PickerFocusAction = 'blur' | 'restore' | 'none'

export function pickerFocusAction(
  anyPickerOpen: boolean,
  wasAnyPickerOpen: boolean,
): PickerFocusAction {
  if (anyPickerOpen) return 'blur'
  return wasAnyPickerOpen ? 'restore' : 'none'
}
