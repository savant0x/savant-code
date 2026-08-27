import { mock } from 'bun:test'

/**
 * FID-2026-0822-005: static-render fallback for `@opentui/react` context
 * hooks. TrafficLights mounts `useAnimationBudget`, which consumes
 * `useFocus`/`useBlur`/`useRenderer`/`useTerminalDimensions` from
 * `@opentui/react`; under `react-dom/server` no opentui renderer exists and
 * `useRenderer()` throws "Renderer not found", fataling every static-markup
 * test that renders boxed content. These inert stubs are TEST-ONLY —
 * production code is never modified for testability (FID decision 5).
 */
export function mockOpentuiReactForStaticRender(): void {
  mock.module('@opentui/react', () => ({
    useBlur: (_callback: () => void) => undefined,
    useFocus: (_callback: () => void) => undefined,
    useRenderer: () => ({
      requestLive: () => undefined,
      dropLive: () => undefined,
    }),
    useTerminalDimensions: () => ({ width: 80, height: 24 }),
  }))
}
