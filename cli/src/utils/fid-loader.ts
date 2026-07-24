/**
 * FID Loader Utility (FID-2026-0720-033c Phase C)
 *
 * Reads `dev/fids/*.md` from the project root, parses each FID markdown
 * file's metadata fields (ID, Status, Severity, Summary), and returns a
 * `FidData[]` array for consumption by the `<FidList>` component.
 *
 * This closes the Law 4 gap where `<FidList>` was a presentational component
 * with no production data source — it required callers to pass `fids` as
 * props, but no caller actually loaded FID data from disk.
 *
 * Parsing is regex-based (not a full markdown parser) because FID files follow
 * a strict template (`templates/FID-TEMPLATE.md`) with `**Field:** value`
 * metadata lines. A full AST parser would be overkill for extracting 4 fields.
 *
 * Law 14 (error paths): file-system errors (missing dir, unreadable file)
 * degrade gracefully — the loader returns an empty array rather than throwing.
 * Individual file parse errors are caught per-file so one malformed FID does
 * not prevent the rest from loading.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { FidData } from '../components/savant-ui/echo/fid-list'

/**
 * Default FIDs directory relative to the project root (cwd).
 */
const DEFAULT_FIDS_DIR = join('dev', 'fids')

/**
 * Extract a `**Field:** value` metadata line from FID markdown content.
 * Returns the trimmed value, or `undefined` if the field is not found.
 */
function extractField(content: string, field: string): string | undefined {
  const match = content.match(
    new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`, 'm'),
  )
  const value = match?.[1]?.trim()
  return value && value.length > 0 ? value : undefined
}

/**
 * Extract the FID summary from the `## Summary` section first.
 *
 * The template's `## Summary` section is intended to be a full paragraph, so
 * we prefer the first paragraph of that section over the short title fragment.
 * Falls back to the title fragment (`# FID-... — Summary Text`) when no
 * Summary section exists.
 */
function extractSummary(content: string): string | undefined {
  // Normalize line endings so CRLF files parse the same as LF files.
  const normalized = content.replace(/\r\n/g, '\n')

  // Prefer the complete content of the `## Summary` section up to the next
  // heading or end of file.
  const summarySectionMatch = normalized.match(
    /##\s+Summary\s*\n+([\s\S]*?)(?=\n##\s|$)/,
  )
  if (summarySectionMatch) {
    const summary = summarySectionMatch[1].trim()
    if (summary) return summary
  }

  // Fallback to the short title fragment after the em-dash.
  const titleMatch = normalized.match(/^#\s+FID-[^\n]+[—-]\s*(.+)/m)
  if (titleMatch) return titleMatch[1].trim()

  return undefined
}

/**
 * Parse a single FID markdown file into a `FidData` object.
 * Returns `undefined` if the file cannot be parsed (missing required fields).
 */
function parseFidFile(filePath: string): FidData | undefined {
  try {
    const content = readFileSync(filePath, 'utf-8')

    const id = extractField(content, 'ID')
    const status = extractField(content, 'Status') ?? 'unknown'
    const severity = extractField(content, 'Severity') ?? 'medium'
    const summary = extractSummary(content) ?? id ?? 'Untitled FID'

    if (!id) return undefined

    return { id, status, severity, summary }
  } catch {
    // Law 14: per-file error isolation — one unreadable file doesn't block others
    return undefined
  }
}

/**
 * Load all active FIDs from `dev/fids/` (excluding the `archive/` subdirectory).
 *
 * @param fidsDir - Optional override for the FIDs directory (defaults to
 *   `cwd/dev/fids`). Used by tests to point at a fixture directory.
 * @returns Array of `FidData` sorted by severity (critical first), then by ID.
 *   Returns an empty array if the directory does not exist or contains no
 *   valid FID files (Law 14 — never throws).
 */
export function loadFids(fidsDir: string = join(process.cwd(), DEFAULT_FIDS_DIR)): FidData[] {
  if (!existsSync(fidsDir)) return []

  let entries: string[]
  try {
    entries = readdirSync(fidsDir)
  } catch {
    return []
  }

  const fidFiles = entries.filter(
    (name) => name.startsWith('FID-') && name.endsWith('.md'),
  )

  const fids = fidFiles
    .map((name) => parseFidFile(join(fidsDir, name)))
    .filter((fid): fid is FidData => fid !== undefined)

  const SEVERITY_ORDER: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  return fids.sort((a, b) => {
    const sevDiff =
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    if (sevDiff !== 0) return sevDiff
    return a.id.localeCompare(b.id)
  })
}
