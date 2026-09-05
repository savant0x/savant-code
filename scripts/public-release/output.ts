// FID-2026-0905-007 — public-release decomposition: captured-output reader.
//
// Lenient decode of captured command transcripts — a stray non-UTF8 byte
// must never mask the command's real exit status (FID-2026-0808-003 audit).
// Verbatim move from scripts/public-release.ts.

import { readFileSync } from 'fs'

export function readCapturedOutput(filePath: string | undefined): string {
  if (!filePath) return ''
  const bytes = readFileSync(filePath)
  // Lenient decode: a stray non-UTF8 byte must never mask the command's real
  // exit status or destroy the transcript evidence (FID-2026-0808-003 audit).
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}
