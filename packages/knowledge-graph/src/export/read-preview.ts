import fs from 'fs'
import path from 'path'

import {
  IMAGE_TYPES,
  PREVIEW_MAX_BYTES,
  UNSUPPORTED_IMAGE_EXTENSIONS,
} from './constants'

import type { DocumentBudget } from './constants'
import type {
  UniverseDocument,
  UniverseImageDocument,
  UniverseUnavailableDocument,
} from './types'

export function positiveLimit(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : undefined
}

export function resolveContainedPath(
  projectRoot: string,
  relativePath: string,
): { path?: string; outside: boolean } {
  const root = path.resolve(projectRoot)
  const requested = path.resolve(root, relativePath)
  if (requested === root || !requested.startsWith(root + path.sep)) {
    return { outside: true }
  }
  try {
    const realRoot = fs.realpathSync(root)
    const realPath = fs.realpathSync(requested)
    if (realPath === realRoot || !realPath.startsWith(realRoot + path.sep)) {
      return { outside: true }
    }
    return { path: realPath, outside: false }
  } catch {
    return { outside: false }
  }
}

export function truncateUtf8(text: string, maxBytes: number): string {
  const encoded = Buffer.from(text, 'utf8')
  if (encoded.byteLength <= maxBytes) return text
  // Decode only a valid UTF-8 prefix. The boundary is at most four bytes away
  // from the requested cap, so this remains bounded while avoiding U+FFFD.
  for (
    let end = Math.min(maxBytes, encoded.byteLength);
    end >= Math.max(0, maxBytes - 4);
    end--
  ) {
    const bytes = encoded.subarray(0, end)
    const decoded = bytes.toString('utf8')
    if (Buffer.from(decoded, 'utf8').equals(bytes)) return decoded
  }
  return ''
}

/**
 * Bounded head read (FID-2026-0807-015): never loads more than the head cap
 * (+1 byte to detect truncation), so multi-hundred-MB sources stay cheap.
 */
export function readProbeBytes(containedPath: string): Buffer | undefined {
  let fd: number | undefined
  try {
    fd = fs.openSync(containedPath, 'r')
    const buffer = Buffer.allocUnsafe(8192)
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0)
    return buffer.subarray(0, bytesRead)
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd)
      } catch {
        // Best-effort probe cleanup.
      }
    }
  }
}

export function readBinarySignature(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 8192)
  if (head.includes(0)) return true
  const signatures = [
    [0x25, 0x50, 0x44, 0x46], // PDF
    [0x50, 0x4b, 0x03, 0x04], // ZIP/JAR
    [0x7f, 0x45, 0x4c, 0x46], // ELF
    [0x4d, 0x5a], // PE
  ]
  return signatures.some((signature) =>
    signature.every((byte, index) => head[index] === byte),
  )
}

function countLines(text: string): number {
  if (!text) return 0
  let count = 1
  for (let index = 0; index < text.length; index++) {
    if (text.charCodeAt(index) === 10) count += 1
  }
  return count
}

export function unavailableDocument(
  unavailableReason: UniverseUnavailableDocument['unavailableReason'],
  byteCount: number | null,
): UniverseUnavailableDocument {
  return { kind: 'unavailable', byteCount, unavailableReason }
}

function hasSignature(
  buffer: Buffer,
  mime: UniverseImageDocument['mime'],
): boolean {
  const startsWith = (bytes: number[]): boolean =>
    bytes.every((byte, index) => buffer[index] === byte)
  if (mime === 'image/png') {
    return (
      buffer.length >= 33 &&
      startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
      buffer.subarray(12, 16).toString('ascii') === 'IHDR' &&
      buffer.readUInt32BE(16) > 0 &&
      buffer.readUInt32BE(20) > 0
    )
  }
  if (mime === 'image/jpeg') {
    return (
      buffer.length >= 4 &&
      startsWith([0xff, 0xd8, 0xff]) &&
      buffer[buffer.length - 2] === 0xff &&
      buffer[buffer.length - 1] === 0xd9
    )
  }
  if (mime === 'image/gif') {
    return (
      buffer.length >= 10 &&
      (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        buffer.subarray(0, 6).toString('ascii') === 'GIF89a') &&
      buffer.readUInt16LE(6) > 0 &&
      buffer.readUInt16LE(8) > 0
    )
  }
  return (
    buffer.length >= 30 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP' &&
    buffer.readUInt32LE(4) + 8 <= buffer.length
  )
}

