import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { useChatStore } from '../state/chat-store'

// ---------------------------------------------------------------------------
// File / folder attachments
// ---------------------------------------------------------------------------

const MAX_FILE_READ_SIZE = 1024 * 1024 // 1 MB – don't read files larger than this
const MAX_CONTENT_CHARS = 100 * 1024 // 100 KB of text content
const MAX_DIR_ENTRIES = 100

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function isBinaryBuffer(buffer: Buffer): boolean {
  const sampleSize = Math.min(buffer.length, 8192)
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

/**
 * Add a file or folder as a pending attachment.
 * Reads the content in the background and updates the store.
 */
export function addPendingFileFromPath(
  filePath: string,
  isDirectory: boolean,
): void {
  const id = crypto.randomUUID()
  const filename = path.basename(filePath) || filePath

  useChatStore.getState().addPendingFileAttachment({
    id,
    path: filePath,
    filename,
    isDirectory,
    content: '',
    status: 'processing',
  })

  // Read content asynchronously (via setTimeout) so the UI shows immediately
  setTimeout(() => {
    try {
      let content: string
      let note: string

      if (isDirectory) {
        const entries = readdirSync(filePath, { withFileTypes: true })
        const count = entries.length
        note = `${count} item${count !== 1 ? 's' : ''}`

        if (count === 0) {
          content = '(empty directory)'
        } else {
          // Sort: directories first, then files, alphabetically within each group
          const sorted = [...entries].sort((a, b) => {
            const aIsDir = a.isDirectory()
            const bIsDir = b.isDirectory()
            if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
            return a.name.localeCompare(b.name)
          })
          const listing = sorted
            .slice(0, MAX_DIR_ENTRIES)
            .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
            .join('\n')
          content = listing
          if (count > MAX_DIR_ENTRIES) {
            content += `\n… and ${count - MAX_DIR_ENTRIES} more`
          }
        }
      } else {
        const stats = statSync(filePath)

        if (stats.size === 0) {
          content = '(empty file)'
          note = '0 B'
        } else if (stats.size > MAX_FILE_READ_SIZE) {
          content = `(file too large to preview: ${formatFileSize(stats.size)})`
          note = formatFileSize(stats.size)
        } else {
          const buffer = readFileSync(filePath)
          if (isBinaryBuffer(buffer)) {
            content = '(binary file)'
            note = `${formatFileSize(stats.size)} (binary)`
          } else {
            const text = buffer.toString('utf-8')
            if (text.length > MAX_CONTENT_CHARS) {
              content = text.slice(0, MAX_CONTENT_CHARS) + '\n… (truncated)'
              note = formatFileSize(stats.size)
            } else {
              content = text
              note = formatFileSize(stats.size)
            }
          }
        }
      }

      useChatStore.setState((state) => ({
        pendingAttachments: state.pendingAttachments.map((att) => {
          if (att.kind !== 'file' || att.id !== id) return att
          return { ...att, content, status: 'ready' as const, note }
        }),
      }))
    } catch {
      useChatStore.setState((state) => ({
        pendingAttachments: state.pendingAttachments.map((att) => {
          if (att.kind !== 'file' || att.id !== id) return att
          return { ...att, status: 'error' as const, note: 'Failed to read' }
        }),
      }))
    }
  }, 0)
}
