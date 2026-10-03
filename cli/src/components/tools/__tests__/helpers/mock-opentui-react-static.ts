import { afterAll, mock } from 'bun:test'

/**
 * FID-2026-0822-005: static-render fallback for `@opentui/react` context
 * hooks. TrafficLights mounts `useAnimationBudget`, which consumes
 * `useFocus`/`useBlur`/`useRenderer`/`useTerminalDimensions` from
 * `@opentui/react`; under `react-dom/server` no opentui renderer exists and
 * `useRenderer()` throws "Renderer not found", fataling every static-markup
 * test that renders boxed content. These inert stubs are TEST-ONLY —
 * production code is never modified for testability (FID decision 5).
 *
 * Scope guard (FID-2026-1003-006 verification finding): bun's `mock.module`
 * is sticky for the whole test process, and a bare four-export replacement
 * poisoned later suites — model-picker-scroll rendered under the inert
 * `useTerminalDimensions` stub (80 columns instead of the 60-column test
 * renderer), so its vertical scrollbar sat outside the clickable area and
 * `wheel and scrollbar move through the full catalog` failed only when an
 * earlier file had used this mock. The mock therefore spreads over the real
 * module (surface-complete: no vanishing exports for later importers) and
 * `afterAll` restores the real exports for every subsequent file.
 */
const realOpentuiReact = { ...(await import('@opentui/react')) }

export function mockOpentuiReactForStaticRender(): void {
  mock.module('@opentui/react', () => ({
    ...realOpentuiReact,
    useBlur: (_callback: () => void) => undefined,
    useFocus: (_callback: () => void) => undefined,
    useRenderer: () => ({
      requestLive: () => undefined,
      dropLive: () => undefined,
    }),
    useTerminalDimensions: () => ({ width: 80, height: 24 }),
  }))
  afterAll(() => {
    mock.module('@opentui/react', () => realOpentuiReact)
  })
}