export function fileDocument(
  projectRoot: string,
  relativePath: string,
  maxLines: number | undefined,
  maxBytes: number | undefined,
  maxImageBytes: number,
  budget: DocumentBudget,
): UniverseDocument {
  const contained = resolveContainedPath(projectRoot, relativePath)
  if (contained.outside) return unavailableDocument('outside-root', null)
  if (!contained.path) return unavailableDocument('unreadable', null)

  let stat: fs.Stats
  try {
    stat = fs.statSync(contained.path)
  } catch {
    return unavailableDocument('unreadable', null)
  }
  if (!stat.isFile()) return unavailableDocument('unreadable', null)

  const extension = path.extname(relativePath).toLowerCase()
  const mime = IMAGE_TYPES[extension]
  if (mime && stat.size > maxImageBytes) {
    return unavailableDocument('oversized', stat.size)
  }

  if (!mime && UNSUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return unavailableDocument('unsupported-image', stat.size)
  }
  const probe = readProbeBytes(contained.path)
  if (!probe) return unavailableDocument('unreadable', null)
  if (!mime && readBinarySignature(probe)) {
    return unavailableDocument('binary', stat.size)
  }

  let buffer: Buffer
  try {
    buffer = fs.readFileSync(contained.path)
  } catch {
    return unavailableDocument('unreadable', null)
  }
  if (mime) {
    if (!hasSignature(buffer, mime))
      return unavailableDocument('malformed-image', stat.size)
    if (budget.mediaBytes + buffer.byteLength > budget.maxTotalMediaBytes) {
      return unavailableDocument('oversized', stat.size)
    }
    budget.mediaBytes += buffer.byteLength
    return {
      kind: 'image',
      mime,
      dataUri: `data:${mime};base64,${buffer.toString('base64')}`,
      byteCount: stat.size,
      truncated: false,
    }
  }
  const source = buffer.toString('utf8')
  let text = source
  let truncated = false
  const hasExplicitTextCap =
    maxLines !== undefined ||
    maxBytes !== undefined ||
    budget.maxTotalTextBytes !== undefined
  if (maxLines !== undefined) {
    const sourceLines = source.split(/\r?\n/)
    const selectedLines = sourceLines.slice(0, maxLines)
    text = selectedLines.join('\n')
    truncated = selectedLines.length < sourceLines.length
  }
  if (maxBytes !== undefined && Buffer.byteLength(text, 'utf8') > maxBytes) {
    text = truncateUtf8(text, maxBytes)
    truncated = true
  }
  const embeddedBytes = Buffer.byteLength(text, 'utf8')
  if (
    budget.maxTotalTextBytes !== undefined &&
    budget.textBytes + embeddedBytes > budget.maxTotalTextBytes
  ) {
    const remaining = Math.max(0, budget.maxTotalTextBytes - budget.textBytes)
    text = truncateUtf8(text, remaining)
    truncated = true
  }
  const finalBytes = Buffer.byteLength(text, 'utf8')
  budget.textBytes += finalBytes
  return {
    kind: 'text',
    text,
    lineCount: countLines(text),
    byteCount: stat.size,
    truncated,
    explicitlyCapped: truncated && hasExplicitTextCap,
  }
}

/**
 * Read a capped code preview for a file. Returns undefined for binary files,
 * unreadable files, paths escaping the project root, or when previews are
 * disabled via SAVANT_GRAPH_EXPORT_NO_PREVIEW=1.
 */
export function readFilePreview(
  projectRoot: string,
  relativePath: string,
  maxLines: number,
  maxChars: number,
): string | undefined {
  // A hostile relative path (.., drive letter, or symlink) must never escape
  // the project root or read arbitrary files from disk.
  const contained = resolveContainedPath(projectRoot, relativePath)
  if (contained.outside || !contained.path) return undefined
  let stat: fs.Stats
  try {
    stat = fs.statSync(contained.path)
  } catch {
    return undefined
  }
  if (!stat.isFile() || stat.size > PREVIEW_MAX_BYTES) return undefined
  let buf: Buffer
  try {
    buf = fs.readFileSync(contained.path)
  } catch {
    return undefined
  }
  if (buf.length > PREVIEW_MAX_BYTES) return undefined
  // Binary probe: a NUL byte inside the first 8 KiB marks non-text content.
  if (buf.subarray(0, 8192).includes(0)) return undefined
  const lines = buf.toString('utf8').split(/\r?\n/)
  const slice = lines.slice(0, maxLines).join('\n')
  const capped =
    slice.length > maxChars ? slice.slice(0, maxChars) + '\n…' : slice
  return capped.length > 0 ? capped : undefined
}
