import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

import { generateImageFilename, getClipboardTempDir } from './temp'

import type { ClipboardImageResult } from './types'

/**
 * Check if clipboard contains an image (Windows)
 */
export function hasImageWindows(): boolean {
  try {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      if ([System.Windows.Forms.Clipboard]::ContainsImage()) { Write-Output "true" } else { Write-Output "false" }
    `
    const result = spawnSync('powershell', ['-STA', '-Command', script], {
      encoding: 'utf-8',
      timeout: 5000,
    })

    return result.stdout?.trim() === 'true'
  } catch {
    return false
  }
}

/**
 * Read image from clipboard (Windows)
 */
export function readImageWindows(): ClipboardImageResult {
  try {
    const tempDir = getClipboardTempDir()
    const filename = generateImageFilename()
    const imagePath = path.join(tempDir, filename)

    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $img = [System.Windows.Forms.Clipboard]::GetImage()
      if ($img -ne $null) {
        $img.Save('${imagePath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Output "success"
      } else {
        Write-Output "no image"
      }
    `

    const result = spawnSync('powershell', ['-STA', '-Command', script], {
      encoding: 'utf-8',
      timeout: 10000,
    })

    if (result.stdout?.trim() === 'success' && existsSync(imagePath)) {
      return { success: true, imagePath, filename }
    }

    return {
      success: false,
      error: 'No image in clipboard or failed to save',
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Read file path from clipboard when a file has been copied (Windows).
 * Returns the file path if found, null otherwise.
 */
export function readClipboardFilePathWindows(): string | null {
  try {
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $files = [System.Windows.Forms.Clipboard]::GetFileDropList()
      if ($files.Count -gt 0) {
        Write-Output $files[0]
      }
    `
    const result = spawnSync('powershell', ['-STA', '-Command', script], {
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
