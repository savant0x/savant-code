/**
 * `/attest` command — FID-2026-0813-007 (master D5/D6/D11/D12).
 *
 * Reads `.savant/provenance/`, validates every receipt with the shared
 * validator, classifies live/superseded by content-hash recomputation, and
 * writes two artifacts to `dev/exports/provenance/` (or an explicit output
 * path):
 *
 *   - `trust-receipt.json` — authoritative, schema-stable, whitelisted fields.
 *   - `trust-receipt.html` — self-contained offline convenience view with an
 *     inline verifier the auditor runs in the browser (zero install, zero
 *     network). The page carries the verbatim disclaimer that the JSON is
 *     authoritative.
 *
 * Options:
 *   /attest            → latest session (default)
 *   /attest --all      → every session under .savant/provenance/
 *   /attest --session <id> → one specific session
 *   /attest --output <path> → explicit output directory (defaults to
 *     dev/exports/provenance/ in the project root)
 *
 * Absence is honest state: no ledger → an explicit "no provenance" report
 * (exit 0), never an error. The export NEVER carries ad content in any
 * variant (build order Q4 — the receipt is a pure trust artifact).
 */
import fs from 'node:fs'
import path from 'node:path'

import {
  loadProvenanceSession,
  readProvenanceManifest,
} from '@savant-code/common/provenance'

import { getProjectRoot } from '../project-files'
import { IS_SAVANT_FREE } from '../utils/constants'
import { getSystemMessage } from '../utils/message-history'
import { buildAttestBundle } from './attest/serializer'
import { buildAttestHtml } from './attest/template'

import type { RouterParams } from './command-registry'

const PROVENANCE_DIR_NAME = '.savant'
const PROVENANCE_SUBDIR = 'provenance'
const DEFAULT_OUTPUT_SUBDIR = path.join('dev', 'exports', 'provenance')

function listSessionDirs(projectRoot: string): string[] {
  const provenanceRoot = path.join(
    projectRoot,
    PROVENANCE_DIR_NAME,
    PROVENANCE_SUBDIR,
  )
  try {
    return fs
      .readdirSync(provenanceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(provenanceRoot, entry.name))
      .sort()
  } catch {
    return []
  }
}

function findSessionDir(
  sessionDirs: string[],
  sessionId: string,
): string | undefined {
  return sessionDirs.find((dir) => {
    const manifest = readProvenanceManifest(dir)
    return manifest?.sessionId === sessionId
  })
}

