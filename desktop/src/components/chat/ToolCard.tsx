// FID-2026-0820-010 Loop 3 — structured tool-call card (inputs/outputs as
// transcript blocks, never a terminal emulator).

import { memo, useMemo, useState } from 'react'

import { CopyButton } from './CopyButton'
import { DiffBlock } from './DiffBlock'
import { FollowupCards, parseFollowups } from './FollowupCards'
import {
  parseReadUrlItem,
  parseSkillItem,
  parseWebSearchItem,
  type SimpleToolItem,
} from './simple-tool-items'
import { ThinkingBlock } from './ThinkingBlock'
import { TodosBlock } from './TodosBlock'
import { diffStats, toolCopyText, toolHasCopyButton } from './tool-copy'
import { toolCollapsedPreview, toolDisplayName } from './tool-display'
import { TrafficLights } from './TrafficLights'
import { VerificationBlock } from './VerificationBlock'
import { parseDiffInput } from '../../lib/diff-parse'
import { parseThinkingInput } from '../../lib/thinking-parse'
import { parseTodosInput, todosPreview } from '../../lib/todos-parse'
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
  onSendFollowup,
}: {
  block: ToolBlock
  /** FID-2026-0901-006: click a suggested followup → send it as a prompt. */
  onSendFollowup?: (prompt: string) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const diff = useMemo(
    () => parseDiffInput(block.toolName, block.inputJson),
    [block.toolName, block.inputJson],
  )
  // FID-2026-0901-006 P14: whole-file writes render a compact summary (the
  // CLI's FID-2026-0823-006 treatment) instead of a full-file all-additions
  // diff wall; str_replace keeps its real per-line diff.
  const isWholeFileWrite =
    block.toolName === 'write_file' &&
    !diff?.hunks.some((hunk) => hunk.lines.some((line) => line.type === 'del'))
  const shownInput = isWholeFileWrite ? null : clampPreview(block.inputJson)
  const shownOutput = clampPreview(block.outputText)
  const verification = parseVerificationOutput(block.toolName, block.outputText)
  // P14: the compact write summary line — `Write <path> (N lines)` — shown in
  // place of the full-file diff wall when the card is expanded.
  const writeSummary = isWholeFileWrite
    ? toolCollapsedPreview('write_file', block.inputJson, null)
    : null
  // P15: CopyableBlock parity — right-aligned footer row with the CLI's
  // `[-N/+M]` edit counter on diffs, plus the copy button (hidden while the
  // tool is still running, skipped for terminal/phase tools that own copy).
  const stats = diff !== null ? diffStats(diff.hunks) : null
  const showCopy =
    block.done &&
    toolHasCopyButton(block.toolName) &&
    onSendFollowup !== undefined
  const copyText = toolCopyText(
    block.toolName,
    block.inputJson,
    block.outputText,
  )
  const thinking =
    block.toolName === 'sequentialthinking'
      ? parseThinkingInput(block.inputJson)
      : null
  // P14: write_todos renders a ✓/○ checklist card (CLI parity).
  const todos =
    block.toolName === 'write_todos' ? parseTodosInput(block.inputJson) : null
  // P16: simple-item tools render the CLI's `• Name description` line
  // (web_search / read_url / skill) instead of the raw JSON view.
  const simpleItem: SimpleToolItem | null = (() => {
    switch (block.toolName) {
      case 'web_search':
        return parseWebSearchItem(block.inputJson)
      case 'read_url':
        return parseReadUrlItem(block.inputJson)
      case 'skill':
        return parseSkillItem(block.inputJson)
      default:
        return null
    }
  })()
  // FID-2026-0901-006 P4: followups are the call-to-action of the whole turn
  // — they render collapsed too (parse once; empty input renders nothing).
  const followups =
    block.toolName === 'suggest_followups' && onSendFollowup !== undefined
      ? parseFollowups(block.inputJson)
      : null
  return (
    <section className={`tool-card${block.done ? '' : ' tool-card-running'}`}>
      <button
        type="button"
        className="tool-card-head"
        onClick={() => {
          setExpanded((value) => !value)
        }}
      >
        {/* P21 (operator: "use the traffic lights design for these content
            boxes"): the tool card chrome carries the CLI traffic lights.
            P23: they are never dimmed — the CLI lights always breathe at
            full brightness regardless of block state. */}
        <TrafficLights />
        {/* P14: Title-Case display name + one-line preview, CLI language.
            P22: the old `tool-dot` run/done indicator is gone — it made the
            head show FOUR dots (traffic lights + status dot). The lights
            alone encode state: lit while running, dimmed when settled. */}
        <span className="tool-name">{toolDisplayName(block.toolName)}</span>
        {!expanded ? (
          <span className="tool-preview">
            {toolCollapsedPreview(
              block.toolName,
              block.inputJson,
              block.outputText,
            ) ??
              (todos !== null ? todosPreview(todos) : null) ??
              (thinking !== null ? thinking.preview : null) ??
              (block.done ? '' : 'running…')}
          </span>
        ) : null}
        <span className="tool-toggle" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {/* P4: collapsed cards — visible without expanding the tool card. */}
      {!expanded &&
      onSendFollowup !== undefined &&
      followups !== null &&
      followups.length > 0 ? (
        <FollowupCards inputJson={block.inputJson} onSend={onSendFollowup} />
      ) : null}
      {showCopy ? (
        <div className="tool-footer">
          {stats !== null && stats.added + stats.removed > 0 ? (
            <span className="tool-diff-stats" aria-label="diff stats">
              <span className="tool-diff-added">+{stats.added}</span>
              <span className="tool-diff-removed">−{stats.removed}</span>
            </span>
          ) : null}
          <CopyButton text={copyText} label="copy" />
        </div>
      ) : null}
      {expanded ? (
        <div className="tool-body">
          {/* Edit-class tools render their structured input as a real diff
              (Step 4); whole-file writes show a compact summary (P14); every
              other tool keeps the raw JSON view. */}
          {diff !== null && !isWholeFileWrite ? (
            <>
              <div className="tool-label">diff</div>
              <DiffBlock payload={diff} />
            </>
          ) : writeSummary !== null ? (
            <>
              <div className="tool-label">write</div>
              <div className="write-summary">{writeSummary}</div>
            </>
          ) : shownInput === null ? null : (
            <>
              <div className="tool-label">input</div>
              <pre className="tool-pre">{shownInput}</pre>
            </>
          )}
          {todos !== null ? (
            <TodosBlock payload={todos} />
          ) : simpleItem !== null ? (
            <div className="simple-item">
              <span className="simple-item-bullet" aria-hidden="true">
                •
              </span>
              <span className="simple-item-name">{simpleItem.name}</span>
              <span className="simple-item-desc">{simpleItem.description}</span>
            </div>
          ) : thinking !== null ? (
            <ThinkingBlock payload={thinking} />
          ) : onSendFollowup !== undefined ? (
            <FollowupCards
              inputJson={block.inputJson}
              onSend={onSendFollowup}
            />
          ) : null}{' '}
          {verification !== null ? (
            <>
              <div className="tool-label">verification</div>
              <VerificationBlock entries={verification} />
            </>
          ) : shownOutput === null ? null : (
            <>
              <div className="tool-label">output</div>
              <pre
                className={`tool-pre${
                  block.toolName === 'run_terminal_command' ||
                  block.toolName === 'run_readonly_command'
                    ? ' tool-pre-terminal'
                    : ''
                }`}
              >
                {shownOutput}
              </pre>
            </>
          )}
        </div>
      ) : null}
    </section>
  )
})
