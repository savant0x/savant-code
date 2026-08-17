import type { DesignSystemResource } from './types'

export type ThemeMode = 'dark' | 'light'
export type MarkdownHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface DesignSystemMarkdownOverrides {
  codeBackground?: string
  codeHeaderFg?: string
  inlineCodeFg?: string
  codeTextFg?: string
  headingFg?: Partial<Record<MarkdownHeadingLevel, string>>
  listBulletFg?: string
  blockquoteBorderFg?: string
  blockquoteTextFg?: string
  dividerFg?: string
  linkFg?: string
}

export interface DesignSystemThemeOverrides {
  primary?: string
  secondary?: string
  success?: string
  error?: string
  warning?: string
  info?: string
  link?: string
  foreground?: string
  background?: string
  muted?: string
  border?: string
  surface?: string
  surfaceHover?: string
  aiLine?: string
  userLine?: string
  inputFg?: string
  inputFocusedFg?: string
  diffAdded?: string
  diffRemoved?: string
  diffContext?: string
  diffHunkHeader?: string
  diffMeta?: string
  syntaxComment?: string
  syntaxKeyword?: string
  syntaxFunction?: string
  syntaxString?: string
  syntaxNumber?: string
  syntaxVariable?: string
  syntaxType?: string
  syntaxOperator?: string
  markdown?: DesignSystemMarkdownOverrides
}

type ColorMap = Record<string, string>

const FALLBACKS = {
  primary: '#18faf9',
  secondary: '#18faf9',
  success: '#39ff14',
  error: '#ff2d55',
  warning: '#ff9500',
  info: '#18faf9',
  foreground: '#e4e4e8',
  background: '#050508',
  muted: '#8f8f99',
  border: '#20202a',
  surface: '#0b0b11',
  surfaceHover: '#14141c',
  link: '#3b82f6',
  syntaxKeyword: '#ffb000',
  inlineCodeFg: '#22d3ee',
  listBulletFg: '#39ff14',
} as const

function readModeColors(
  resource: DesignSystemResource,
  mode: ThemeMode,
): ColorMap | undefined {
  const modeColors = resource.tokens.extensions.colorsByMode
  if (
    !modeColors ||
    typeof modeColors !== 'object' ||
    Array.isArray(modeColors)
  ) {
    return undefined
  }

  const candidate = (modeColors as Record<string, unknown>)[mode]
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(candidate).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

function color(
  colors: ColorMap,
  key: string,
  fallback?: string,
): string | undefined {
  const candidate = colors[key]
  if (typeof candidate === 'string' && /^#[0-9a-f]{3,8}$/i.test(candidate)) {
    return candidate
  }
  return fallback
}

function addColor(
  target: Record<string, string>,
  key: string,
  value: string | undefined,
): void {
  if (value !== undefined) target[key] = value
}

/**
 * Map canonical semantic tokens onto ChatTheme.
 * Dark resources use their canonical colors. Light resources use only their
 * explicit `tokens.extensions.colorsByMode.light` values so missing variants
 * cannot clobber the base light theme.
 */
export function designSystemThemeOverrides(
  resource: DesignSystemResource,
  mode: ThemeMode = 'dark',
): DesignSystemThemeOverrides {
  const colors =
    mode === 'dark' ? resource.tokens.colors : readModeColors(resource, mode)
  if (!colors) return {}

  if (mode === 'light') {
    const overrides: DesignSystemThemeOverrides = {}
    const markdown: Record<string, string> = {}
    const keys = [
      'primary',
      'secondary',
      'success',
      'error',
      'warning',
      'info',
      'link',
      'foreground',
      'background',
      'muted',
      'border',
      'surface',
      'surfaceHover',
      'aiLine',
      'userLine',
      'inputFg',
      'inputFocusedFg',
      'diffAdded',
      'diffRemoved',
      'diffContext',
      'diffHunkHeader',
      'diffMeta',
      'syntaxComment',
      'syntaxKeyword',
      'syntaxFunction',
      'syntaxString',
      'syntaxNumber',
      'syntaxVariable',
      'syntaxType',
      'syntaxOperator',
    ] as const
    for (const key of keys)
      addColor(overrides as Record<string, string>, key, color(colors, key))
    const markdownKeys = [
      'codeBackground',
      'codeHeaderFg',
      'inlineCodeFg',
      'codeTextFg',
      'listBulletFg',
      'blockquoteBorderFg',
      'blockquoteTextFg',
      'dividerFg',
      'linkFg',
    ] as const
    for (const key of markdownKeys) addColor(markdown, key, color(colors, key))
    const headingFg: Partial<Record<MarkdownHeadingLevel, string>> = {}
    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      const value = color(colors, `headingFg${level}`)
      if (value) headingFg[level] = value
    }
    if (Object.keys(headingFg).length > 0) {
      overrides.markdown = { headingFg }
    }
    if (Object.keys(markdown).length > 0) {
      overrides.markdown = { ...overrides.markdown, ...markdown }
    }
    return overrides
  }

  const primary = color(colors, 'primary', FALLBACKS.primary)
  const secondary = color(colors, 'secondary', FALLBACKS.secondary)
  const foreground = color(colors, 'foreground', FALLBACKS.foreground)
  const muted = color(colors, 'muted', FALLBACKS.muted)
  const surface = color(colors, 'surface', FALLBACKS.surface)
  const border = color(colors, 'border', FALLBACKS.border)
  return {
    primary,
    secondary,
    success: color(colors, 'success', FALLBACKS.success),
    error: color(colors, 'error', FALLBACKS.error),
    warning: color(colors, 'warning', FALLBACKS.warning),
    info: color(colors, 'info', primary),
    link: color(colors, 'link', FALLBACKS.link),
    foreground,
    background: color(colors, 'background', FALLBACKS.background),
    muted,
    border,
    surface,
    surfaceHover: color(colors, 'surfaceHover', surface),
    aiLine: color(colors, 'aiLine', muted),
    userLine: color(colors, 'userLine', primary),
    inputFg: foreground,
    inputFocusedFg: foreground,
    diffAdded: color(colors, 'diffAdded', FALLBACKS.success),
    diffRemoved: color(colors, 'diffRemoved', FALLBACKS.error),
    diffContext: foreground,
    diffHunkHeader: primary,
    diffMeta: muted,
    syntaxComment: muted,
    syntaxKeyword: color(colors, 'syntaxKeyword', FALLBACKS.syntaxKeyword),
    syntaxFunction: color(colors, 'syntaxFunction', primary),
    syntaxString: color(colors, 'syntaxString', FALLBACKS.success),
    syntaxNumber: color(colors, 'syntaxNumber', FALLBACKS.warning),
    syntaxVariable: foreground,
    syntaxType: color(colors, 'syntaxType', primary),
    syntaxOperator: color(colors, 'syntaxOperator', primary),
    markdown: {
      headingFg: {
        1: primary,
        2: primary,
        3: primary,
        4: primary,
        5: primary,
        6: primary,
      },
      codeBackground: surface,
      codeHeaderFg: muted,
      codeTextFg: foreground,
      inlineCodeFg: color(colors, 'inlineCodeFg', FALLBACKS.inlineCodeFg),
      listBulletFg: color(colors, 'listBulletFg', FALLBACKS.listBulletFg),
      blockquoteBorderFg: border,
      blockquoteTextFg: foreground,
      dividerFg: border,
      linkFg: color(colors, 'link', primary),
    },
  }
}
