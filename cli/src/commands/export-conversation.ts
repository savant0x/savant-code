/**
 * `/export` command — serialize the entire conversation into a self-contained,
 * branded HTML report and save it to the current working directory.
 *
 * The exported HTML follows the reference session-export design (monospace,
 * near-black full-width page with corner marks, metadata grid, collapsible
 * tool/thinking rows) and is branded with:
 * - The real Savant logo (art/savant-logo.png) embedded as a base64 data URI
 * - The Neon Slate design system (cli/src/utils/theme-system.ts dark palette)
 * - Font Awesome free icons (6.7.2 CSS + webfonts inlined as base64 — fully offline)
 *
 * Usage:
 *   /export             → writes to dev/exports/conversation/savant-export.html
 *                        (single-file rotation, FID-2026-0806-016)
 *   /export output.html → writes to the specified path
 */

import fs from 'fs'
import path from 'path'

import { useChatStore } from '../state/chat-store'
import { IS_SAVANT_FREE } from '../utils/constants'
import { getSystemMessage } from '../utils/message-history'
import { getVersion } from '../utils/version'
import {
  findMasterFidRunLog,
  renderDriveReportHtml,
} from './export-conversation/drive-report'
import { buildExportHtml } from './export-conversation/template'

import type { RouterParams } from './command-registry'
import type { DriveRecord } from '@savant-code/common/types/session-state'

export async function handleExportConversationCommand(
  params: RouterParams,
  args: string,
): Promise<void> {
  const messages = useChatStore.getState().messages
  const sessionId = useChatStore.getState().chatSessionId

  params.saveToHistory(params.inputValue.trim())
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  if (messages.length === 0) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage('Nothing to export — the conversation is empty.'),
    ])
    return
  }

  const product = IS_SAVANT_FREE ? 'SavantFree' : 'SavantCode'
  const brandName = IS_SAVANT_FREE ? 'Savant Free' : 'Savant Code'

  // Determine output path
  const argPath = args.trim()
  let outputPath: string
  if (argPath) {
    // Use provided path — resolve relative to CWD
    outputPath = path.isAbsolute(argPath)
      ? argPath
      : path.resolve(process.cwd(), argPath)
  } else {
    // Default: dev/exports/conversation/ single-file rotation (overwrite the
    // previous export) so exports stop cluttering the project root
    // (FID-2026-0806-016, Nova export-organization request).
    outputPath = path.resolve(
      process.cwd(),
      'dev',
      'exports',
      'conversation',
      'savant-export.html',
    )
  }

  // Generate HTML
  const drive = useChatStore.getState().runState?.sessionState?.mainAgentState
    ?.drive as DriveRecord | undefined
  const runLog = findMasterFidRunLog(process.cwd())
  const driveReportHtml = renderDriveReportHtml({
    drive: drive ?? null,
    runLog,
  })
  const html = buildExportHtml(
    messages,
    sessionId,
    product,
    brandName,
    getVersion(),
    driveReportHtml,
  )

  try {
    // Ensure parent directory exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(outputPath, html, 'utf8')

    const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)
    const msgCount = messages.length
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        `✅ Exported ${msgCount} message${msgCount === 1 ? '' : 's'} to **${outputPath}** (${sizeKb} KB)\n\nOpen in a browser to view the full transcript with collapsible tool calls and the Savant session report.`,
      ),
    ])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Sanitize: never let raw filesystem paths leak secrets
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(`❌ Failed to export: ${msg}`),
    ])
  }
}
