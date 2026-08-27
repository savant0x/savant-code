import { DESIGN_TOKEN_VARS } from './design-tokens.generated'

/**
 * Applies the materialized design-system custom properties onto the document
 * root (FID-2026-0820-010 Step 1). styles.css references var(--*) names only,
 * so re-theming the shell onto a different resolved contract is a data change,
 * never a CSS rewrite.
 */
export function applyDesignSystemTokens(
  root: HTMLElement = document.documentElement,
): void {
  for (const [name, value] of Object.entries(DESIGN_TOKEN_VARS)) {
    root.style.setProperty(name, value)
  }
}
