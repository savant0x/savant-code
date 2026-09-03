// FID-2026-0820-010 Loop 3 — chat thread surface. Renders the transcript
// blocks produced by the store; streaming appends never reset scroll position
// unless the user is pinned near the bottom (FID Loop 1 Q3 acceptance).
// P25 (operator: "it cuts off... scroll does not work"): the fixed-height
// windowing is GONE — every block renders. The spacer math estimated 96px per
// block, so with tall blocks the scroll container's scrollHeight no longer
// reached the real content: the tail of responses was clipped and the
// scrollbar believed there was nothing to scroll. The desktop thread renders
// fully (React reconciliation is cheap enough here); correctness over a perf
// trade the WebView never needed.

import { memo, useEffect, useRef } from 'react'

import { ApprovalCard } from './ApprovalCard'
import { Composer } from './Composer'
import { CopyButton } from './CopyButton'
import { MarkdownBlock } from './MarkdownBlock'
import { RunStatusBar } from './RunStatusBar'
import { ToolCard } from './ToolCard'
import { TrafficLightCard } from './TrafficLightCard'
import { isAwaitingFirstOutput } from '../../state/transcript-store'

import type { ChatBlock, CurrentActivity } from '../../state/transcript-store'
import type { JSX } from 'react'

const NEAR_BOTTOM_THRESHOLD_PX = 80

type TextBlock = Extract<ChatBlock, { kind: 'text' }>
type ReasoningBlock = Extract<ChatBlock, { kind: 'reasoning' }>

/** FID-2026-0901-006: a short timestamp under a message (CLI-style).
 * P19 (operator: "the time is inline with the message, it should be under it,
 * small and right-aligned"): it now renders AFTER the content in DOM order
 * (the CSS keeps it small + right-aligned) instead of above the text. */
function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TextView = memo(function TextView({
  block,
}: {
  block: TextBlock
}): JSX.Element {
  // P21 (operator: "use the traffic lights design for these content boxes"):
  // assistant messages get the CLI TrafficLightPanel chrome — a bounded card
  // with the traffic-light title bar.
  return (
    <TrafficLightCard label="response">
      <div className="blk blk-text">
        <MarkdownBlock text={block.text} />
        {typeof block.ts === 'number' ? (
          <div className="blk-footer">
            <CopyButton text={block.text} />
            <span className="blk-timestamp">{formatTimestamp(block.ts)}</span>
          </div>
        ) : (
          <div className="blk-footer">
            <CopyButton text={block.text} />
          </div>
        )}
      </div>
    </TrafficLightCard>
  )
})

const UserView = memo(function UserView({
  block,
}: {
  block: Extract<ChatBlock, { kind: 'user' }>
}): JSX.Element {
  return (
    <div className="blk blk-user">
      <div className="blk-user-bubble">{block.text}</div>
      {typeof block.ts === 'number' ? (
        <span className="blk-timestamp">{formatTimestamp(block.ts)}</span>
      ) : null}
    </div>
  )
})

/** P20 (operator: "the 'thinking..' does not expand and show actual
 * thoughts"): reasoning cards get a one-line preview in the collapsed header
 * and pin OPEN while the run is live — the thoughts are the content, not a
 * hidden easter egg. After the turn closes the operator can collapse freely.
 */
