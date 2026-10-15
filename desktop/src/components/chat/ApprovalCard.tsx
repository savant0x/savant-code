// FID-2026-0820-010 Step 6 — inline approval card. Surfaces the gateway
// approval lifecycle with Approve/Deny controls wired to the real
// `approval_response` method.
// FID-2026-1013-013 W4-3: v1 hardcoded the empty-answers shape; the card now
// carries an optional single-line operator note/answer that rides along as
// `answers: [{ note }]` (the trailing optional arg keeps 2-arg callers and
// the previous `answers: []` behaviour intact).

import { memo, useState } from 'react'

import type { ChatBlock } from '../../state/transcript-store'
import type { JSX } from 'react'

type ApprovalBlock = Extract<ChatBlock, { kind: 'approval' }>

export const ApprovalCard = memo(function ApprovalCard({
  block,
  disabled,
  onRespond,
}: {
  block: ApprovalBlock
  disabled: boolean
  onRespond(approvalId: string, skipped: boolean, note?: string): void
}): JSX.Element {
  const [responded, setResponded] = useState<'approved' | 'denied' | null>(null)
  const [note, setNote] = useState('')
  const trimmedNote = note.trim()
  const respond = (skipped: boolean): void => {
    if (responded !== null || disabled) return
    setResponded(skipped ? 'denied' : 'approved')
    onRespond(
      block.approvalId,
      skipped,
      trimmedNote === '' ? undefined : trimmedNote,
    )
  }
  return (
    <section className="blk blk-approval">
      <div className="blk-approval-title">
        approval required · {block.requestType}
      </div>
      <pre className="blk-approval-summary">{block.summary}</pre>
      {responded === null ? (
        <>
          <input
            type="text"
            className="approval-note"
            aria-label="operator note"
            placeholder="optional note / answer"
            value={note}
            disabled={disabled}
            onChange={(event) => {
              setNote(event.target.value)
            }}
            onKeyDown={(event) => {
              // Enter approves with the note attached — the fast path for an
              // operator answering a question inline.
              if (event.key === 'Enter') respond(false)
            }}
          />
          <div className="approval-actions">
            <button
              type="button"
              className="approval-btn approval-approve"
              disabled={disabled}
              onClick={() => {
                respond(false)
              }}
            >
              Approve
            </button>
            <button
              type="button"
              className="approval-btn approval-deny"
              disabled={disabled}
              onClick={() => {
                respond(true)
              }}
            >
              Deny
            </button>
          </div>
        </>
      ) : (
        <div className={`approval-state approval-${responded}`}>
          {responded} · {block.approvalId}
          {trimmedNote === '' ? '' : ` · ${trimmedNote}`}
        </div>
      )}
    </section>
  )
})
