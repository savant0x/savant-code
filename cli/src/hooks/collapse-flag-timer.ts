/**
 * FID-2026-1013-013 W4-6 — the tracked timer behind `isUserCollapsing`.
 *
 * `useChatMessages` used to call a bare `setTimeout(() => { isUserCollapsingRef
 * .current = false }, 0)` from both collapse handlers with no handle kept: two
 * rapid toggles raced (the first timer could clear the flag while the second
 * toggle's render was still settling) and unmounting left a dangling timer
 * writing into a dead ref. Taking the refs as arguments (rather than closing
 * over them inside the hook) is also what makes the behaviour pinnable in
 * `cli/src/hooks/__tests__/use-chat-messages-collapse.test.ts`.
 *
 * Split out of `./use-chat-messages` for the 300-line ceiling
 * (FID-2026-0913-002 convention); the hook re-exports nothing.
 */
export type CollapseTimerRef = { current: ReturnType<typeof setTimeout> | null }
export type FlagRef = { current: boolean }

/** Arm the flag reset, replacing any timer still pending from an earlier toggle. */
export function scheduleCollapseFlagReset(
  timerRef: CollapseTimerRef,
  flagRef: FlagRef,
): void {
  if (timerRef.current !== null) clearTimeout(timerRef.current)
  timerRef.current = setTimeout(() => {
    timerRef.current = null
    flagRef.current = false
  }, 0)
}

/** Drop a pending reset (unmount) so nothing writes into a dead ref. */
export function clearCollapseFlagReset(timerRef: CollapseTimerRef): void {
  if (timerRef.current === null) return
  clearTimeout(timerRef.current)
  timerRef.current = null
}
