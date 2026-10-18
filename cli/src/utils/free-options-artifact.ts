/**
 * FID-2026-1017-005 — the free-options markdown artifact and its identity.
 *
 * The file the product points at must carry the path it was written to, when
 * it was written, which catalog it renders, and a hash over its own body. The
 * reader checks the path and `fetchedAt` against the current resolution and
 * re-hashes the body, so a copy in another config directory (or a truncated
 * file) cannot pass for the current artifact.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'

import {
  catalogDeltaLine,
  renderOffersMarkdownSection,
} from './free-options-offers'

import type {
  FreeOptionsArtifactCheck,
  FreeOptionsArtifactFailure,
  FreeOptionsReport,
} from './free-options-types'
import type { FreeOptionsView } from './free-options-view'

const HEADER_OPEN = '<!-- savant-free-options'
const HEADER_CLOSE = '-->'

/** Render the human/agent markdown body (no identity header). */
export function renderFreeOptionsMarkdownBody(view: FreeOptionsView): string {
  const lines: string[] = []
  const { header } = view
  lines.push('# Free options right now')
  lines.push('')
  lines.push(
    `fetchedAt: ${header.fetchedAt ?? 'none'}${header.fetchedAt ? ` (${header.freshness})` : ''}`,
  )
  const delta = catalogDeltaLine(view.newModelIds)
  if (delta) lines.push(delta)
  lines.push('')
  lines.push(
    '_Broad discovery evidence: this report includes non-coding, conditional and expired listings; it does not certify account access or tool support._',
  )
  lines.push('')
  lines.push(`## Wired — ${view.wiredCaveat}; account access unverified`)
  lines.push('')
  if (view.wired.length === 0) {
    lines.push('_No configured provider exposes models in the free catalog._')
  } else {
    for (const lane of view.wired) {
      lines.push(`### ${lane.label} (\`${lane.providerId}\`)`)
      lines.push('')
      for (const model of lane.models) lines.push(`- \`${model}\``)
      lines.push('')
    }
  }
  lines.push('## Free tiers you have NOT wired')
  lines.push('')
  if (view.notWired.length === 0) {
    lines.push(
      '_Every supported free-catalog provider has credentials configured._',
    )
  } else {
    for (const lane of view.notWired) {
      lines.push(
        `- **${lane.label}** — ${lane.models.length} free model(s): ${lane.models
          .map((model) => `\`${model}\``)
          .join(', ')} — run \`${lane.setupCommand}\``,
      )
    }
  }
  lines.push('')
  lines.push('## Local & free')
  lines.push('')
  for (const lane of view.local) {
    lines.push(
      `- **${lane.label}** — registered local integration; server and model presence unverified — \`${lane.setupCommand}\``,
    )
  }
  lines.push('')
  for (const lane of view.discoveryOnly) {
    lines.push(
      `- ${lane.label}: ${lane.models.length} advertised free model(s); discovery only, integration unavailable`,
    )
  }
  lines.push(...renderOffersMarkdownSection(view.offers.flatMap((g) => g.rows)))
  lines.push(view.quotaFootnote)
  lines.push('')
  lines.push(
    `Path: ${header.markdownPath} · generatedAt: ${header.generatedAt}`,
  )
  return `${lines.join('\n')}\n`
}

/**
 * Render the complete artifact. `generationId` hashes the body only, so the
 * header can carry the hash without hashing itself.
 */
export function renderFreeOptionsArtifact(view: FreeOptionsView): {
  text: string
  generationId: string
} {
  const body = renderFreeOptionsMarkdownBody(view)
  const generationId = `sha256:${createHash('sha256').update(body, 'utf8').digest('hex')}`
  const header = [
    HEADER_OPEN,
    `path: ${view.header.markdownPath}`,
    `generatedAt: ${view.header.generatedAt}`,
    `fetchedAt: ${view.header.fetchedAt ?? 'none'}`,
    `generationId: ${generationId}`,
    HEADER_CLOSE,
  ].join('\n')
  return { text: `${header}\n${body}`, generationId }
}

function parseHeader(text: string): Record<string, string> | null {
  const open = text.indexOf(HEADER_OPEN)
  const close = text.indexOf(HEADER_CLOSE)
  if (open !== 0 || close < 0) return null
  const header: Record<string, string> = {}
  for (const line of text.slice(HEADER_OPEN.length, close).split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at <= 0) continue
    header[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return header
}

function failure(
  path: string,
  reason: FreeOptionsArtifactFailure,
): FreeOptionsArtifactCheck {
  return { ok: false, path, reason }
}

/**
 * Read the file at `path` and verify it renders the report's catalog at that
 * exact path. The hash proves the body was not edited or truncated; the
 * `fetchedAt` equality is what establishes currency.
 */
export function verifyFreeOptionsArtifact(params: {
  report: FreeOptionsReport
  path: string
}): FreeOptionsArtifactCheck {
  let text: string
  try {
    text = fs.readFileSync(params.path, 'utf8')
  } catch (error) {
    const code =
      error && typeof error === 'object'
        ? (error as { code?: unknown }).code
        : undefined
    return failure(params.path, code === 'ENOENT' ? 'missing' : 'unreadable')
  }
  const header = parseHeader(text)
  if (!header) return failure(params.path, 'unreadable')
  if (header.path !== params.path) return failure(params.path, 'path-mismatch')
  if (header.fetchedAt !== (params.report.fetchedAt ?? 'none'))
    return failure(params.path, 'fetchedAt-mismatch')
  const close = text.indexOf(HEADER_CLOSE)
  const body = text.slice(close + HEADER_CLOSE.length).replace(/^\r?\n/, '')
  const expected = `sha256:${createHash('sha256').update(body, 'utf8').digest('hex')}`
  if (header.generationId !== expected)
    return failure(params.path, 'generation-mismatch')
  return {
    ok: true,
    path: params.path,
    generatedAt: header.generatedAt,
    generationId: header.generationId,
  }
}
