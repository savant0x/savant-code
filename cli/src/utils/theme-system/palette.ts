import type {
  ChatTheme,
  MarkdownHeadingLevel,
  ThemeName,
} from '../../types/theme-system'
import type { MarkdownPalette } from '../markdown-renderer'

const DEFAULT_CHAT_THEMES: Record<ThemeName, ChatTheme> = {
  dark: {
    name: 'dark',
    // Core semantic colors — Savant Cyberpunk palette
    primary: '#18faf9', // Cyan — max contrast on near-black
    secondary: '#18faf9', // Cyan — unified with primary for Savant branding
    success: '#39ff14', // Neon green — high-energy completion
    error: '#ff2d55', // Neon red — Apple system red
    warning: '#ff9500', // Neon orange — warm alert, distinct from yellow
    info: '#18faf9', // Same as primary for consistency
    link: '#3B82F6',
    directory: '#9CA3AF',

    // Neutral scale — neutral near-black grays (NO navy/slate — operator
    // directive 2026-08-16: the navy family was pre-fork Freebuff branding;
    // Savant is near-black + cyan only)
    foreground: '#e4e4e8', // Neutral off-white — high contrast on near-black
    background: '#050508', // Deep void — never inherit the host terminal canvas
    muted: '#8f8f99', // Neutral gray — readable muted text on deep void
    border: '#20202a', // Neutral dark border — subtle, no blue cast
    surface: '#0b0b11', // Near-black surface — slightly lighter than bg
    surfaceHover: '#14141c', // Near-black hover lift

    // Context-specific
    aiLine: '#5c5c66', // Neutral muted gray
    userLine: '#18faf9', // Cyan — user messages

    // Agent backgrounds
    agentToggleHeaderBg: '#f97316',
    agentToggleExpandedBg: '#1d4ed8',
    agentFocusedBg: '#14141c', // Neutral near-black
    agentContentBg: '#07070b', // Neutral near-black
    inputFg: '#e4e4e8', // Neutral off-white
    inputFocusedFg: '#ffffff',

    // Mode toggles
    modeFastBg: '#f97316',
    modeFastText: '#f97316',
    modeMaxBg: '#dc2626',
    modeMaxText: '#dc2626',
    modePlanBg: '#1e40af',
    modePlanText: '#1e40af',

    // Phase colors (FID-009 Loop 5) — ADVERSARIAL gets its own identity
    phaseAdversarial: '#c084fc', // Violet-400 — distinct from RED/GREEN/AUDIT/COMPLETE

    // Image card
    imageCardBorder: '#5c5c66', // Neutral gray

    // Diff colors (FID-033a) — preserved from prior diff-viewer DIFF_LINE_COLORS.dark
    diffAdded: '#7ACC35', // Soft green — was hardcoded in diff-viewer.tsx
    diffRemoved: '#BF6C69', // Muted red — was hardcoded in diff-viewer.tsx
    diffContext: '#e4e4e8', // Neutral off-white — unchanged lines use foreground
    diffHunkHeader: '#18faf9', // Cyan — was 'cyan' literal in diff-viewer.tsx
    diffMeta: '#8f8f99', // Neutral gray — was theme.muted in diff-viewer.tsx

    // Muted diff-bar fills (FID-2026-0822-007) — consumed by
    // implementor-file-stats.tsx bars. Dark: preserved from the prior
    // hardcoded #3A5A3A/#5A3A3A; light: pastel equivalents so dark
    // foreground text stays readable on the light canvas.
    diffBarAdded: '#3A5A3A',
    diffBarRemoved: '#5A3A3A',

    // Text on the primary fill (FID-2026-0822-007) — focused ask-user
    // options, project-picker Open button. Black reads on both the dark
    // cyan (#18faf9) and light cyan-600 (#0891b2, 5.76:1 passes AA).
    onPrimary: '#000000',

    // Scrollbar tokens (FID-2026-0823-002) — cyan thumb on the void track,
    // byte-identical to the transcript's established rendering. Consumed by
    // createChatScrollbarOptions for every vertical scrollbox app-wide.
    scrollbarThumb: '#18faf9',
    scrollbarTrack: '#050508',

    // Syntax highlighting tokens (FID-033a) — fed to OpenTUI SyntaxStyle.
    // Mapping pattern adapted from opencode-dev generateSyntax (theme/index.ts:556).
    syntaxComment: '#8f8f99', // Neutral gray — muted, matches textMuted convention
    syntaxKeyword: '#ffb000', // Amber — readable non-violet keyword accent
    syntaxFunction: '#60a5fa', // Blue-400 — ansiColors.blue equivalent
    syntaxVariable: '#e4e4e8', // Neutral off-white — foreground (variable = fg)
    syntaxString: '#4ade80', // Green-400 — ansiColors.green equivalent
    syntaxNumber: '#fbbf24', // Amber-400 — ansiColors.yellow equivalent
    syntaxType: '#22d3ee', // Cyan-400 — ansiColors.cyan equivalent
    syntaxOperator: '#22d3ee', // Cyan-400 — ansiColors.cyan equivalent

    // Markdown
    markdown: {
      codeBackground: '#111118', // Neutral near-black
      codeHeaderFg: '#8f8f99', // Neutral gray
      inlineCodeFg: '#22d3ee', // Cyan — distinct but on-brand inline-code accent
      codeTextFg: '#e4e4e8', // Neutral off-white
      headingFg: {
        1: '#18faf9', // Cyan
        2: '#18faf9',
        3: '#18faf9',
        4: '#18faf9',
        5: '#18faf9',
        6: '#18faf9',
      },
      listBulletFg: '#39ff14', // Neon green — semantic, non-violet list accent
      blockquoteBorderFg: '#20202a', // Neutral dark border
      blockquoteTextFg: '#e4e4e8', // Neutral off-white
      dividerFg: '#20202a', // Neutral dark border
      codeMonochrome: false,
    },
  },
  light: {
    name: 'light',
    // Core semantic colors — Neon Slate light palette
    primary: '#0891b2', // Cyan-600 — readable on white
    secondary: '#0891b2', // Cyan-600 — unified with primary for Savant branding
    success: '#059669', // Keep existing
    error: '#dc2626', // Red-600 — readable on white
    warning: '#d97706', // Amber-600 — readable on white
    info: '#0891b2', // Same as primary
    link: '#2563EB',
    directory: '#6B7280',

    // Neutral scale — neutral grays (no navy/slate — operator directive 2026-08-16)
    foreground: '#111114', // Neutral near-black
    background: '#ffffff', // Explicit light canvas; never inherit the host terminal
    muted: '#5c5c66', // Neutral gray — readable muted text on white
    border: '#d6d6dc', // Neutral light border
    surface: '#fafafa', // Neutral off-white surface
    surfaceHover: '#f3f3f5', // Neutral light hover

    // AI/User context
    aiLine: '#5c5c66', // Neutral gray
    userLine: '#0891b2', // Cyan-600

    // Agent context
    agentToggleHeaderBg: '#ea580c',
    agentToggleExpandedBg: '#1d4ed8',
    agentFocusedBg: '#f3f3f5', // Neutral light
    agentContentBg: '#ffffff',
    inputFg: '#111114', // Neutral near-black
    inputFocusedFg: '#000000',

    // Mode toggles
    modeFastBg: '#f97316',
    modeFastText: '#f97316',
    modeMaxBg: '#dc2626',
    modeMaxText: '#dc2626',
    modePlanBg: '#1e40af',
    modePlanText: '#1e40af',

    // Phase colors (FID-009 Loop 5) — ADVERSARIAL gets its own identity
    phaseAdversarial: '#7c3aed', // Violet-600 — readable on white

    // Image card
    imageCardBorder: '#5c5c66', // Neutral gray

    // Diff colors (FID-033a) — preserved from prior diff-viewer DIFF_LINE_COLORS.light
    diffAdded: '#4A9E1C', // Readable green on white — was hardcoded in diff-viewer.tsx
    diffRemoved: '#C53030', // Readable red on white — was hardcoded in diff-viewer.tsx
    diffContext: '#111114', // Neutral near-black — unchanged lines use foreground
    diffHunkHeader: '#0891b2', // Cyan-600 — light-mode primary
    diffMeta: '#5c5c66', // Neutral gray — muted

    // Muted diff-bar fills (FID-2026-0822-007) — light pastels so the dark
    // foreground numbers inside the bars stay readable on white.
    diffBarAdded: '#CDE6CD',
    diffBarRemoved: '#F2D0D0',

    // Text on the primary fill (FID-2026-0822-007) — black on cyan-600
    // (5.76:1, passes AA).
    onPrimary: '#000000',

    // Scrollbar tokens (FID-2026-0823-002) — cyan-600 thumb on the light
    // canvas. White-on-white track intentionally reproduces today's light
    // transcript rendering (invisible channel, visible thumb).
    scrollbarThumb: '#0891b2',
    scrollbarTrack: '#ffffff',

    // Syntax highlighting tokens (FID-033a) — light-mode readable equivalents.
    // Mapping pattern adapted from opencode-dev generateSyntax (theme/index.ts:556).
    syntaxComment: '#5c5c66', // Neutral gray — muted
    syntaxKeyword: '#b45309', // Amber-700 — readable non-violet keyword accent
    syntaxFunction: '#2563eb', // Blue-600 — readable blue on white
    syntaxVariable: '#111114', // Neutral near-black — foreground
    syntaxString: '#059669', // Emerald-600 — readable green on white
    syntaxNumber: '#d97706', // Amber-600 — readable yellow on white
    syntaxType: '#0891b2', // Cyan-600 — readable cyan on white
    syntaxOperator: '#0891b2', // Cyan-600 — readable cyan on white

    // Markdown
    markdown: {
      codeBackground: '#f3f3f5', // Neutral light
      codeHeaderFg: '#5c5c66', // Neutral gray
      inlineCodeFg: '#0e7490', // Cyan-700 — readable on white
      codeTextFg: '#111114', // Neutral near-black
      headingFg: {
        1: '#0891b2', // Cyan-600
        2: '#0891b2',
        3: '#0891b2',
        4: '#0891b2',
        5: '#0891b2',
        6: '#0891b2',
      },
      listBulletFg: '#047857', // Emerald-700 — readable semantic list accent
      blockquoteBorderFg: '#d6d6dc', // Neutral light border
      blockquoteTextFg: '#3f3f4a', // Neutral dark gray
      dividerFg: '#e5e5e8', // Neutral light gray
      codeMonochrome: false,
    },
  },
}

