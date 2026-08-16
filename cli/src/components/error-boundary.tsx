import { Component, type ReactNode } from 'react'

import { logger } from '../utils/logger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode | ((error: Error) => ReactNode)
  componentName?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * A real React error boundary (class component, FID-2026-0815-015).
 *
 * Catches render/lifecycle errors in its subtree and renders `fallback`
 * instead of letting the error escape to the process-level
 * `uncaughtException` handler — which would otherwise kill the whole terminal
 * session.
 *
 * The previous `ErrorBoundary` here was a no-op passthrough because OpenTUI's
 * JSX types were believed to reject class components. The current JSX namespace
 * declares `ElementClass extends React.Component`, so class boundaries are
 * supported at runtime and by the type checker.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error): void {
    logger.error(
      {
        componentName: this.props.componentName ?? 'ErrorBoundary',
        error: error instanceof Error ? error.message : String(error),
      },
      'Render error caught by error boundary',
    )
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      const { fallback } = this.props
      return typeof fallback === 'function'
        ? fallback(this.state.error)
        : fallback
    }
    return this.props.children
  }
}

/**
 * Helper to safely render content with error handling in a functional context.
 */
export function withErrorFallback<T>(
  renderFn: () => T,
  fallback: T,
  componentName?: string,
): T {
  try {
    return renderFn()
  } catch (error) {
    logger.error(
      {
        componentName: componentName ?? 'withErrorFallback',
        error: error instanceof Error ? error.message : String(error),
      },
      'Error caught in withErrorFallback',
    )
    return fallback
  }
}
