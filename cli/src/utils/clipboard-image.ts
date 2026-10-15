import { spawnSync } from 'child_process'
import { existsSync, statSync } from 'fs'

import {
  hasImageLinux,
  readClipboardFilePathLinux,
  readImageLinux,
} from './clipboard-image/linux'
import {
  hasImageMacOS,
  readClipboardFilePathMacOS,
  readImageMacOS,
} from './clipboard-image/macos'
import {
  hasImageWindows,
  readClipboardFilePathWindows,
  readImageWindows,
} from './clipboard-image/windows'
import { isImageFile, resolveFilePath } from './image-handler'

import type { ClipboardImageResult } from './clipboard-image/types'

export type { ClipboardImageResult } from './clipboard-image/types'

/**
 * Check if clipboard contains an image (cross-platform)
 */
export function hasClipboardImage(): boolean {
  const platform = process.platform

  switch (platform) {
    case 'darwin':
      return hasImageMacOS()
    case 'linux':
      return hasImageLinux()
    case 'win32':
      return hasImageWindows()
    default:
      return false
  }
}

/**
 * Read image from clipboard and save to temp file
 * Returns the path to the saved image file
 */
export function readClipboardImage(): ClipboardImageResult {
  const platform = process.platform

  switch (platform) {
    case 'darwin':
      return readImageMacOS()
    case 'linux':
      return readImageLinux()
    case 'win32':
      return readImageWindows()
    default:
      return {
        success: false,
        error: `Unsupported platform: ${platform}`,
      }
  }
}

/**
 * Check if text looks like a single file path pointing to an existing non-image
 * file or folder. Used to detect drag-drop of files/folders into the terminal.
 * Returns the resolved path and whether it's a directory, or null.
 */
export function getFileOrFolderPathFromText(
  text: string,
  cwd: string,
): { path: string; isDirectory: boolean } | null {
  // Must be single line
  if (text.includes('\n') || text.includes('\r')) return null

  let trimmed = text.trim()
  if (!trimmed) return null

  // Handle file:// URLs
  if (trimmed.startsWith('file://')) {
    trimmed = decodeURIComponent(trimmed.slice(7))
  }

  // Skip other URLs
  if (trimmed.includes('://')) return null

  // Remove surrounding quotes
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1)
  }

  try {
    const resolvedPath = resolveFilePath(trimmed, cwd)
    if (!existsSync(resolvedPath)) return null
    // Skip images — they're handled by image-specific logic
    if (isImageFile(resolvedPath)) return null

    const stats = statSync(resolvedPath)
    return {
      path: resolvedPath,
      isDirectory: stats.isDirectory(),
    }
  } catch {
    return null
  }
}

/**
 * Check if text looks like a single file path pointing to an existing image.
 * Used to detect drag-drop of image files into the terminal.
 * Returns the resolved absolute path if valid, null otherwise.
 */
export function getImageFilePathFromText(
  text: string,
  cwd: string,
): string | null {
  // Must be single line (no internal newlines, including Windows \r\n)
  if (text.includes('\n') || text.includes('\r')) return null

  // Must not be empty or have only whitespace
  let trimmed = text.trim()
  if (!trimmed) return null

  // Handle file:// URLs that some systems use for dragged files
  if (trimmed.startsWith('file://')) {
    trimmed = decodeURIComponent(trimmed.slice(7))
  }

  // Skip if it looks like a URL (but not file:// which we already handled)
  if (trimmed.includes('://')) return null

  // Remove surrounding quotes that some terminals add
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1)
  }

  try {
    // Try to resolve the path
    const resolvedPath = resolveFilePath(trimmed, cwd)

    // Check if file exists
    if (!existsSync(resolvedPath)) return null

    // Check if it's a supported image format
    if (!isImageFile(resolvedPath)) return null

    return resolvedPath
  } catch {
    return null
  }
}

/**
 * Read file path from clipboard when a file has been copied.
 * This handles the case where a user copies a file in their file manager.
 * Returns the file path if found, null otherwise.
 *
 * Note: This returns ANY file path, not just images. Callers should check
 * if the file is an image using isImageFile() if needed.
 */
export function readClipboardFilePath(): string | null {
  const platform = process.platform

  switch (platform) {
    case 'darwin':
      return readClipboardFilePathMacOS()
    case 'win32':
      return readClipboardFilePathWindows()
    case 'linux':
      return readClipboardFilePathLinux()
    default:
      return null
  }
}

/**
 * Read image file path from clipboard when an image file has been copied.
 * This is a convenience wrapper that combines readClipboardFilePath() with
 * an image file check.
 * Returns the file path if it's an image file, null otherwise.
 */
export function readClipboardImageFilePath(): string | null {
  const filePath = readClipboardFilePath()
  if (filePath && isImageFile(filePath)) {
    return filePath
  }
  return null
}

/**
 * Read text from clipboard. Returns null if reading fails.
 */
export function readClipboardText(): string | null {
  try {
    const platform = process.platform
    let result: ReturnType<typeof spawnSync>

    switch (platform) {
      case 'darwin':
        result = spawnSync('pbpaste', [], { encoding: 'utf-8', timeout: 1000 })
        break
      case 'win32':
        result = spawnSync('powershell', ['-Command', 'Get-Clipboard'], {
          encoding: 'utf-8',
          timeout: 1000,
        })
        break
      case 'linux':
        result = spawnSync('xclip', ['-selection', 'clipboard', '-o'], {
          encoding: 'utf-8',
          timeout: 1000,
        })
        break
      default:
        return null
    }

    if (result.status === 0 && result.stdout) {
      const output =
        typeof result.stdout === 'string'
          ? result.stdout
          : result.stdout.toString('utf-8')
      return output.replace(/\n+$/, '')
    }
    return null
  } catch {
    return null
  }
}
