import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { getErrorObject } from '@savant-code/common/util/error'
import { jsonToolResult } from '@savant-code/common/util/messages'

import { harvestPonytailMarkers } from '../../../yagni-ladder'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { ProjectFileContext } from '@savant-code/common/util/file'

type ToolName = 'ponytail_debt'

/** Default ledger path relative to the project root. */
const DEFAULT_LEDGER_PATH = 'dev/YAGNI-LEDGER.md'

/** File extensions that may carry inline ponytail: markers. */
const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.go',
  '.rs',
  '.py',
  '.rb',
  '.sh',
  '.java',
  '.cs',
  '.md',
  '.yml',
  '.yaml',
  '.json',
])

interface HarvestedMarker {
  filePath: string
  marker: string
}

function collectMarkersInPath(
  target: string,
  projectRoot: string,
  out: HarvestedMarker[],
): void {
  const absolute = resolve(projectRoot, target)
  if (!existsSync(absolute)) return
  const stat = statSync(absolute)
  if (stat.isFile()) {
    if (!SCAN_EXTENSIONS.has(extnameOf(absolute))) return
    const rel = relative(projectRoot, absolute)
    const content = readFileSync(absolute, 'utf8')
    for (const marker of harvestPonytailMarkers(content)) {
      out.push({ filePath: rel, marker })
    }
    return
  }
  if (stat.isDirectory()) {
    for (const entry of readdirSync(absolute)) {
      if (
        entry === 'node_modules' ||
        entry === '.git' ||
        entry === '.next' ||
        entry === 'dist'
      ) {
        continue
      }
      collectMarkersInPath(join(absolute, entry), projectRoot, out)
    }
  }
}

function extnameOf(path: string): string {
  const idx = path.lastIndexOf('.')
  return idx >= 0 ? path.slice(idx) : ''
}

/**
 * P5c — ponytail-debt handler (harvest_yagni_debt, FID-2026-0806-003).
 *
 * Regex-scans the given file/dir for `ponytail:` YAGNI debt markers, appends
 * formatted entries to `dev/YAGNI-LEDGER.md`, and returns a summary. The
 * ledger is the permanent record the Orchestrator reviews at session start —
 * deferred work never silently becomes critical debt.
 */
export const handlePonytailDebt = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<ToolName>
  fileContext: ProjectFileContext
}): Promise<{ output: SavantCodeToolOutput<ToolName> }> => {
  const { previousToolCallFinished, toolCall, fileContext } = params
  await previousToolCallFinished

  const projectRoot = fileContext.projectRoot
  const filePath = toolCall.input.filePath

  const markers: HarvestedMarker[] = []
  try {
    collectMarkersInPath(filePath, projectRoot, markers)
  } catch (error) {
    return {
      output: jsonToolResult({
        message: '',
        scanned: filePath,
        harvested: 0,
        errorMessage: `Failed to scan ${filePath}: ${getErrorObject(error).message}`,
      }) as SavantCodeToolOutput<ToolName>,
    }
  }

  if (markers.length === 0) {
    return {
      output: jsonToolResult({
        message: `No ponytail: markers found in ${filePath}`,
        scanned: filePath,
        harvested: 0,
      }) as SavantCodeToolOutput<ToolName>,
    }
  }

  const ledgerPath = resolve(projectRoot, DEFAULT_LEDGER_PATH)
  try {
    mkdirSync(dirname(ledgerPath), { recursive: true })
    const header = `# YAGNI Debt Ledger\n\n> Harvested by the ponytail-debt tool (FID-2026-0806-003). Reviewed by the Orchestrator at session start.\n\n## Entries\n`
    const existing = existsSync(ledgerPath)
      ? readFileSync(ledgerPath, 'utf8')
      : header
    const body = existing.includes('## Entries') ? existing : `${header}\n`
    const now = new Date().toISOString()
    const entries = markers
      .map(
        (m) => `- **${m.filePath}** · ${now.slice(0, 10)}\n  \`${m.marker}\``,
      )
      .join('\n')
    writeFileSync(
      ledgerPath,
      `${body.replace(/\n*$/, '')}\n${entries}\n`,
      'utf8',
    )

    return {
      output: jsonToolResult({
        message: `Harvested ${markers.length} ponytail: marker(s) into ${DEFAULT_LEDGER_PATH}`,
        scanned: filePath,
        harvested: markers.length,
        ledger: DEFAULT_LEDGER_PATH,
      }) as SavantCodeToolOutput<ToolName>,
    }
  } catch (error) {
    return {
      output: jsonToolResult({
        message: '',
        scanned: filePath,
        harvested: markers.length,
        errorMessage: `Failed to write ledger: ${getErrorObject(error).message}`,
      }) as SavantCodeToolOutput<ToolName>,
    }
  }
}) satisfies SavantCodeToolHandlerFunction<ToolName>
