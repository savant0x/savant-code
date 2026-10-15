// FID-2026-0820-010 Step 4 — native diff viewer block. Renders a parsed
// DiffPayload as hunk rows with added/removed tinting driven by the design
// contract tokens (--success/--error alpha tints) — never a terminal
// emulator, never raw hex.

import { memo } from 'react'

import type { DiffPayload } from '../../lib/diff-parse'
import type { JSX } from 'react'

const LINE_LIMIT = 800

function clampLines(payload: DiffPayload): {
  lines: DiffPayload['hunks'][number]['lines']
  truncated: boolean
} {
  const all = payload.hunks.flatMap((hunk) => hunk.lines)
  return {
    lines: all.length > LINE_LIMIT ? all.slice(0, LINE_LIMIT) : all,
    truncated: all.length > LINE_LIMIT,
  }
}

export const DiffBlock = memo(function DiffBlock({
  payload,
}: {
  payload: DiffPayload
}): JSX.Element {
  const { lines, truncated } = clampLines(payload)
  return (
    <div className="diff-block">
      {payload.path !== null ? (
        <div className="diff-path">{payload.path}</div>
      ) : null}
      <pre className="diff-body">
        {lines.map((line, index) => (
          <span key={index} className={`dl dl-${line.type}`}>
            {line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  '}
            {line.text}
            {'\n'}
          </span>
        ))}
        {truncated ? (
          <span className="dl dl-ctx">
            … diff truncated at {LINE_LIMIT} lines
          </span>
        ) : null}
      </pre>
    </div>
  )
})
