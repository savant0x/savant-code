/**
 * Per-content-block HTML renderers for the exported report.
 */

import { ico } from './export-icons'
import {
  escapeHtml,
  formatAgentName,
  renderToolInput,
  renderToolOutput,
  toolDisplayName,
} from './format'
import { renderMarkdownLikeHtml, renderTextBlockHtml } from './render-text'

import type { ContentBlock } from '../../types/chat'

export function renderToolBlockHtml(
  block: Extract<ContentBlock, { type: 'tool' }>,
): string {
  const name = toolDisplayName(block.toolName)
  const inputText = renderToolInput(block.input)
  const hasInput = inputText.trim().length > 0
  const output = block.output ?? ''
  const hasOutput = output.trim().length > 0

  if (!hasInput && !hasOutput) {
    return `<div class="tool-block"><span class="tool-badge">${ico('toolBadge')} ${escapeHtml(name)}</span> <em class="muted">(no input or output)</em></div>`
  }

  const inputSection = hasInput
    ? `<details open>
    <summary>${ico('inputSummary')} Input</summary>
    <pre><code class="language-json">${escapeHtml(inputText)}</code></pre>
  </details>`
    : ''

  const outputSection = hasOutput
    ? (() => {
        const rendered = renderToolOutput(output)
        return `<details>
    <summary>${ico('outputSummary')} Output</summary>
    <pre><code class="${rendered.lang ? `language-${rendered.lang}` : ''}">${escapeHtml(rendered.body)}</code></pre>
  </details>`
      })()
    : ''

  return `<div class="tool-block">
  <div class="tool-header"><span class="tool-badge">${ico('toolBadge')} ${escapeHtml(name)}</span></div>
  ${inputSection}
  ${outputSection}
</div>`
}

export function renderAgentBlockHtml(
  block: Extract<ContentBlock, { type: 'agent' }>,
): string {
  const label = formatAgentName(block.agentName || block.agentType)
  const header = `Subagent: ${escapeHtml(label)}`
  const promptHtml = block.initialPrompt?.trim()
    ? `<p class="muted"><strong>Prompt:</strong> ${escapeHtml(block.initialPrompt.trim())}</p>`
    : ''
  const contentHtml = block.content?.trim()
    ? renderMarkdownLikeHtml(block.content.trim())
    : ''
  const childrenHtml = (block.blocks ?? [])
    .map((child) => renderBlockHtml(child))
    .join('\n')
  return `<div class="agent-block">
  <div class="agent-header">${ico('agentHeader')} ${header}</div>
  ${promptHtml}
  ${contentHtml}
  ${childrenHtml}
</div>`
}

export function renderPlanBlockHtml(
  block: Extract<ContentBlock, { type: 'plan' }>,
): string {
  const content = block.content?.trim()
  if (!content) return ''
  return `<div class="plan-block">
  <div class="plan-header">${ico('planHeader')} Plan</div>
  ${renderMarkdownLikeHtml(content)}
</div>`
}

export function renderAskUserBlockHtml(
  block: Extract<ContentBlock, { type: 'ask-user' }>,
): string {
  const questionsHtml = block.questions
    .map((q, i) => {
      const answer = block.answers?.find((a) => a.questionIndex === i)
      const selected =
        answer?.selectedOptions?.join(', ') ??
        answer?.selectedOption ??
        answer?.otherText ??
        (block.skipped ? '(skipped)' : '(no answer)')
      return `<div class="ask-user-question">
    <strong>Q:</strong> ${escapeHtml(q.question)}<br/>
    <em>A:</em> ${escapeHtml(selected)}
  </div>`
    })
    .join('\n')
  return `<div class="ask-user-block">${questionsHtml}</div>`
}

export function renderBlockHtml(block: ContentBlock): string {
  switch (block.type) {
    case 'text':
      return renderTextBlockHtml(block.content ?? '', block.textType)
    case 'tool':
      return renderToolBlockHtml(block)
    case 'agent':
      return renderAgentBlockHtml(block)
    case 'plan':
      return renderPlanBlockHtml(block)
    case 'ask-user':
      return renderAskUserBlockHtml(block)
    case 'image':
      return `<p class="muted">${ico('imageNotice')} [Image: ${escapeHtml(block.filename ?? block.mediaType ?? 'unknown')}]</p>`
    case 'agent-list': {
      const names = block.agents.map((a) => a.displayName).join(', ')
      return names
        ? `<p class="muted">${ico('agentListNotice')} [Available agents: ${escapeHtml(names)}]</p>`
        : ''
    }
    default:
      return ''
  }
}
