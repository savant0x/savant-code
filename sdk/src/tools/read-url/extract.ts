/**
 * read-url — content extraction helpers (HTML, markdown frontmatter, JSON,
 * plain text) with truncation.
 * (FID-2026-0809-016: extracted from `read-url.ts`.)
 */

function decodeHtmlEntities(text: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    copy: '(c)',
    hellip: '...',
    gt: '>',
    lt: '<',
    mdash: '-',
    middot: '*',
    nbsp: ' ',
    ndash: '-',
    quot: '"',
    rsquo: "'",
  }

  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, body) => {
    if (body[0] === '#') {
      const isHex = body[1]?.toLowerCase() === 'x'
      const value = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      return Number.isFinite(value) && value >= 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : entity
    }
    return namedEntities[body] ?? entity
  })
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ')
}

function extractFirstMatch(html: string, pattern: RegExp): string | undefined {
  const match = html.match(pattern)
  if (!match?.[1]) return undefined
  return normalizeText(decodeHtmlEntities(stripTags(match[1])))
}

function removeElement(html: string, tagName: string): string {
  return html.replace(
    new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi'),
    '\n',
  )
}

function extractElementContents(html: string, tagName: string): string[] {
  const matches = html.matchAll(
    new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi'),
  )
  return Array.from(matches, (match) => match[1]).filter(Boolean)
}

function selectReadableHtml(html: string): string {
  const articleCandidates = extractElementContents(html, 'article')
  if (articleCandidates.length > 0) {
    return articleCandidates.reduce((best, candidate) =>
      stripTags(candidate).length > stripTags(best).length ? candidate : best,
    )
  }

  const mainCandidates = extractElementContents(html, 'main')
  if (mainCandidates.length > 0) {
    return mainCandidates.reduce((best, candidate) =>
      stripTags(candidate).length > stripTags(best).length ? candidate : best,
    )
  }

  return html
}

function extractMetaContent(html: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(
      `<meta\\b(?=[^>]*(?:name|property)=["']${escapedName}["'])(?=[^>]*content=["']([^"']*)["'])[^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta\\b(?=[^>]*content=["']([^"']*)["'])(?=[^>]*(?:name|property)=["']${escapedName}["'])[^>]*>`,
      'i',
    ),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return normalizeText(decodeHtmlEntities(match[1]))
  }
  return undefined
}

export function extractHtml(html: string): {
  title?: string
  description?: string
  text: string
} {
  const title = extractFirstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i)
  const description =
    extractMetaContent(html, 'description') ??
    extractMetaContent(html, 'og:description')

  let readable = html
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/<!doctype[^>]*>/gi, '\n')

  for (const tagName of [
    'script',
    'style',
    'svg',
    'canvas',
    'iframe',
    'noscript',
    'nav',
    'header',
    'footer',
    'form',
    'button',
    'select',
  ]) {
    readable = removeElement(readable, tagName)
  }

  readable = selectReadableHtml(readable)

  readable = readable
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(
      /<\/(p|div|section|article|main|aside|li|tr|td|th|h[1-6]|blockquote|pre)>/gi,
      '\n',
    )
    .replace(/<(li|tr|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')

  const text = normalizeText(decodeHtmlEntities(readable))
  return { title, description, text }
}

export function extractMarkdownFrontmatter(body: string): {
  title?: string
  description?: string
  text: string
} {
  const match = body.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/)
  if (!match) {
    return { text: normalizeText(decodeHtmlEntities(body)) }
  }

  const frontmatter = match[1]
  const getValue = (key: 'title' | 'description') => {
    const valueMatch = frontmatter.match(
      new RegExp(`^${key}:\\s*(?:"([^"]*)"|'([^']*)'|(.+))\\s*$`, 'm'),
    )
    return normalizeText(
      decodeHtmlEntities(
        valueMatch?.[1] ?? valueMatch?.[2] ?? valueMatch?.[3] ?? '',
      ),
    )
  }

  return {
    title: getValue('title') || undefined,
    description: getValue('description') || undefined,
    text: normalizeText(decodeHtmlEntities(body.slice(match[0].length))),
  }
}

export function isJsonContentType(contentType: string): boolean {
  return (
    contentType.includes('application/json') || contentType.includes('+json')
  )
}

export function isMarkdownContentType(contentType: string): boolean {
  return contentType.includes('text/markdown')
}

export function isSupportedContentType(contentType: string): boolean {
  return /^(text\/|application\/(json|[^;\s/]+\+json|xhtml\+xml|xml|rss\+xml|atom\+xml)\b)/i.test(
    contentType,
  )
}

export function extractTextByContentType(
  contentType: string,
  body: string,
): {
  title?: string
  description?: string
  text: string
} {
  const lowerContentType = contentType.toLowerCase()

  if (
    lowerContentType.includes('text/html') ||
    lowerContentType.includes('application/xhtml')
  ) {
    return extractHtml(body)
  }

  if (isJsonContentType(lowerContentType)) {
    try {
      return { text: JSON.stringify(JSON.parse(body), null, 2) }
    } catch {
      return { text: normalizeText(body) }
    }
  }

  if (isMarkdownContentType(lowerContentType)) {
    return extractMarkdownFrontmatter(body)
  }

  if (
    lowerContentType.startsWith('text/') ||
    lowerContentType.includes('application/xml') ||
    lowerContentType.includes('application/rss+xml') ||
    lowerContentType.includes('application/atom+xml')
  ) {
    return { text: normalizeText(body) }
  }

  return { text: normalizeText(body) }
}

export function truncateText(
  text: string,
  maxChars: number,
): {
  text: string
  truncated: boolean
} {
  if (text.length <= maxChars) {
    return { text, truncated: false }
  }
  return {
    text: `${text.slice(0, maxChars).trimEnd()}\n\n[Content truncated]`,
    truncated: true,
  }
}
