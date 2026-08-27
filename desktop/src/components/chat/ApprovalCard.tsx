// FID-2026-0820-010 Step 6 — inline approval card. Surfaces the gateway
// approval lifecycle with Approve/Deny controls wired to the real
// `approval_response` method. v1 semantics: the client answers with the
// empty-answers shape (approve) or the skipped=true fail-closed deny —
// richer answer collection is deferred until an event needs it.

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
  onRespond(approvalId: string, skipped: boolean): void
}): JSX.Element {
  const [responded, setResponded] = useState<'approved' | 'denied' | null>(null)
  const respond = (skipped: boolean): void => {
    if (responded !== null || disabled) return
    setResponded(skipped ? 'denied' : 'approved')
    onRespond(block.approvalId, skipped)
  }
  return (
    <section className="blk blk-approval">
      <div className="blk-approval-title">
        approval required · {block.requestType}
      </div>
      <pre className="blk-approval-summary">{block.summary}</pre>
      {responded === null ? (
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
      ) : (
        <div className={`approval-state approval-${responded}`}>
          {responded} · {block.approvalId}
        </div>
      )}
    </section>
  )
})
