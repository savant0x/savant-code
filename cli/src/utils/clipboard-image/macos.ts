import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

import { generateImageFilename, getClipboardTempDir } from './temp'

import type { ClipboardImageResult } from './types'

/**
 * Check if clipboard contains an image (macOS)
 * Uses 'clipboard info' which is the fastest way to check clipboard types.
 *
 * Note: We do NOT filter out clipboards that contain file URLs here, because
 * copying images from Finder/Preview/Safari often includes both a file URL
 * AND the actual image data. The caller handles priority (file paths are
 * checked first via clipboard text, then we fall back to image data).
 */
export function hasImageMacOS(): boolean {
  try {
    const result = spawnSync('osascript', ['-e', 'clipboard info'], {
      encoding: 'utf-8',
      timeout: 1000,
    })

    if (result.status !== 0) {
      return false
    }

    const output = result.stdout || ''

    // Check for image types in clipboard info
    return (
      output.includes('«class PNGf»') ||
      output.includes('TIFF') ||
      output.includes('«class JPEG»') ||
      output.includes('public.png') ||
      output.includes('public.tiff') ||
      output.includes('public.jpeg')
    )
  } catch {
    return false
  }
}

/**
 * Read image from clipboard (macOS)
 */
export function readImageMacOS(): ClipboardImageResult {
  try {
    const tempDir = getClipboardTempDir()
    const filename = generateImageFilename()
    const imagePath = path.join(tempDir, filename)

    // Try pngpaste first (if installed)
    const pngpasteResult = spawnSync('pngpaste', [imagePath], {
      encoding: 'utf-8',
      timeout: 5000,
    })

    if (pngpasteResult.status === 0 && existsSync(imagePath)) {
      return { success: true, imagePath, filename }
    }

    // Fallback: use osascript to save clipboard image
    const script = `
      set thePath to "${imagePath}"
      try
        set imageData to the clipboard as «class PNGf»
        set fileRef to open for access thePath with write permission
        write imageData to fileRef
        close access fileRef
        return "success"
      on error
        try
          set imageData to the clipboard as TIFF picture
          -- Convert TIFF to PNG using sips
          set tiffPath to "${imagePath}.tiff"
          set fileRef to open for access tiffPath with write permission
          write imageData to fileRef
          close access fileRef
          do shell script "sips -s format png " & quoted form of tiffPath & " --out " & quoted form of thePath
          do shell script "rm " & quoted form of tiffPath
          return "success"
        on error errMsg
          return "error: " & errMsg
        end try
      end try
    `

    const result = spawnSync('osascript', ['-e', script], {
      encoding: 'utf-8',
      timeout: 10000,
    })

    if (result.status === 0 && existsSync(imagePath)) {
      return { success: true, imagePath, filename }
    }

    return {
      success: false,
      error: result.stderr || 'Failed to read image from clipboard',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Read file URL/path from clipboard when a file has been copied (e.g., from Finder).
 * Returns the POSIX path if a file URL is found, null otherwise.
 *
 * When you copy a file in Finder (Cmd+C), the clipboard contains a file reference,
 * not plain text. pbpaste won't return the path, but we can use AppleScript to
 * extract it.
 */
export function readClipboardFilePathMacOS(): string | null {
  try {
    // First check if clipboard contains a file URL
    const infoResult = spawnSync('osascript', ['-e', 'clipboard info'], {
      encoding: 'utf-8',
      timeout: 1000,
    })

    if (infoResult.status !== 0) return null

    const info = infoResult.stdout || ''
    // Check for file URL type in clipboard (furl = file URL)
    if (!info.includes('«class furl»') && !info.includes('public.file-url')) {
      return null
    }

    // Extract the file path using AppleScript
    const script = `
      try
        set theFile to the clipboard as «class furl»
        return POSIX path of theFile
      on error
        return ""
      end try
    `

    const result = spawnSync('osascript', ['-e', script], {
      encoding: 'utf-8',
      timeout: 1000,
    })

    if (result.status === 0 && result.stdout) {
      const filePath = result.stdout.trim()
      if (filePath && existsSync(filePath)) {
        return filePath
      }
    }
    return null
  } catch {
    return null
  }
}
