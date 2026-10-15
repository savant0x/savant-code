import {
  createFidDocument,
  getFidDocument,
  updateFidDocument,
} from '@savant-code/database/service'

import { logger } from './logger'

// FID-2026-1006-003 (quality-gate): the FID-document persistence helpers,
// extracted verbatim from db-storage.ts — chat-state persistence and FID
// document persistence are separate concerns.

// Check if a path is an FID document path.
// FID-006 CLI1: tolerate both '/' and '\\' separators so native Windows paths
// (dev\fids\...) match instead of silently skipping FID persistence.
export function isFidPath(filePath: string): boolean {
  // Match paths like: dev/fids/FID-*.md or dev/fids/archive/FID-*.md
  return /^dev[\\/]fids[\\/](archive[\\/])?FID-.*\.md$/.test(filePath)
}
// Extract FID name from path (e.g., "dev/fids/FID-123.md" -> "FID-123")
export function extractFidNameFromPath(filePath: string): string {
  const match = filePath.match(
    /dev[\\/]fids[\\/](?:archive[\\/])?(FID-[^/]+)\.md$/,
  )
  return match ? match[1] : ''
}
// Save FID document to database
export function saveFidDocumentToDb(
  filePath: string,
  content: string,
  sessionId?: string,
): void {
  try {
    const fidName = extractFidNameFromPath(filePath)
    if (!fidName) {
      return
    }
    // Extract status from content (look for status line in FID)
    const statusMatch = content.match(/## Status\s*\n\s*-\s*\*\*(\w+)\*\*/i)
    const status = statusMatch ? statusMatch[1].toLowerCase() : 'in_progress'
    // Extract perfection loop phase
    const phaseMatch = content.match(
      /## Perfection Loop Phase\s*\n\s*-\s*\*\*(\w+)\*\*/i,
    )
    const perfectionLoopPhase = phaseMatch ? phaseMatch[1].toLowerCase() : 'red'
    // Check if FID already exists in database
    const existingFid = getFidDocument(fidName)
    if (existingFid) {
      // Update existing FID
      updateFidDocument(fidName, content, status, perfectionLoopPhase)
    } else {
      // Create new FID with FID name as ID
      createFidDocument(sessionId || 'unknown', content, fidName)
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to save FID document to database',
    )
  }
}
