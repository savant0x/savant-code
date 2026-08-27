import React from 'react'

import { renderMarkdown } from '../../../utils/markdown-renderer'

import type { ChatTheme } from '../../../types/theme-system'
import type { ReactNode } from 'react'

/**
 * FID-2026-0824-029 — conservative rich-text gate for structured-card string
 * leaves. A string routes through the shared markdown formatter only when it
 * carries document structure: any newline, a code fence, or a line starting
 * with block-level markdown syntax.
 *
 * Deliberately NOT `hasMarkdown()` — that regex fires on bare `-`/`+`/`_`
 * anywhere (`a-b`, `snake_case`), which would flip trivial scalars onto the
 * block layout. Inline-only markers (`*bold*`, `` `tick` ``) intentionally do
 * NOT qualify.
 */
const BLOCK_SYNTAX = /^[ \t]*(#{1,6} |>|[-*+] |\d+\. )/m

export function isRichTextCandidate(value: string): boolean {
  return (
    value.includes('\n') || value.includes('```') || BLOCK_SYNTAX.test(value)
  )
}

interface RichTextValueProps {
  /** Leaf value; non-strings always render the fallback untouched. */
  value: unknown
  theme: ChatTheme
  /** Exact legacy node for the plain path (keeps today's bytes stable). */
  fallback: ReactNode
}

/**
 * Renders a structured string leaf through the one true markdown renderer
 * (`utils/markdown-renderer.tsx`, ChatTheme-aware, internally error-safe);
 * anything else falls back to the caller's legacy node so plain scalars keep
 * their current styling, including BOLD (converged FID decision).
 */
export function RichTextValue({
  value,
  theme,
  fallback,
}: RichTextValueProps): ReactNode {
  if (typeof value !== 'string' || !isRichTextCandidate(value)) {
    return <>{fallback}</>
  }
  return (
    <box style={{ flexDirection: 'column', flexGrow: 1 }}>
      {renderMarkdown(value, { theme })}
    </box>
  )
}
