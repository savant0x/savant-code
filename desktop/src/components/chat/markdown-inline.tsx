// Inline markdown renderer for model output — extracted from MarkdownBlock
// (FID-2026-0820-010 Loop 3; file-ceiling decomposition). Produces React
// elements ONLY: there is no HTML string anywhere, so injected markup cannot
// execute. Links are scheme-allowlisted to http/https and carry
// rel=noopener noreferrer; anything unrecognized falls through as literal
// text (fail-safe inert).

import type { ReactNode } from 'react'

const SAFE_SCHEMES = new Set(['http:', 'https:'])

function renderLink(
  label: string,
  href: string,
  key: string,
): ReactNode | null {
  try {
    const url = new URL(href)
    if (!SAFE_SCHEMES.has(url.protocol)) return null
    return (
      <a key={key} href={url.href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    )
  } catch {
    return null
  }
}

export function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let plain = ''
  let serial = 0
  const flushPlain = (): void => {
    if (plain !== '') {
      nodes.push(plain)
      plain = ''
    }
  }
  let pos = 0
  while (pos < text.length) {
    const char = text[pos]
    if (char === '`') {
      const end = text.indexOf('`', pos + 1)
      if (end > pos) {
        flushPlain()
        nodes.push(
          <code key={`${keyPrefix}-c${serial++}`}>
            {text.slice(pos + 1, end)}
          </code>,
        )
        pos = end + 1
        continue
      }
    }
    const doubleMarker =
      (char === '*' || char === '_') && text[pos + 1] === char
        ? char.repeat(2)
        : null
    if (doubleMarker !== null) {
      const end = text.indexOf(doubleMarker, pos + 2)
      if (end > pos) {
        flushPlain()
        const innerKey = `${keyPrefix}-b${serial}`
        nodes.push(
          <strong key={`${keyPrefix}-b${serial++}`}>
            {renderInline(text.slice(pos + 2, end), innerKey)}
          </strong>,
        )
        pos = end + 2
        continue
      }
    }
    const singleMarker = char === '*' || char === '_' ? char : null
    if (singleMarker !== null) {
      const end = text.indexOf(singleMarker, pos + 1)
      if (end > pos + 1) {
        flushPlain()
        const innerKey = `${keyPrefix}-e${serial}`
        nodes.push(
          <em key={`${keyPrefix}-e${serial++}`}>
            {renderInline(text.slice(pos + 1, end), innerKey)}
          </em>,
        )
        pos = end + 1
        continue
      }
    }
    if (char === '[') {
      const closeBracket = text.indexOf('](', pos)
      if (closeBracket > pos) {
        const closeParen = text.indexOf(')', closeBracket + 2)
        if (closeParen > closeBracket) {
          const label = text.slice(pos + 1, closeBracket)
          const href = text.slice(closeBracket + 2, closeParen)
          const key = `${keyPrefix}-a${serial++}`
          const link = renderLink(label, href, key)
          if (link !== null) {
            flushPlain()
            nodes.push(link)
            pos = closeParen + 1
            continue
          }
        }
      }
    }
    plain += char
    pos += 1
  }
  flushPlain()
  return nodes
}
