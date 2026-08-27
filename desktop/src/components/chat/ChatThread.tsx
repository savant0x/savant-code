// FID-2026-0820-010 Loop 3 — chat thread surface. Renders the transcript
// blocks produced by the store; streaming appends never reset scroll position
// unless the user is pinned near the bottom (FID Loop 1 Q3 acceptance).

import { memo, useEffect, useRef, useState } from 'react'

import { ApprovalCard } from './ApprovalCard'
import { Composer } from './Composer'
import { CopyButton } from './CopyButton'
import { MarkdownBlock } from './MarkdownBlock'
import { ToolCard } from './ToolCard'
import { isAwaitingFirstOutput } from '../../state/transcript-store'

import type { ChatBlock } from '../../state/transcript-store'
import type { JSX } from 'react'

const NEAR_BOTTOM_THRESHOLD_PX = 80
const ESTIMATED_BLOCK_HEIGHT_PX = 96
const VIRTUALIZATION_THRESHOLD = 80
const OVERSCAN_BLOCKS = 8

export function getVirtualBlockRange(
  blockCount: number,
  scrollTop: number,
  clientHeight: number,
): { start: number; end: number } {
  if (blockCount <= VIRTUALIZATION_THRESHOLD)
    return { start: 0, end: blockCount }
  const first = Math.max(
    0,
    Math.floor(scrollTop / ESTIMATED_BLOCK_HEIGHT_PX) - OVERSCAN_BLOCKS,
  )
  const last = Math.min(
    blockCount,
    Math.ceil((scrollTop + clientHeight) / ESTIMATED_BLOCK_HEIGHT_PX) +
      OVERSCAN_BLOCKS,
  )
  return { start: first, end: Math.max(first, last) }
}

type TextBlock = Extract<ChatBlock, { kind: 'text' }>
type ReasoningBlock = Extract<ChatBlock, { kind: 'reasoning' }>

const TextView = memo(function TextView({
  block,
}: {
  block: TextBlock
}): JSX.Element {
  return (
    <div className="blk blk-text">
      <CopyButton text={block.text} />
      <MarkdownBlock text={block.text} />
    </div>
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
    </div>
  )
})

const ReasoningView = memo(function ReasoningView({
  block,
}: {
  block: ReasoningBlock
}): JSX.Element {
  return (
    <details className="blk blk-reasoning">
      <summary>💭 reasoning</summary>
      <div className="blk-reasoning-body">
        <MarkdownBlock text={block.text} />
      </div>
    </details>
  )
})

function BlockView({
  block,
  disabled,
  onRespondApproval,
}: {
  block: ChatBlock
  disabled: boolean
  onRespondApproval(approvalId: string, skipped: boolean): void
}): JSX.Element {
  switch (block.kind) {
    case 'text':
      return <TextView block={block} />
    case 'user':
      return <UserView block={block} />
    case 'reasoning':
      return <ReasoningView block={block} />
    case 'tool':
      return <ToolCard block={block} />
    case 'error':
      return <div className="blk blk-error">{block.message}</div>
    case 'ehel':
      return (
        <section className={`blk blk-ehel ehel-${block.severity}`}>
          <div className="blk-ehel-title">
            EHEL · {block.law} · {block.severity}
          </div>
          <div className="blk-ehel-body">{block.message}</div>
        </section>
      )
    case 'notice':
      return <div className="blk blk-notice">{block.message}</div>
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
  onSend(text: string): void
  onRespondApproval(approvalId: string, skipped: boolean): void
  onInterrupt(): void
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pinnedRef = useRef(true)
  const [scrollMetrics, setScrollMetrics] = useState({
    scrollTop: 0,
    clientHeight: 0,
  })

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
    setScrollMetrics({
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
    })
  }

  const range = getVirtualBlockRange(
    props.blocks.length,
    scrollMetrics.scrollTop,
    scrollMetrics.clientHeight,
  )
  const visibleBlocks = props.blocks.slice(range.start, range.end)

  return (
    <div className="thread-wrap">
      <div className="thread" ref={scrollRef} onScroll={handleScroll}>
        {props.blocks.length === 0 ? (
          <p className="thread-empty">
            Connected. Send a message to start a run.
          </p>
        ) : (
          <>
            <div
              className="thread-virtual-spacer"
              style={{ height: `${range.start * ESTIMATED_BLOCK_HEIGHT_PX}px` }}
              aria-hidden="true"
            />
            {visibleBlocks.map((block) => (
              <BlockView
                key={block.id}
                block={block}
                disabled={props.disabled}
                onRespondApproval={props.onRespondApproval}
              />
            ))}
            <div
              className="thread-virtual-spacer"
              style={{
                height: `${(props.blocks.length - range.end) * ESTIMATED_BLOCK_HEIGHT_PX}px`,
              }}
              aria-hidden="true"
            />
          </>
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
      </div>
      <Composer
        disabled={props.disabled}
        running={props.running}
        onSend={props.onSend}
        onInterrupt={props.onInterrupt}
      />
    </div>
  )
}
