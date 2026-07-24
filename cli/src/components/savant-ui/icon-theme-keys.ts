/**
 * Icon → Theme Token Mapping (FID-2026-0720-033b Phase B)
 *
 * Single source of truth for which ChatTheme color an `Icon` resolves to.
 * The `Icon` component (icon.tsx) takes a `ThemeColorKey` and calls
 * `resolveThemeColor(theme, key)` — never hardcoding hex (Law 13).
 */

import type { ChatTheme } from '../../types/theme-system'

/**
 * Subset of ChatTheme keys that are valid icon colors. Kept as a literal
 * union (not `keyof ChatTheme`) so callers get autocomplete over only the
 * color-bearing tokens, and so adding a non-color ChatTheme field cannot
 * accidentally become an accepted Icon color.
 */
export type ThemeColorKey =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'link'
  | 'directory'
  | 'foreground'
  | 'background'
  | 'muted'
  | 'border'
  | 'surface'
  | 'surfaceHover'
  | 'aiLine'
  | 'userLine'
  | 'inputFg'
  | 'inputFocusedFg'
  | 'imageCardBorder'
  | 'diffAdded'
  | 'diffRemoved'
  | 'diffContext'
  | 'diffHunkHeader'
  | 'diffMeta'
  | 'syntaxComment'
  | 'syntaxKeyword'
  | 'syntaxFunction'
  | 'syntaxString'
  | 'syntaxNumber'
  | 'syntaxVariable'
  | 'syntaxType'
  | 'syntaxOperator'

/**
 * Resolve a `ThemeColorKey` to its concrete hex/named color from a ChatTheme.
 *
 * Falls back to `theme.foreground` if the key is somehow absent on a custom
 * theme (defensive — DEFAULT_CHAT_THEMES always populates every key). Never
 * throws (Law 14: cosmetic color resolution must not crash the UI).
 */
export const resolveThemeColor = (
  theme: ChatTheme,
  key: ThemeColorKey,
): string => {
  const value = theme[key]
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  return theme.foreground
}
