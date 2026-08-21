import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { TextAttributes } from '@opentui/core'
import React, { useEffect, useMemo, useState, type ReactNode } from 'react'

import { useTheme } from '../../hooks/use-theme'
import { calculateDisplaySize } from '../../utils/image-display'
import {
  renderInlineImage,
  supportsInlineImages,
} from '../../utils/terminal-images'

const MAX_MARKDOWN_IMAGE_BYTES = 4 * 1024 * 1024
const INLINE_IMAGE_MEDIA_TYPES = new Set(['image/png'])

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
