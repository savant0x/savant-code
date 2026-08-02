import { useTheme } from '../../hooks/use-theme'

/** Design tokens for the Savant-UI component library. */
export const tokens = {
  spacing: { xs: 1, sm: 2, md: 3, lg: 4, xl: 6 },
  borders: {
    single: 'single' as const,
    rounded: 'rounded' as const,
    none: 'none' as const,
  },
  colors: {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    muted: '#6b7280',
    primary: '#18faf9',
    surface: '#0f172a',
  },
  badges: {
    open: { fg: '#18faf9' },
    closed: { fg: '#22c55e' },
    critical: { fg: '#ef4444' },
    high: { fg: '#f59e0b' },
    medium: { fg: '#3b82f6' },
    low: { fg: '#6b7280' },
  },
  phase: {
    idle: { fg: '#6b7280', label: 'IDLE' },
    red: { fg: '#ef4444', label: 'RED' },
    green: { fg: '#22c55e', label: 'GREEN' },
    audit: { fg: '#eab308', label: 'AUDIT' },
    self_correct: { fg: '#f97316', label: 'FIX' },
    complete: { fg: '#06b6d4', label: 'DONE' },
  },
} as const

/** Hook that returns theme-aware tokens. */
export function useTokens() {
  const theme = useTheme()
  return {
    ...tokens,
    theme,
  }
}
