/**
 * FID-2026-0815-015 (F-1) — the real class-based error boundary contract.
 *
 * react-dom/server's renderToStaticMarkup does not invoke error boundaries
 * during SSR (React explicitly does not catch render errors there), and the
 * CLI has no DOM/jsdom. So this test asserts the two React error-boundary
 * contract methods directly: getDerivedStateFromError captures the error, and
 * render() swaps to `fallback` once an error is captured. That is the exact
 * behavior that lets react-reconciler contain a render error instead of
 * letting it escape to the process-level uncaughtException handler.
 */
import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ErrorBoundary, withErrorFallback } from '../error-boundary'

describe('ErrorBoundary (FID-2026-0815-015)', () => {
  test('getDerivedStateFromError captures the error for React', () => {
    const err = new Error('boom')
    expect(ErrorBoundary.getDerivedStateFromError(err)).toEqual({ error: err })
  })

  test('render returns children in the normal (no-error) state', () => {
    const boundary = new ErrorBoundary({
      children: <text>child</text>,
      fallback: <text>fallback</text>,
      componentName: 'TestBoundary',
    })
    const markup = renderToStaticMarkup(<>{boundary.render()}</>)
    expect(markup).toContain('child')
    expect(markup).not.toContain('fallback')
  })

  test('render swaps to fallback once an error is captured', () => {
    const boundary = new ErrorBoundary({
      children: <text>child</text>,
      fallback: <text>fallback</text>,
      componentName: 'TestBoundary',
    })
    boundary.state = { error: new Error('boom') }
    const markup = renderToStaticMarkup(<>{boundary.render()}</>)
    expect(markup).toContain('fallback')
    expect(markup).not.toContain('child')
  })

  test('render supports a function fallback that receives the error', () => {
    const boundary = new ErrorBoundary({
      children: <text>child</text>,
      fallback: (error: Error) => <text>{error.message}</text>,
      componentName: 'TestBoundary',
    })
    boundary.state = { error: new Error('boom-message') }
    const markup = renderToStaticMarkup(<>{boundary.render()}</>)
    expect(markup).toContain('boom-message')
  })
})

describe('withErrorFallback (FID-2026-0815-015)', () => {
  test('returns the rendered value on success', () => {
    expect(withErrorFallback(() => 'ok', 'fallback')).toBe('ok')
  })

  test('returns the fallback when the render fn throws', () => {
    expect(
      withErrorFallback(
        () => {
          throw new Error('boom')
        },
        'fallback',
        'TestBoundary',
      ),
    ).toBe('fallback')
  })
})
