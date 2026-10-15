import type {
  ChatTheme,
  MarkdownHeadingLevel,
  MarkdownThemeOverrides,
  ThemeName,
} from '../../types/theme-system'

type ChatThemeOverrides = Partial<Omit<ChatTheme, 'markdown'>> & {
  markdown?: MarkdownThemeOverrides
}

type ThemeOverrideConfig = Partial<Record<ThemeName, ChatThemeOverrides>> & {
  all?: ChatThemeOverrides
}

const mergeMarkdownOverrides = (
  base: MarkdownThemeOverrides | undefined,
  override: MarkdownThemeOverrides | undefined,
): MarkdownThemeOverrides | undefined => {
  if (!base && !override) return undefined
  if (!override)
    return base
      ? {
          ...base,
          headingFg: base.headingFg ? { ...base.headingFg } : undefined,
        }
      : undefined

  const mergedHeading = {
    ...(base?.headingFg ?? {}),
    ...(override.headingFg ?? {}),
  }

  return {
    ...(base ?? {}),
    ...override,
    headingFg:
      Object.keys(mergedHeading).length > 0
        ? (mergedHeading as Partial<Record<MarkdownHeadingLevel, string>>)
        : undefined,
  }
}

const mergeTheme = (
  base: ChatTheme,
  override?: ChatThemeOverrides,
): ChatTheme => {
  if (!override) {
    return {
      ...base,
      markdown: base.markdown
        ? {
            ...base.markdown,
            headingFg: base.markdown.headingFg
              ? { ...base.markdown.headingFg }
              : undefined,
          }
        : undefined,
    }
  }

  return {
    ...base,
    ...override,
    markdown: mergeMarkdownOverrides(base.markdown, override.markdown),
  }
}

export const parseThemeOverrides = (
  raw: string,
): Partial<Record<ThemeName, ChatThemeOverrides>> => {
  try {
    const parsed = JSON.parse(raw) as ThemeOverrideConfig
    if (!parsed || typeof parsed !== 'object') return {}

    const result: Partial<Record<ThemeName, ChatThemeOverrides>> = {}
    const common =
      typeof parsed.all === 'object' && parsed.all ? parsed.all : undefined

    for (const themeName of ['dark', 'light'] as ThemeName[]) {
      const specific =
        typeof parsed?.[themeName] === 'object' && parsed?.[themeName]
          ? parsed?.[themeName]
          : undefined

      const mergedOverrides =
        common || specific
          ? {
              ...(common ?? {}),
              ...(specific ?? {}),
              markdown: mergeMarkdownOverrides(
                common?.markdown,
                specific?.markdown,
              ),
            }
          : undefined

      if (mergedOverrides) {
        result[themeName] = mergedOverrides
      }
    }

    return result
  } catch {
    return {}
  }
}

/**
 * Merge theme overrides with a base theme
 * Alias for mergeTheme to match our hook API
 */
export const mergeThemeOverrides = mergeTheme
