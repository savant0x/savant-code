import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { TextAttributes } from '@opentui/core'
import React, { useEffect, useMemo, useState, type ReactNode } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { calculateDisplaySize } from '../../utils/image-display'
import { safeOpen } from '../../utils/open-url'
import {
  renderInlineImage,
  supportsInlineImages,
} from '../../utils/terminal-images'
import { Button } from '../button'

const MAX_MARKDOWN_IMAGE_BYTES = 4 * 1024 * 1024
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const INLINE_IMAGE_MEDIA_TYPES = new Set(['image/png'])

export function isSafeMarkdownLink(value: string): boolean {
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(value).protocol)
  } catch {
    return false
  }
}

interface MarkdownHeadingProps {
  depth: number
  color: string
  children: ReactNode
}

const flattenHeadingChildren = (value: ReactNode): ReactNode[] => {
  if (Array.isArray(value)) return value.flatMap(flattenHeadingChildren)
  if (value === null || value === undefined || typeof value === 'boolean') {
    return []
  }
  if (React.isValidElement(value) && value.type === React.Fragment) {
    return flattenHeadingChildren(
      (value.props as { children?: ReactNode }).children,
    )
  }
  return [value]
}

const containsMarkdownLink = (value: ReactNode): boolean => {
  if (Array.isArray(value)) return value.some(containsMarkdownLink)
  if (!React.isValidElement(value)) return false
  if (value.type === MarkdownLink) return true
  return containsMarkdownLink(
    (value.props as { children?: ReactNode }).children,
  )
}

const renderHeadingContent = (
  children: ReactNode,
  color: string,
  attributes: number,
): ReactNode[] => {
  const content: ReactNode[] = []
  let textNodes: ReactNode[] = []
  const flushText = (): void => {
    if (textNodes.length === 0) return
    content.push(
      <text
        key={`heading-text-${content.length}`}
        fg={color}
        style={{ wrapMode: 'word', flexShrink: 1 }}
        attributes={attributes}
      >
        {textNodes}
      </text>,
    )
    textNodes = []
  }

  flattenHeadingChildren(children).forEach((child) => {
    if (React.isValidElement(child) && containsMarkdownLink(child)) {
      flushText()
      // Emphasis wrappers may contain an interactive link. Flatten only that
      // wrapper so the Button remains a legal sibling of text, never a child
      // of an OpenTUI <text> host.
      if (child.type !== MarkdownLink) {
        content.push(
          ...renderHeadingContent(
            (child.props as { children?: ReactNode }).children,
            color,
            attributes,
          ),
        )
      } else {
        content.push(
          React.cloneElement(
            child as React.ReactElement<{ attributes?: number }>,
            { attributes },
          ),
        )
      }
    } else {
      textNodes.push(child)
    }
  })
  flushText()

  return content
}

export function MarkdownHeading({
  depth,
  color,
  children,
}: MarkdownHeadingProps): ReactNode {
  const clampedDepth = Math.max(1, Math.min(6, depth))
  const marker =
    clampedDepth === 1 ? '◆ ' : `${'  '.repeat(clampedDepth - 2)}▸ `
  const attributes =
    clampedDepth === 1
      ? TextAttributes.BOLD | TextAttributes.UNDERLINE
      : clampedDepth <= 3
        ? TextAttributes.BOLD
        : TextAttributes.DIM

  return (
    <box
      style={{
        flexDirection: 'row',
        width: '100%',
        marginTop: clampedDepth <= 2 ? 1 : 0,
        marginBottom: 0,
      }}
    >
      <text fg={color} style={{ wrapMode: 'none' }} attributes={attributes}>
        {marker}
      </text>
      <box
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          flexGrow: 1,
          flexShrink: 1,
          gap: 0,
        }}
      >
        {renderHeadingContent(children, color, attributes)}
      </box>
    </box>
  )
}

interface MarkdownLinkProps {
  href: string
  children: ReactNode
  attributes?: number
}

export function MarkdownLink({
  href,
  children,
  attributes,
}: MarkdownLinkProps): ReactNode {
  const theme = useTheme()
  const isSafe = isSafeMarkdownLink(href)

  return (
    <Button
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        paddingLeft: 0,
        paddingRight: 0,
      }}
      onClick={isSafe ? () => void safeOpen(href) : undefined}
    >
      <text style={{ wrapMode: 'word', flexShrink: 1 }}>
        <span
          fg={isSafe ? theme.link : theme.muted}
          attributes={TextAttributes.UNDERLINE | (attributes ?? 0)}
        >
          {children}
        </span>
        <span fg={isSafe ? theme.link : theme.muted}> ↗</span>
      </text>
    </Button>
  )
}

