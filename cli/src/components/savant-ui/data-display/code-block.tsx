/**
 * CodeBlock — native OpenTUI CodeRenderable wrapper (FID-2026-0720-033c Phase C)
 *
 * Wires the Phase A `createSyntaxStyle()` utility to OpenTUI's native
 * `<code>` JSX element, providing tree-sitter syntax highlighting driven by
 * the active ChatTheme's syntax tokens. The `SyntaxStyle` is memoized per
 * theme change to avoid re-creating the handle on every render.
 *
 * Law 4 (call-graph reachability): this component is the production consumer
 * of `createSyntaxStyle` (closes the Phase A Law 4 deferral documented in
 * cli/src/utils/syntax-theme.ts).
 *
 * Law 14 (error paths): `createSyntaxStyle` already degrades to an empty
 * `SyntaxStyle` (plain-text fallback) on conversion failure — never crashes
 * the TUI for a cosmetic feature.
 */

import { TextAttributes } from '@opentui/core'
import { useMemo } from 'react'

import { useTheme } from '../../../hooks/use-theme'
import { createSyntaxStyle } from '../../../utils/syntax-theme'

export interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const theme = useTheme()
  const syntaxStyle = useMemo(() => createSyntaxStyle(theme), [theme])

  return (
    <box flexDirection="column">
      {language && (
        <text fg={theme.muted} attributes={TextAttributes.DIM}>
          {language}
        </text>
      )}
      <box
        border={true}
        borderStyle="rounded"
        borderColor={theme.border}
        paddingLeft={1}
        paddingRight={1}
      >
        <code
          content={code}
          filetype={language ?? 'text'}
          syntaxStyle={syntaxStyle}
        />
      </box>
    </box>
  )
}
