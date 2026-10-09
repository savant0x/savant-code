import { contrastRatio } from '@savant-code/design-systems'
import { useMemo } from 'react'

import { useTheme } from '../hooks/use-theme'

import type { ChatTheme } from '../types/theme-system'

/** Preserve semantic accents where readable; choose an existing token otherwise. */
export function readableSidebarColor(theme: ChatTheme, color: string): string {
  const score = (candidate: string) =>
    Math.min(
      contrastRatio(candidate, theme.surface),
      contrastRatio(candidate, theme.surfaceHover),
    )
  const candidates = [
    color,
    theme.foreground,
    theme.onPrimary,
    theme.primary,
    theme.muted,
  ]
  return (
    candidates.find((candidate) => score(candidate) >= 4.5) ??
    candidates.reduce(
      (best, candidate) => (score(candidate) > score(best) ? candidate : best),
      color,
    )
  )
}

export function useSidebarTheme(): ChatTheme {
  const theme = useTheme()
  return useMemo(
    () => ({
      ...theme,
      foreground: readableSidebarColor(theme, theme.foreground),
      muted: readableSidebarColor(theme, theme.muted),
      primary: readableSidebarColor(theme, theme.primary),
      warning: readableSidebarColor(theme, theme.warning),
      error: readableSidebarColor(theme, theme.error),
      success: readableSidebarColor(theme, theme.success),
    }),
    [theme],
  )
}
