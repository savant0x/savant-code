/**
 * Text and minimal markdown-to-HTML renderers for the exported report.
 *
 * All inline text is HTML-escaped before formatting so raw `<script>` or other
 * markup in a message can never inject into the exported document.
 */
import { ico } from './export-icons'
import { escapeHtml } from './format'

export function renderTextBlockHtml(text: string, textType?: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (textType === 'reasoning') {
    return `<details class="row-thinking">
  <summary>${ico('thinkingIcon')}<span class="thinking-badge">Thinking</span></summary>
  <div class="thinking-body">${renderMarkdownLikeHtml(trimmed)}</div>
</details>`
  }
  return renderMarkdownLikeHtml(trimmed)
}

/**
 * Minimal markdown-to-HTML for conversation content. Handles:
 * - Code fences (``` ... ```)
 * - Inline code (`...`)
 * - Bold (**...**) and italic (*...*)
 * - Headers (## / ###)
 * - Bullet lists (- ...)
 * - Blockquotes (> ...)
 * - Links [text](url)
 * - Line breaks
 */
export function renderMarkdownLikeHtml(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let inFence = false
  let fenceLang = ''

  for (const line of lines) {
    // Code fence toggle
    const fenceMatch = line.match(/^```(\w*)/)
    if (fenceMatch) {
      if (!inFence) {
        inFence = true
        fenceLang = fenceMatch[1] || ''
        out.push(
          `<pre><code class="${fenceLang ? `language-${fenceLang}` : ''}">`,
        )
      } else {
        inFence = false
        fenceLang = ''
        out.push('</code></pre>')
      }
      continue
    }

    if (inFence) {
      out.push(escapeHtml(line))
      continue
    }

    // Headers
    if (line.startsWith('### ')) {
      out.push(`<h4>${inlineFormat(line.slice(4))}</h4>`)
    } else if (line.startsWith('## ')) {
      out.push(`<h3>${inlineFormat(line.slice(3))}</h3>`)
    } else if (line.startsWith('# ')) {
      out.push(`<h2>${inlineFormat(line.slice(2))}</h2>`)
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      out.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`)
    }
    // Bullet list
    else if (line.match(/^[-*] /)) {
      out.push(`<li>${inlineFormat(line.slice(2))}</li>`)
    }
    // Horizontal rule
    else if (line.match(/^---+$/)) {
      out.push('<hr/>')
    }
    // Empty line
    else if (line.trim() === '') {
      out.push('')
    }
    // Normal text
    else {
      out.push(`<p>${inlineFormat(line)}</p>`)
    }
  }

  return out.join('\n')
}

/** Handle inline markdown: bold, italic, inline code, links. */
export function inlineFormat(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}
