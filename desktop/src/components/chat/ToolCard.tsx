// FID-2026-0820-010 Loop 3 — structured tool-call card (inputs/outputs as
// transcript blocks, never a terminal emulator).

import { memo, useMemo, useState } from 'react'

import { DiffBlock } from './DiffBlock'
import { VerificationBlock } from './VerificationBlock'
import { parseDiffInput } from '../../lib/diff-parse'
import { parseVerificationOutput } from '../../lib/verification-output'

import type { ChatBlock } from '../../state/transcript-store'
import type { JSX } from 'react'

type ToolBlock = Extract<ChatBlock, { kind: 'tool' }>

const PREVIEW_MAX_CHARS = 2000

function clampPreview(text: string | null): string | null {
  if (text === null) return null
  return text.length > PREVIEW_MAX_CHARS
    ? `${text.slice(0, PREVIEW_MAX_CHARS)}…`
    : text
}

export const ToolCard = memo(function ToolCard({
  block,
}: {
  block: ToolBlock
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const diff = useMemo(
    () => parseDiffInput(block.toolName, block.inputJson),
    [block.toolName, block.inputJson],
  )
  const shownInput = clampPreview(block.inputJson)
  const shownOutput = clampPreview(block.outputText)
  const verification = parseVerificationOutput(block.toolName, block.outputText)
  return (
    <section className={`tool-card${block.done ? '' : ' tool-card-running'}`}>
      <button
        type="button"
        className="tool-card-head"
        onClick={() => {
          setExpanded((value) => !value)
        }}
      >
        <span
          className={`tool-dot ${block.done ? 'dot-done' : 'dot-run'}`}
          aria-hidden="true"
        />
        <span className="tool-name">{block.toolName}</span>
        <span className="tool-toggle" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded ? (
        <div className="tool-body">
          {/* Edit-class tools render their structured input as a real diff
              (Step 4); everything else keeps the raw JSON view. */}
          {diff !== null ? (
            <>
              <div className="tool-label">diff</div>
              <DiffBlock payload={diff} />
            </>
          ) : shownInput === null ? null : (
            <>
              <div className="tool-label">input</div>
              <pre className="tool-pre">{shownInput}</pre>
            </>
          )}
          {verification !== null ? (
            <>
              <div className="tool-label">verification</div>
              <VerificationBlock entries={verification} />
            </>
          ) : shownOutput === null ? null : (
            <>
              <div className="tool-label">output</div>
              <pre className="tool-pre">{shownOutput}</pre>
            </>
          )}
        </div>
      ) : null}
    </section>
  )
})