export const chatThemes = {
  dark: DEFAULT_CHAT_THEMES.dark,
  light: DEFAULT_CHAT_THEMES.light,
}

export const createMarkdownPalette = (theme: ChatTheme): MarkdownPalette => {
  const headingDefaults: Record<MarkdownHeadingLevel, string> = {
    1: theme.primary,
    2: theme.primary,
    3: theme.primary,
    4: theme.primary,
    5: theme.primary,
    6: theme.primary,
  }

  const overrides = theme.markdown?.headingFg ?? {}

  return {
    inlineCodeFg: theme.markdown?.inlineCodeFg ?? theme.foreground,
    codeBackground: theme.markdown?.codeBackground ?? theme.background,
    codeHeaderFg: theme.markdown?.codeHeaderFg ?? theme.secondary,
    headingFg: {
      ...headingDefaults,
      ...overrides,
    },
    listBulletFg: theme.markdown?.listBulletFg ?? theme.secondary,
    blockquoteBorderFg: theme.markdown?.blockquoteBorderFg ?? theme.secondary,
    blockquoteTextFg: theme.markdown?.blockquoteTextFg ?? theme.foreground,
    dividerFg: theme.markdown?.dividerFg ?? theme.secondary,
    codeTextFg: theme.markdown?.codeTextFg ?? theme.foreground,
    codeMonochrome: theme.markdown?.codeMonochrome ?? true,
    linkFg: theme.markdown?.linkFg ?? theme.link,
  }
}

/**
 * Clone a ChatTheme object to avoid mutations
 * Properly handles nested markdown configuration
 */
export const cloneChatTheme = (input: ChatTheme): ChatTheme => ({
  ...input,
  markdown: input.markdown
    ? {
        ...input.markdown,
        headingFg: input.markdown.headingFg
          ? { ...input.markdown.headingFg }
          : undefined,
      }
    : undefined,
})

/**
 * Resolve a theme color value with optional fallback
 * Returns undefined for 'default' values or empty strings
 */
export const resolveThemeColor = (
  color?: string,
  fallback?: string,
): string | undefined => {
  if (typeof color === 'string') {
    const normalized = color.trim().toLowerCase()
    if (normalized.length > 0 && normalized !== 'default') {
      return color
    }
  }

  if (fallback !== undefined) {
    return resolveThemeColor(fallback)
  }

  return undefined
}
