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
 * Extract a metadata field from FID markdown content.
 *
 * Supports BOTH metadata formats the agent has produced in the wild:
 *   legacy: `**ID:** FID-2026-0804-001`  (colon inside the bold span)
 *   table:  `| **ID** | FID-2026-0804-005-semantic-caching-engine |`
 *
 * The `:?` is INSIDE the bold span so `**ID**` matches both `**ID**` (table)
 * and `**ID:**` (legacy, where the colon is part of the bolded token).
 * Whitespace before the value is bounded to `[ \t]` so it can never cross a
 * line boundary; the value capture `[^\r\n|]+` stops at the pipe/end-of-line.
 * Returns the trimmed value (backticks stripped), or `undefined`.
 */
function extractField(content: string, field: string): string | undefined {
  const legacy = content.match(
    new RegExp(`^\\s*\\*\\*${field}:\\*\\*[ \\t]+([^\\r\\n|]+)`, 'im'),
  )
  const table = content.match(
    new RegExp(
      `\\|[ \\t]*\\*\\*${field}\\*\\*[ \\t]*\\|[ \\t]*([^\\r\\n|]+)`,
      'im',
    ),
  )
  const raw = legacy?.[1] ?? table?.[1]
  if (!raw) return undefined
  const value = raw.replace(/`/g, '').trim()
  return value && value.length > 0 ? value : undefined
}

/**
 * Extract the text of a `## <heading>` section up to the next heading or EOF.
 */
function extractSection(
  normalized: string,
  heading: string,
): string | undefined {
  const match = normalized.match(
    new RegExp(`##\\s+${heading}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s|$)`),
  )
  const section = match?.[1]?.trim()
  return section && section.length > 0 ? section : undefined
}

/**
 * Extract the FID summary.
 *
 * Prefers the `## Summary` section (legacy template), then the
 * `## Problem Statement` section (the format the agent writes in production),
 * then falls back to the short title fragment after the em-dash.
 */
function extractSummary(content: string): string | undefined {
  // Normalize line endings so CRLF files parse the same as LF files.
  const normalized = content.replace(/\r\n/g, '\n')

  return (
    extractSection(normalized, 'Summary') ??
    extractSection(normalized, 'Problem Statement') ??
    // Fallback to the short title fragment after the em-dash.
    (() => {
      const titleMatch = normalized.match(/^#\s+FID-[^\n]+[—-]\s*(.+)/m)
      return titleMatch?.[1]?.trim()
    })()
  )
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
    const parentId = extractField(content, 'Parent')

    if (!id) return undefined

    return {
      id,
      status,
      severity,
      summary,
      ...(parentId !== undefined ? { parentId } : {}),
      path: filePath,
    }
  } catch {
    // Law 14: per-file error isolation — one unreadable file doesn't block others
    return undefined
  }
}

/**
 * Complete FID inventory for the harness — active (top-level) plus archived
 * (closed, in `archive/`). The sidebar uses both so a converged project with a
 * rich FID history is visible instead of appearing FID-less.
 */
export interface FidInventory {
  /** FIDs in `dev/fids/` (open/active). */
  active: FidData[]
  /** FIDs in `dev/fids/archive/` (closed). */
  archived: FidData[]
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/** Sort FIDs by severity (critical first), then by ID. */
function sortFids(fids: FidData[]): FidData[] {
  return fids.sort((a, b) => {
    const sevDiff =
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    if (sevDiff !== 0) return sevDiff
    return a.id.localeCompare(b.id)
  })
}

/**
 * Read every `FID-*.md` in a directory (Law 14: never throws — missing or
 * unreadable directories yield an empty list; malformed files are skipped).
 */
function readFidDir(dir: string): FidData[] {
  if (!existsSync(dir)) return []

  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }

  return entries
    .filter((name) => name.startsWith('FID-') && name.endsWith('.md'))
    .map((name) => parseFidFile(join(dir, name)))
    .filter((fid): fid is FidData => fid !== undefined)
}

/**
 * Load the complete FID inventory: active FIDs from `dev/fids/` plus archived
 * FIDs from `dev/fids/archive/`. Harness-driven — no agent involvement.
 *
 * @param fidsDir - Optional override for the FIDs directory (defaults to
 *   `cwd/dev/fids`). Used by tests to point at a fixture directory.
 * @returns `{ active, archived }`, each sorted by severity then ID. Never
 *   throws — missing directories yield empty lists (Law 14).
 */
export function loadFidInventory(
  fidsDir: string = join(process.cwd(), DEFAULT_FIDS_DIR),
): FidInventory {
  return {
    active: sortFids(readFidDir(fidsDir)),
    archived: sortFids(readFidDir(join(fidsDir, 'archive'))),
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
export function loadFids(
  fidsDir: string = join(process.cwd(), DEFAULT_FIDS_DIR),
): FidData[] {
  return loadFidInventory(fidsDir).active
}