function reasoningPreview(text: string): string {
  const firstLine = text.split('\n').find((line) => line.trim()) ?? ''
  const flat = firstLine.replace(/[#*`_~>]/g, '').trim()
  return flat.length > 90 ? `${flat.slice(0, 89)}…` : flat
}

const ReasoningView = memo(function ReasoningView({
  block,
  live,
}: {
  block: ReasoningBlock
  /** True while this block is the streaming edge of a live run. */
  live: boolean
}): JSX.Element {
  const preview = reasoningPreview(block.text)
  // P21: reasoning blocks get the traffic-light card chrome (CLI thinking
  // panel parity), labels as the block's own chip.
  return (
    <TrafficLightCard label="reasoning">
      <details className="blk blk-reasoning" open={live}>
        <summary>💭 {preview !== '' ? preview : 'thinking'}</summary>
        <div className="blk-reasoning-body">
          <MarkdownBlock text={block.text} />
        </div>
      </details>
    </TrafficLightCard>
  )
})

function BlockView({
  block,
  disabled,
  live,
  onRespondApproval,
  onSendFollowup,
}: {
  block: ChatBlock
  disabled: boolean
  /** P20: streaming edge of a live run (drives reasoning auto-open). */
  live: boolean
  onRespondApproval(approvalId: string, skipped: boolean): void
  /** FID-2026-0901-006: click a suggested followup → send it as a prompt. */
  onSendFollowup?: (prompt: string) => void
}): JSX.Element {
  switch (block.kind) {
    case 'text':
      return <TextView block={block} />
    case 'user':
      return <UserView block={block} />
    case 'reasoning':
      return <ReasoningView block={block} live={live} />
    case 'tool':
      return <ToolCard block={block} onSendFollowup={onSendFollowup} />
    case 'error':
      return <div className="blk blk-error">{block.message}</div>
    case 'ehel':
      return (
        <TrafficLightCard label="EHEL" tone="error">
          <section className={`blk blk-ehel ehel-${block.severity}`}>
            <div className="blk-ehel-title">
              {block.law} · {block.severity}
            </div>
            <div className="blk-ehel-body">{block.message}</div>
          </section>
        </TrafficLightCard>
      )
    case 'notice':
      return <div className="blk blk-notice">{block.message}</div>
    case 'compaction_summary':
      // FID-2026-0828-001 desktop parity — the post-compaction summary as a
      // real block (CLI CompactionSummaryBlock analog). P21: traffic-light
      // chrome for consistency with the other surface cards.
      return (
        <TrafficLightCard label="compaction" tone="warning">
          <section className="blk blk-compaction-summary">
            <div className="blk-compaction-summary-title">
              Context compacted · −{block.removedMessages} messages
              {block.tokensSaved !== undefined
                ? ` · −${block.tokensSaved.toLocaleString()} tokens`
                : ''}
            </div>
            <div className="blk-compaction-summary-body">{block.summary}</div>
          </section>
        </TrafficLightCard>
      )
    case 'approval':
      // Step 6: real Approve/Deny controls bound to the gateway's
      // approval_response method (empty-answers approve / skipped deny).
      return (
        <ApprovalCard
          block={block}
          disabled={disabled}
          onRespond={onRespondApproval}
        />
      )
  }
}

export function ChatThread(props: {
  blocks: ChatBlock[]
  running: boolean
  disabled: boolean
  /** FID-2026-0901-006 P2: live runtime activity for the status bar. */
  currentActivity?: CurrentActivity | null
  /** FID-2026-0901-005: gateway slash-command registry for the palette. */
  serverCommands?: ReadonlyArray<{
    id: string
    description: string
    dispatch: string
  }>
  /** FID-2026-0901-006: click a suggested followup → send as a prompt. */
  onSendFollowup?: (prompt: string) => void
  onSend(text: string): void
  onRespondApproval(approvalId: string, skipped: boolean): void
  onInterrupt(): void
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pinnedRef = useRef(true)

  useEffect(() => {
    if (!pinnedRef.current) return
    const element = scrollRef.current
    if (element !== null) element.scrollTop = element.scrollHeight
  }, [props.blocks.length])

  const handleScroll = (): void => {
    const element = scrollRef.current
    if (element === null) return
    pinnedRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight <
      NEAR_BOTTOM_THRESHOLD_PX
  }
  // P20: the streaming edge — the last block only, and only mid-run. It is
  // what drives the reasoning card's auto-open (thoughts visible as they
  // stream, like the CLI).
  const liveBlockId =
    props.running && props.blocks.length > 0
      ? props.blocks[props.blocks.length - 1]?.id
      : undefined

  return (
    <div className="thread-wrap">
      {/* P21 (operator: "the chat should have a very dim and large Savant logo
          in the middle background w/a cyan glow/stroke"): decorative
          watermark behind the transcript. pointer-events:none keeps it from
          intercepting scroll/clicks; aria-hidden keeps it out of the a11y
          tree. */}
      <div className="chat-watermark" aria-hidden="true">
        <img
          src="/floor-assets/emblem/savant-logo.png"
          alt=""
          draggable={false}
        />
      </div>
      <div className="thread" ref={scrollRef} onScroll={handleScroll}>
        {props.blocks.length === 0 ? (
          <p className="thread-empty">
            Connected. Send a message to start a run.
          </p>
        ) : (
          props.blocks.map((block) => (
            <BlockView
              key={block.id}
              block={block}
              disabled={props.disabled}
              live={block.id === liveBlockId}
              onRespondApproval={props.onRespondApproval}
              onSendFollowup={props.onSendFollowup}
            />
          ))
        )}
        {isAwaitingFirstOutput(props.blocks, props.running) ? (
          <div className="typing" role="status" aria-live="polite">
            <span className="typing-dots" aria-hidden="true">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
            <span className="typing-label">savant is thinking</span>
          </div>
        ) : null}
        {/* FID-2026-0901-006 P2: CLI-parity running status (activity label +
            elapsed timer). Renders while the run streams, not just pre-output. */}
        <RunStatusBar
          activity={props.currentActivity ?? null}
          running={props.running}
        />
      </div>
      <Composer
        disabled={props.disabled}
        running={props.running}
        serverCommands={props.serverCommands}
        onSend={props.onSend}
        onInterrupt={props.onInterrupt}
      />
    </div>
  )
}
