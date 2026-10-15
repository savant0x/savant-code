import { spawnSync } from 'child_process'
import { existsSync, writeFileSync } from 'fs'
import path from 'path'

import { generateImageFilename, getClipboardTempDir } from './temp'

import type { ClipboardImageResult } from './types'

/**
 * Check if clipboard contains an image (Linux)
 */
export function hasImageLinux(): boolean {
  try {
    // Check available clipboard targets
    const result = spawnSync(
      'xclip',
      ['-selection', 'clipboard', '-t', 'TARGETS', '-o'],
      { encoding: 'utf-8', timeout: 5000 },
    )

    if (result.status !== 0) {
      // Try wl-paste for Wayland
      const wlResult = spawnSync('wl-paste', ['--list-types'], {
        encoding: 'utf-8',
        timeout: 5000,
      })
      if (wlResult.status === 0) {
        const output = wlResult.stdout || ''
        return output.includes('image/')
      }
      return false
    }

    const output = result.stdout || ''
    return (
      output.includes('image/png') ||
      output.includes('image/jpeg') ||
      output.includes('image/tiff')
    )
  } catch {
    return false
  }
}

/**
 * Read image from clipboard (Linux)
 */
export function readImageLinux(): ClipboardImageResult {
  try {
    const tempDir = getClipboardTempDir()
    const filename = generateImageFilename()
    const imagePath = path.join(tempDir, filename)

    // Try xclip first
    let result = spawnSync(
      'xclip',
      ['-selection', 'clipboard', '-t', 'image/png', '-o'],
      { timeout: 5000, maxBuffer: 50 * 1024 * 1024 },
    )

    if (result.status === 0 && result.stdout && result.stdout.length > 0) {
      writeFileSync(imagePath, result.stdout)
      return { success: true, imagePath, filename }
    }

    // Try wl-paste for Wayland
    result = spawnSync('wl-paste', ['--type', 'image/png'], {
      timeout: 5000,
      maxBuffer: 50 * 1024 * 1024,
    })

    if (result.status === 0 && result.stdout && result.stdout.length > 0) {
      writeFileSync(imagePath, result.stdout)
      return { success: true, imagePath, filename }
    }

    return {
      success: false,
      error: 'No image found in clipboard or failed to read',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Read file path from clipboard when a file has been copied (Linux).
 * Returns the file path if found, null otherwise.
 */
export function readClipboardFilePathLinux(): string | null {
  try {
    // Try to get file URI from clipboard
    let result = spawnSync(
      'xclip',
      ['-selection', 'clipboard', '-t', 'text/uri-list', '-o'],
      { encoding: 'utf-8', timeout: 1000 },
    )

    if (result.status !== 0) {
      // Try wl-paste for Wayland
      result = spawnSync('wl-paste', ['--type', 'text/uri-list'], {
        encoding: 'utf-8',
        timeout: 1000,
      })
    }

    if (result.status === 0 && result.stdout) {
      const output = result.stdout.trim()
      // Parse file:// URLs
      const lines = output.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('file://')) {
          const filePath = decodeURIComponent(trimmed.slice(7))
          if (existsSync(filePath)) {
            return filePath
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}
