import { useTheme } from '../../hooks/use-theme'

import type { ChatTheme } from '../../types/theme-system'

/**
 * Canonical design tokens for the Savant-UI component library.
 *
 * Structural tokens (spacing, borders) are theme-independent and live on the
 * exported `tokens` constant. Color tokens resolve from the active `ChatTheme`
 * via `useTokens()` — the theme system (`types/theme-system.ts` + `palette.ts`
 * + the design-system adapters in `theme-config.ts`) is the single source of
 * truth for color, so this module never hardcodes hex (Law 13; EHEL
 * design-contract scanner).
 */

/** Theme-independent spacing scale (OpenTUI layout units). */
export const tokens = {
  spacing: { xs: 1, sm: 2, md: 3, lg: 4, xl: 6 },
  borders: {
    single: 'single' as const,
    rounded: 'rounded' as const,
    none: 'none' as const,
  },
} as const

/** Semantic color roles resolvable from a ChatTheme. */
export type SemanticColorToken =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'link'
  | 'foreground'
  | 'background'
  | 'muted'
  | 'border'
  | 'surface'
  | 'surfaceHover'

export type SemanticColors = Record<SemanticColorToken, string>

/** Resolve the canonical semantic color roles from the active theme. */
export function resolveSemanticColors(theme: ChatTheme): SemanticColors {
  return {
    primary: theme.primary,
    secondary: theme.secondary,
    success: theme.success,
    error: theme.error,
    warning: theme.warning,
    info: theme.info,
    link: theme.link,
    foreground: theme.foreground,
    background: theme.background,
    muted: theme.muted,
    border: theme.border,
    surface: theme.surface,
    surfaceHover: theme.surfaceHover,
  }
}

export type BadgeSeverity =
  'open' | 'closed' | 'critical' | 'high' | 'medium' | 'low'

/** Severity badges resolved from semantic theme colors (no hardcoded hex). */
export function resolveBadgeColors(
  theme: ChatTheme,
): Record<BadgeSeverity, { fg: string }> {
  return {
    open: { fg: theme.primary },
    closed: { fg: theme.success },
    critical: { fg: theme.error },
    high: { fg: theme.warning },
    medium: { fg: theme.info },
    low: { fg: theme.muted },
  }
}

export type PhaseTokenKey =
  'idle' | 'red' | 'green' | 'audit' | 'self_correct' | 'complete'

/**
 * FSM phase colors, aligned with the canonical mapping in
 * `savant-ui/echo/phase-info.ts` (idle→muted, red→error, green→success,
 * audit/self_correct→warning, complete→primary).
 */
export function resolvePhaseTokens(
  theme: ChatTheme,
): Record<PhaseTokenKey, { fg: string; label: string }> {
  return {
    idle: { fg: theme.muted, label: 'IDLE' },
    red: { fg: theme.error, label: 'RED' },
    green: { fg: theme.success, label: 'GREEN' },
    audit: { fg: theme.warning, label: 'AUDIT' },
    self_correct: { fg: theme.warning, label: 'FIX' },
    complete: { fg: theme.primary, label: 'DONE' },
  }
}

export interface SavantTokens {
  spacing: typeof tokens.spacing
  borders: typeof tokens.borders
  colors: SemanticColors
  badges: ReturnType<typeof resolveBadgeColors>
  phase: ReturnType<typeof resolvePhaseTokens>
  theme: ChatTheme
}

/** Hook that returns theme-aware tokens for the active theme. */
export function useTokens(): SavantTokens {
  const theme = useTheme()
  return {
    spacing: tokens.spacing,
    borders: tokens.borders,
    colors: resolveSemanticColors(theme),
    badges: resolveBadgeColors(theme),
    phase: resolvePhaseTokens(theme),
    theme,
  }
}
