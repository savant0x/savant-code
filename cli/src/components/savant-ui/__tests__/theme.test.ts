import { describe, expect, test } from 'bun:test'

import { chatThemes } from '../../../utils/theme-system/palette'
import {
  resolveBadgeColors,
  resolvePhaseTokens,
  resolveSemanticColors,
  tokens,
} from '../theme'

describe('Savant-UI canonical tokens', () => {
  const theme = chatThemes.dark

  test('structural tokens are theme-independent', () => {
    expect(tokens.spacing).toEqual({ xs: 1, sm: 2, md: 3, lg: 4, xl: 6 })
    expect(tokens.borders.single).toBe('single')
    expect(tokens.borders.rounded).toBe('rounded')
    expect(tokens.borders.none).toBe('none')
  })

  test('semantic colors resolve from the active ChatTheme', () => {
    const colors = resolveSemanticColors(theme)
    expect(colors.primary).toBe(theme.primary)
    expect(colors.secondary).toBe(theme.secondary)
    expect(colors.success).toBe(theme.success)
    expect(colors.error).toBe(theme.error)
    expect(colors.warning).toBe(theme.warning)
    expect(colors.info).toBe(theme.info)
    expect(colors.foreground).toBe(theme.foreground)
    expect(colors.background).toBe(theme.background)
    expect(colors.muted).toBe(theme.muted)
    expect(colors.border).toBe(theme.border)
    expect(colors.surface).toBe(theme.surface)
    expect(colors.surfaceHover).toBe(theme.surfaceHover)
  })

  test('badge colors derive from semantic theme roles, not hardcoded hex', () => {
    const badges = resolveBadgeColors(theme)
    expect(badges.open.fg).toBe(theme.primary)
    expect(badges.closed.fg).toBe(theme.success)
    expect(badges.critical.fg).toBe(theme.error)
    expect(badges.high.fg).toBe(theme.warning)
    expect(badges.medium.fg).toBe(theme.info)
    expect(badges.low.fg).toBe(theme.muted)
  })

  test('phase colors align with the canonical phase-info mapping', () => {
    const phases = resolvePhaseTokens(theme)
    expect(phases.idle).toEqual({ fg: theme.muted, label: 'IDLE' })
    expect(phases.red).toEqual({ fg: theme.error, label: 'RED' })
    expect(phases.green).toEqual({ fg: theme.success, label: 'GREEN' })
    expect(phases.audit).toEqual({ fg: theme.warning, label: 'AUDIT' })
    expect(phases.self_correct).toEqual({ fg: theme.warning, label: 'FIX' })
    expect(phases.complete).toEqual({ fg: theme.primary, label: 'DONE' })
  })
})
