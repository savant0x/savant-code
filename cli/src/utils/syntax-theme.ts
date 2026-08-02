/**
 * SyntaxStyle Integration (FID-2026-0730-033a Phase A)
 *
 * Maps ChatTheme syntax-highlighting tokens to OpenTUI's `ThemeTokenStyle[]`
 * and produces a `SyntaxStyle` for use by `CodeRenderable` and `DiffRenderable`
 * in Phase C. Mapping pattern adapted from opencode-dev's `generateSyntax`
 * (resources/opencode-dev/packages/tui/src/theme/index.ts:556, MIT licensed).
 *
 * Tree-sitter scope categories follow the TextMate scope convention used by
 * OpenTUI's `convertThemeToStyles` (resources/opentui-main/packages/core/src/syntax-style.ts).
 */

import { SyntaxStyle, type ThemeTokenStyle } from '@opentui/core'

import { logger } from './logger'

import type { ChatTheme } from '../types/theme-system'

/**
 * Build the tree-sitter scope -> style mapping for a given ChatTheme.
 *
 * Scopes are grouped by category and follow TextMate conventions so that
 * OpenTUI's `SyntaxStyle.getStyle(name)` (which falls back to the base name
 * before the first `.` for scoped styles) resolves correctly.
 */
const buildSyntaxTokenStyles = (theme: ChatTheme): ThemeTokenStyle[] => {
  const foreground = theme.foreground

  return [
    {
      scope: [
        'comment',
        'comment.block',
        'comment.line',
        'comment.documentation',
      ],
      style: { foreground: theme.syntaxComment, dim: true },
    },
    {
      scope: [
        'keyword',
        'keyword.control',
        'keyword.declaration',
        'keyword.return',
        'storage.type',
        'storage.modifier',
      ],
      style: { foreground: theme.syntaxKeyword, bold: true },
    },
    {
      scope: ['entity.name.function', 'support.function', 'meta.function-call'],
      style: { foreground: theme.syntaxFunction },
    },
    {
      scope: ['string', 'string.quoted', 'string.unquoted', 'string.regexp'],
      style: { foreground: theme.syntaxString },
    },
    {
      scope: ['constant.numeric', 'constant.language', 'constant.character'],
      style: { foreground: theme.syntaxNumber },
    },
    {
      scope: ['variable', 'variable.parameter', 'meta.variable'],
      style: { foreground: theme.syntaxVariable || foreground },
    },
    {
      scope: [
        'entity.name.type',
        'entity.name.class',
        'entity.name.interface',
        'support.type',
      ],
      style: { foreground: theme.syntaxType },
    },
    {
      scope: ['keyword.operator', 'punctuation', 'punctuation.separator'],
      style: { foreground: theme.syntaxOperator || foreground },
    },
  ]
}

/**
 * Cached empty `SyntaxStyle` used as the last-resort fallback when
 * `SyntaxStyle.fromTheme()` throws on malformed token input. Created once at
 * module load inside its own try/catch so that a token-conversion failure
 * never propagates into a TUI crash (Law 14, FID-033a Error Handling —
 * "never crash the TUI for a cosmetic feature").
 *
 * Note: if the native render lib itself is totally unavailable, the entire
 * OpenTUI renderer is unavailable and the TUI cannot boot — so a throw at
 * that point is acceptable (it is not a cosmetic-feature failure, it is a
 * total-renderer-absence condition). This cache covers the partial-failure
 * case (bad tokens) which is the Law 14-relevant scenario.
 */
let emptySyntaxStyleFallback: SyntaxStyle | null = null
try {
  emptySyntaxStyleFallback = SyntaxStyle.create()
} catch {
  emptySyntaxStyleFallback = null
}

/**
 * Create an OpenTUI `SyntaxStyle` from a Savant `ChatTheme`.
 *
 * Consumers (Phase C `CodeRenderable` / `DiffRenderable` wrappers) call this
 * once per theme change and cache the resulting `SyntaxStyle` handle. If the
 * native render lib is unavailable or the conversion throws, we degrade to an
 * empty `SyntaxStyle` so code blocks render as plain text — never a crash
 * (Law 14, FID-033a Error Handling).
 *
 * Law 4 (call-graph reachability): the production consumer of this export is
 * the Phase C `CodeRenderable`/`DiffRenderable` integration (see Master FID
 * dependency graph 033a → 033c). Phase A ships the foundational export +
 * tokens; Phase C wires the renderable consumers. This deferral is documented
 * in FID-033a Loop 5 AUDIT.
 */
export const createSyntaxStyle = (theme: ChatTheme): SyntaxStyle => {
  try {
    const tokenStyles = buildSyntaxTokenStyles(theme)
    return SyntaxStyle.fromTheme(tokenStyles)
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
        themeName: theme.name,
      },
      'createSyntaxStyle failed — falling back to empty SyntaxStyle (plain text code blocks)',
    )
    return emptySyntaxStyleFallback ?? SyntaxStyle.create()
  }
}