interface MarkdownImageProps {
  src: string
  alt?: string
  availableWidth: number
}

interface LoadedImage {
  base64: string
  mediaType: string
}

const parseDataImage = (source: string): LoadedImage | null => {
  const match = source.match(
    /^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/,
  )
  if (!match) return null
  const [, mediaType, base64] = match
  if (!mediaType || !base64) return null
  if (Buffer.from(base64, 'base64').byteLength > MAX_MARKDOWN_IMAGE_BYTES) {
    return null
  }
  return { base64, mediaType }
}

const inferMediaType = (source: string): string | null => {
  const extension = path.extname(source).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.webp') return 'image/webp'
  return null
}

const readLocalImage = async (source: string): Promise<LoadedImage | null> => {
  try {
    const workspaceRoot = await fs.realpath(path.resolve(process.cwd()))
    const requestedPath = source.startsWith('file://')
      ? path.resolve(fileURLToPath(source))
      : path.resolve(workspaceRoot, source)
    const filePath = await fs.realpath(requestedPath)
    const relativePath = path.relative(workspaceRoot, filePath)
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return null
    }
    const stats = await fs.stat(filePath)
    if (!stats.isFile() || stats.size > MAX_MARKDOWN_IMAGE_BYTES) return null
    const mediaType = inferMediaType(filePath)
    if (!mediaType || !INLINE_IMAGE_MEDIA_TYPES.has(mediaType)) return null
    const bytes = await fs.readFile(filePath)
    return {
      base64: Buffer.from(bytes).toString('base64'),
      mediaType,
    }
  } catch {
    return null
  }
}

const loadImage = async (source: string): Promise<LoadedImage | null> => {
  const dataImage = parseDataImage(source)
  if (dataImage) return dataImage
  // Remote images intentionally use the bounded fallback card. The Markdown
  // renderer must not perform network I/O as a side effect of streaming text.
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return null
  }
  return readLocalImage(source)
}

export function MarkdownImage({
  src,
  alt,
  availableWidth,
}: MarkdownImageProps): ReactNode {
  const theme = useTheme()
  const [loaded, setLoaded] = useState<LoadedImage | null>(() =>
    parseDataImage(src),
  )
  const canLoadLocally =
    loaded !== null ||
    (!src.startsWith('http://') && !src.startsWith('https://'))
  const [isLoading, setIsLoading] = useState(canLoadLocally && loaded === null)
  const displaySize = useMemo(
    () => calculateDisplaySize({ availableWidth }),
    [availableWidth],
  )

  useEffect(() => {
    let active = true
    const shouldLoad = !src.startsWith('http://') && !src.startsWith('https://')
    setIsLoading(shouldLoad && loaded === null)

    if (!shouldLoad) {
      setLoaded(null)
      setIsLoading(false)
      return () => {
        active = false
      }
    }

    void loadImage(src).then((result) => {
      if (!active) return
      setLoaded(result)
      setIsLoading(false)
    })

    return () => {
      active = false
    }
    // The source is the ownership boundary for loading; initial data images
    // are still refreshed safely when the Markdown node changes.
  }, [src])

  const inlineSequence =
    loaded &&
    INLINE_IMAGE_MEDIA_TYPES.has(loaded.mediaType) &&
    supportsInlineImages()
      ? renderInlineImage(loaded.base64, {
          width: displaySize.width,
          height: displaySize.height,
          filename: alt,
        })
      : null

  if (inlineSequence) {
    return (
      <box style={{ flexDirection: 'column', gap: 0, flexShrink: 1 }}>
        <text fg={theme.muted} style={{ wrapMode: 'word' }}>
          <span attributes={TextAttributes.DIM}>🖼 </span>
          {alt || 'Image'}
        </text>
        <text style={{ wrapMode: 'none' }}>{inlineSequence}</text>
      </box>
    )
  }

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="rounded"
      borderColor={theme.border}
      style={{
        gap: 0,
        width: '100%',
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={theme.foreground} attributes={TextAttributes.BOLD}>
        🖼 {alt || 'Image'}
      </text>
      <text fg={theme.muted} style={{ wrapMode: 'word' }}>
        {isLoading ? 'Loading image…' : `Image unavailable: ${src}`}
      </text>
    </box>
  )
}
