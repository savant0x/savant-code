// FID-2026-0901-006 — sequential-thinking renderer (CLI parity).
//
// The CLI renders each `sequentialthinking` step as a "💭 Thought N/M"
// markdown card. The desktop showed raw JSON. This renders the extracted
// thought body inline, so the Thinker's reasoning is readable as it streams.

import { memo } from 'react'

import { MarkdownBlock } from './MarkdownBlock'

import type { ThinkingPayload } from '../../lib/thinking-parse'
import type { JSX } from 'react'

export const ThinkingBlock = memo(function ThinkingBlock({
  payload,
}: {
  readonly payload: ThinkingPayload
}): JSX.Element {
  return (
    <div className="thinking-block">
      <div className="thinking-label">{payload.label}</div>
      <MarkdownBlock text={payload.markdown} />
    </div>
  )
})