export async function handleAttestCommand(
  params: RouterParams,
  args: string,
): Promise<void> {
  params.saveToHistory(params.inputValue.trim())
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  const projectRoot = getProjectRoot() ?? process.cwd()
  const provenanceRoot = path.join(
    projectRoot,
    PROVENANCE_DIR_NAME,
    PROVENANCE_SUBDIR,
  )
  const sessionDirs = listSessionDirs(projectRoot)

  // Argument parsing: --all | --session <id> | --output <path>
  let wantAll = false
  let wantSession: string | undefined
  let outputDir: string | undefined
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '--all') wantAll = true
    else if (token === '--session' && i + 1 < tokens.length) {
      wantSession = tokens[++i]
    } else if (token === '--output' && i + 1 < tokens.length) {
      const value = tokens[++i]
      outputDir = path.isAbsolute(value)
        ? value
        : path.resolve(process.cwd(), value)
    } else if (token.startsWith('--session=')) {
      wantSession = token.slice('--session='.length)
    } else if (token.startsWith('--output=')) {
      const value = token.slice('--output='.length)
      outputDir = path.isAbsolute(value)
        ? value
        : path.resolve(process.cwd(), value)
    }
  }

  if (!fs.existsSync(provenanceRoot) || sessionDirs.length === 0) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        'ℹ️ No provenance ledger found for this project yet. Receipts are written to `.savant/provenance/` when writes happen under ZTAP (default mode `record`). Absence is honest state — nothing to attest.',
      ),
    ])
    return
  }

  // Session selection.
  let selected: string[]
  if (wantAll) {
    selected = sessionDirs
  } else if (wantSession !== undefined) {
    const match = findSessionDir(sessionDirs, wantSession)
    if (!match) {
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          `❌ No provenance session \`${wantSession}\` found under \`${provenanceRoot}\`. Available: ${sessionDirs
            .map(
              (dir) =>
                readProvenanceManifest(dir)?.sessionId ?? path.basename(dir),
            )
            .join(', ')}`,
        ),
      ])
      return
    }
    selected = [match]
  } else {
    // Default: the most recently modified session directory.
    const byMtime = [...sessionDirs].sort((a, b) => {
      try {
        return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs
      } catch {
        return 0
      }
    })
    selected = [byMtime[0]]
  }

  // Load + build the authoritative bundle.
  const sessions = await Promise.all(
    selected.map(async (dir) => {
      const loaded = await loadProvenanceSession(dir)
      return {
        manifest: loaded.manifest,
        receipts: loaded.receipts,
        dir,
      }
    }),
  )

  const missingManifest = sessions.filter((s) => s.manifest === null)
  const withManifest = sessions.filter(
    (s): s is typeof s & { manifest: NonNullable<typeof s.manifest> } =>
      s.manifest !== null,
  )

  const product = IS_SAVANT_FREE ? 'SavantFree' : 'SavantCode'
  const bundle = buildAttestBundle(
    product,
    withManifest.map((s) => ({
      manifest: s.manifest,
      receipts: s.receipts,
      projectRoot,
    })),
    projectRoot,
  )

  const resolvedOutputDir =
    outputDir ?? path.join(projectRoot, DEFAULT_OUTPUT_SUBDIR)
  fs.mkdirSync(resolvedOutputDir, { recursive: true })
  const jsonPath = path.join(resolvedOutputDir, 'trust-receipt.json')
  const htmlPath = path.join(resolvedOutputDir, 'trust-receipt.html')
  fs.writeFileSync(jsonPath, JSON.stringify(bundle, null, 2), 'utf8')
  fs.writeFileSync(htmlPath, buildAttestHtml(bundle), 'utf8')

  // Terminal summary.
  const total = bundle.sessions.reduce((n, s) => n + s.summary.receipts, 0)
  const live = bundle.sessions.reduce((n, s) => n + s.summary.live, 0)
  const failing = bundle.sessions.reduce(
    (n, s) => n + s.summary.withFailures,
    0,
  )
  const firstFailure = firstFailing(bundle)
  const jsonKb = (fs.statSync(jsonPath).size / 1024).toFixed(1)
  const htmlKb = (fs.statSync(htmlPath).size / 1024).toFixed(1)

  const lines: string[] = [
    `✅ Trust receipt exported to **${resolvedOutputDir}**`,
    '',
    `- Sessions: ${bundle.sessions.length} · Receipts: ${total} (${live} live, ${total - live} superseded)`,
    `- Complete: ${bundle.sessions.reduce((n, s) => n + s.summary.complete, 0)} · Pending: ${bundle.sessions.reduce((n, s) => n + s.summary.pending, 0)}`,
    `- Mode: ${bundle.sessions.map((s) => s.manifest.mode).join(', ') || '—'}`,
    `- Failing checks: ${failing}`,
  ]
  if (firstFailure) {
    lines.push(`- First failing check: \`${firstFailure}\``)
  }
  if (missingManifest.length > 0) {
    lines.push(
      `- ⚠️ ${missingManifest.length} session dir(s) had no readable manifest and were skipped: ${missingManifest
        .map((s) => path.basename(s.dir))
        .join(', ')}`,
    )
  }
  lines.push(
    '',
    `- Authoritative: \`trust-receipt.json\` (${jsonKb} KB) · Offline view: \`trust-receipt.html\` (${htmlKb} KB)`,
  )
  lines.push(
    '- Open the HTML in any browser and click **Run independent verification** — zero install, zero network.',
  )
  params.setMessages((prev) => [...prev, getSystemMessage(lines.join('\n'))])
}

function firstFailing(
  bundle: ReturnType<typeof buildAttestBundle>,
): string | null {
  for (const session of bundle.sessions) {
    for (const entry of session.receipts) {
      if (!entry.validation.valid) {
        return `${entry.receipt.path}: ${entry.validation.failures[0]}`
      }
    }
  }
  return null
}
