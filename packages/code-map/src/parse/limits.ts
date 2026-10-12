import * as fs from 'fs'

/**
 * Parse-budget limits and source-loading helpers.
 * (FID-2026-0809-016: extracted from `packages/code-map/src/parse.ts`.)
 */

export const DEFAULT_MAX_PARSE_FILES = 10_000
export const DEFAULT_MAX_PARSE_FILE_BYTES = 1_000_000
export const DEFAULT_MAX_TOTAL_PARSE_BYTES = 500_000_000

export const MAX_PARSE_FILES = getPositiveIntegerEnv(
  'SAVANT_CODE_MAX_PARSE_FILES',
  DEFAULT_MAX_PARSE_FILES,
)
export const MAX_PARSE_FILE_BYTES = getPositiveIntegerEnv(
  'SAVANT_CODE_MAX_PARSE_FILE_BYTES',
  DEFAULT_MAX_PARSE_FILE_BYTES,
)
export const MAX_TOTAL_PARSE_BYTES = getPositiveIntegerEnv(
  'SAVANT_CODE_MAX_TOTAL_PARSE_BYTES',
  DEFAULT_MAX_TOTAL_PARSE_BYTES,
)

export type SourceReader = (
  filePath: string,
) => string | null | Promise<string | null>

export function loadSourceWithinLimits(params: {
  filePath: string
  readFile?: (filePath: string) => string | null
  maxBytes: number
  remainingBytes: number
}): { code: string; bytes: number } | null {
  const { filePath, readFile, maxBytes, remainingBytes } = params

  if (!readFile) {
    let bytes: number
    let code: string
    try {
      // stat + read in one window: a file that vanishes before or between
      // the two (or is unreadable) is a skip, not a parse error (TOCTOU,
      // CM-7, FID-2026-0803-006).
      bytes = fs.statSync(filePath).size
      const cap = Math.min(maxBytes, remainingBytes)
      if (bytes > cap) return null
      const descriptor = fs.openSync(filePath, 'r')
      try {
        const buffer = Buffer.alloc(Math.min(bytes, cap) + 1)
        let count = 0
        while (count < buffer.length) {
          const read = fs.readSync(
            descriptor,
            buffer,
            count,
            buffer.length - count,
            null,
          )
          if (read === 0) break
          count += read
        }
        if (
          count > cap ||
          count !== bytes ||
          fs.fstatSync(descriptor).size !== bytes
        )
          return null
        code = buffer.subarray(0, count).toString('utf8')
        bytes = Buffer.byteLength(code, 'utf8')
      } finally {
        fs.closeSync(descriptor)
      }
    } catch {
      return null
    }
    if (bytes > maxBytes || bytes > remainingBytes) return null

    return { code, bytes }
  }

  const code = readFile(filePath)
  if (code === null) return null

  const bytes = Buffer.byteLength(code, 'utf8')
  if (bytes > maxBytes || bytes > remainingBytes) return null

  return { code, bytes }
}

export function getPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback

  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
