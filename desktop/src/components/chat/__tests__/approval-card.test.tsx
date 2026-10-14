// FID-2026-1013-013 W4-3 declared gate: the ApprovalCard operator note input
// and the note → `answers` payload mapping that use-gateway sends. The Desktop
// suite has no DOM (bun test, no happy-dom preload), so the card is asserted
// through its static markup — the same convention as followup-cards.test.tsx —
// and the payload mapping through the exported pure helper.

import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { approvalAnswerPayload } from '../../../lib/approval-answers'
import { ApprovalCard } from '../ApprovalCard'

const APPROVAL_BLOCK = {
  kind: 'approval' as const,
  id: 1,
  approvalId: 'AP-7',
  requestType: 'tool_permission',
  summary: 'run_terminal_command: rm -rf build',
}

function html(disabled = false, onRespond: () => void = () => {}): string {
  return renderToStaticMarkup(
    <ApprovalCard
      block={APPROVAL_BLOCK}
      disabled={disabled}
      onRespond={onRespond}
    />,
  )
}

describe('ApprovalCard operator note (W4-3)', () => {
  test('renders the single-line note input beside the decisions', () => {
    const out = html()
    expect(out).toContain('class="approval-note"')
    expect(out).toContain('aria-label="operator note"')
    expect(out).toContain('placeholder="optional note / answer"')
    expect(out).toContain('Approve')
    expect(out).toContain('Deny')
  })

  test('the input follows the summary and precedes the action row', () => {
    const out = html()
    expect(out.indexOf('blk-approval-summary')).toBeLessThanOrEqual(
      out.indexOf('approval-note'),
    )
    expect(out.indexOf('approval-note')).toBeLessThanOrEqual(
      out.indexOf('approval-actions'),
    )
  })

  test('a disabled card disables the note input too', () => {
    expect(html(true)).toContain('disabled')
  })
})

describe('approvalAnswerPayload (W4-3): note → approval_response answers', () => {
  test('no note keeps the v1 empty-answers shape', () => {
    expect(approvalAnswerPayload()).toEqual([])
    expect(approvalAnswerPayload('')).toEqual([])
    expect(approvalAnswerPayload('   ')).toEqual([])
  })

  test('a note rides as a single trimmed answer entry', () => {
    expect(approvalAnswerPayload('  yes, proceed  ')).toEqual([
      { note: 'yes, proceed' },
    ])
  })
})
