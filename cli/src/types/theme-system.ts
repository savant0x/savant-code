export type ThemeName = 'dark' | 'light'

export type MarkdownHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

// ThemeColor is always a resolved color string (never 'default' or undefined)
export type ThemeColor = string

export interface MarkdownThemeOverrides {
  codeBackground?: string
  codeHeaderFg?: string
  inlineCodeFg?: string
  codeTextFg?: string
  headingFg?: Partial<Record<MarkdownHeadingLevel, string>>
  listBulletFg?: string
  blockquoteBorderFg?: string
  blockquoteTextFg?: string
  dividerFg?: string
  codeMonochrome?: boolean
  linkFg?: string
}

/**
 * Semantic Color Theme Interface
 * Inspired by Tailwind - uses semantic color roles instead of specific names
 * This makes theming easier and more intuitive
 */
export interface ChatTheme {
  /** Theme identifier ('dark' or 'light') */
  name: ThemeName
  // ============================================================================
  // CORE SEMANTIC COLORS
  // ============================================================================

  /** Primary brand color - main actions, highlights, important elements */
  primary: string

  /** Secondary brand color - supporting elements, less emphasis */
  secondary: string

  /** Success color - checkmarks, completed states, positive feedback */
  success: string

  /** Error/danger color - errors, destructive actions, failures */
  error: string

  /** Warning color - cautions, alerts, validation issues */
  warning: string

  /** Info color - informational elements, hints */
  info: string

  /** Link color - hyperlinks, clickable references */
  link: string

  /** Directory color - folder/directory paths */
  directory: string

  // ============================================================================
  // NEUTRAL SCALE
  // ============================================================================

  /** Default text color */
  foreground: ThemeColor

  /** Base background color */
  background: string

  /** Subdued/secondary text color */
  muted: ThemeColor

  /** Border and divider color */
  border: string

  /** Surface color for panels, cards, chrome */
  surface: string

  /** Hover state for interactive surfaces */
  surfaceHover: string

  // ============================================================================
  // CONTEXT-SPECIFIC COLORS (Minimal - most use semantic colors)
  // ============================================================================

  // AI/User differentiation
  /** AI message indicator line color */
  aiLine: string

  /** User message indicator line color */
  userLine: string

  // Agent backgrounds (specific states that don't map to semantics)
  /** Agent toggle header background */
  agentToggleHeaderBg: string

  /** Agent toggle expanded background */
  agentToggleExpandedBg: string

  /** Agent focused background */
  agentFocusedBg: string

  /** Agent content background */
  agentContentBg: string
  /** Input text color */
  inputFg: ThemeColor

  /** Focused input text color */
  inputFocusedFg: ThemeColor

  // Mode toggles (distinct UI elements)
  /** Fast mode toggle background */
  modeFastBg: string

  /** Fast mode toggle text */
  modeFastText: string

  /** Max mode toggle background */
  modeMaxBg: string

  /** Max mode toggle text */
  modeMaxText: string

  /** Plan mode toggle background */
  modePlanBg: string

  /** Plan mode toggle text */
  modePlanText: string

  // ============================================================================
  // PHASE COLORS (ECHO Perfection Loop)
  // Distinct identity for the ADVERSARIAL phase so it no longer shares RED's
  // `error` color in the transition bar / sidebar (FID-2026-0816-009 Loop 5).
  // ============================================================================

  /** ADVERSARIAL phase color — violet, distinct from RED/GREEN/AUDIT/COMPLETE */
  phaseAdversarial: string

  // ============================================================================
  // IMAGE CARD
  // ============================================================================

  /** Image card border color */
  imageCardBorder: string

  // ============================================================================
  // DIFF COLORS (FID-033a)
  // Powers diff-viewer.tsx and DiffRenderable in Phase C.
  // ============================================================================

  /** Added line color (lines starting with `+`) */
  diffAdded: string

  /** Removed line color (lines starting with `-`) */
  diffRemoved: string

  /** Context (unchanged) line color */
  diffContext: string

  /** Muted background fill for the added-lines bar (implementor-file-stats) */
  diffBarAdded: string

  /** Muted background fill for the removed-lines bar (implementor-file-stats) */
  diffBarRemoved: string

  /** Text color on the primary fill (focused ask-user options, Open button) */
  onPrimary: string

  /** Scrollbar thumb color (FID-2026-0823-002) — every vertical scrollbox */
  scrollbarThumb: string

  /** Scrollbar track/channel color (FID-2026-0823-002) */
  scrollbarTrack: string

  /** Hunk header color (lines starting with `@@`) */
  diffHunkHeader: string

  /** Meta line color (`diff `, `index `, `---`, `+++` headers) */
  diffMeta: string

  // ============================================================================
  // SYNTAX HIGHLIGHTING TOKENS (FID-033a)
  // Tree-sitter scope -> color mappings fed to OpenTUI SyntaxStyle.
  // See cli/src/utils/syntax-theme.ts createSyntaxStyle().
  // ============================================================================

  /** Comment / doc text scope */
  syntaxComment: string

  /** Keyword scope (if, for, return, const, etc.) */
  syntaxKeyword: string

  /** Function name scope */
  syntaxFunction: string

  /** String literal scope */
  syntaxString: string

  /** Numeric literal scope */
  syntaxNumber: string

  /** Variable identifier scope */
  syntaxVariable: string

  /** Type / class / interface scope */
  syntaxType: string

  /** Operator / punctuation scope */
  syntaxOperator: string

  // ============================================================================
  // MARKDOWN
  // ============================================================================

  /** Markdown-specific styling */
  markdown?: MarkdownThemeOverrides

  /** Text attributes (bold, dim, etc.) */
  messageTextAttributes?: number
}
