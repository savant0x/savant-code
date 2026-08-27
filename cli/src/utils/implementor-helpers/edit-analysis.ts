import { safeParseJSONObject } from '@savant-code/common/util/type-narrowing'

import {
  extractValueForKey,
  getBaseToolName,
  isProposedToolName,
  isSuccessfulEditMessage,
} from './identify'

import type { ToolContentBlock } from '../../types/chat'
import type { JSONValue } from '@savant-code/common/types/json'

function hasErrorMessage(value: Record<string, JSONValue>): boolean {
  if (typeof value.errorMessage === 'string' && value.errorMessage !== '') {
    return true
  }
  const nested = safeParseJSONObject(value.value)
  if (
    nested &&
    typeof nested.errorMessage === 'string' &&
    nested.errorMessage !== ''
  ) {
    return true
  }
  return false
}

function hasFailedEditOutput(params: {
  outputStr: string
  message: string | null
  diffFromOutput: string | null
}): boolean {
  const { outputStr, message, diffFromOutput } = params
  const trimmedOutput = outputStr.trim()
  if (!trimmedOutput) {
    return false
  }
  if (
    extractValueForKey(outputStr, 'errorMessage') ||
    isErrorOutput(outputStr)
  ) {
    return true
  }
  if (diffFromOutput || isSuccessfulEditMessage(message)) {
    return false
  }
  return !isSuccessfulEditMessage(trimmedOutput)
}

export function isFailedEditToolBlock(toolBlock: ToolContentBlock): boolean {
  const outputRaw = toolBlock.outputRaw
  if (Array.isArray(outputRaw) && outputRaw[0]?.value != null) {
    const value = safeParseJSONObject(outputRaw[0].value)
    if (value && hasErrorMessage(value)) return true
  }
  const outputObj = safeParseJSONObject(outputRaw)
  if (outputObj && hasErrorMessage(outputObj)) return true

  const outputStr = typeof toolBlock.output === 'string' ? toolBlock.output : ''
  const message = extractValueForKey(outputStr, 'message')
  const diffFromOutput =
    extractValueForKey(outputStr, 'unifiedDiff') ||
    extractValueForKey(outputStr, 'patch')
  return hasFailedEditOutput({ outputStr, message, diffFromOutput })
}

function isErrorOutput(output: string): boolean {
  const trimmedOutput = output.trim()
  return (
    trimmedOutput.startsWith('Error:') || trimmedOutput.startsWith('Failed ')
  )
}

/**
 * Extract unified diff from tool output, or construct from input.
 * For executed tools: use outputRaw/output with unifiedDiff.
 * For proposed tools (implementors): construct diff from input replacements.
 */
export function extractDiff(toolBlock: ToolContentBlock): string | null {
  let hasSuccessfulOutput = false

  // First try to get from outputRaw (for executed tool results)
  // outputRaw is typically an array like [{type: "json", value: {unifiedDiff: "..."}}]
  const outputRaw = toolBlock.outputRaw
  if (Array.isArray(outputRaw) && outputRaw[0]?.value != null) {
    const value = safeParseJSONObject(outputRaw[0].value)
    if (value) {
      if (hasErrorMessage(value)) return null
      if (isSuccessfulEditMessage(value.message)) hasSuccessfulOutput = true
      if (typeof value.unifiedDiff === 'string') return value.unifiedDiff
      if (typeof value.patch === 'string') return value.patch
    }
  }
  const outputObj = safeParseJSONObject(outputRaw)
  if (outputObj) {
    if (hasErrorMessage(outputObj)) return null
    if (isSuccessfulEditMessage(outputObj.message)) hasSuccessfulOutput = true
    if (typeof outputObj.unifiedDiff === 'string') return outputObj.unifiedDiff
    if (typeof outputObj.patch === 'string') return outputObj.patch
  }

  // Try to get from output string (key: value format)
  const outputStr = typeof toolBlock.output === 'string' ? toolBlock.output : ''
  const message = extractValueForKey(outputStr, 'message')
  const diffFromOutput =
    extractValueForKey(outputStr, 'unifiedDiff') ||
    extractValueForKey(outputStr, 'patch')

  if (hasFailedEditOutput({ outputStr, message, diffFromOutput })) {
    return null
  }
  if (isSuccessfulEditMessage(message)) {
    hasSuccessfulOutput = true
  }

  if (diffFromOutput) {
    return diffFromOutput
  }

  // For proposed/pending edits, or confirmed successful executions, construct
  // the preview from input when the result omits a diff.
  const canUseInputFallback =
    isProposedToolName(toolBlock.toolName) ||
    outputStr === '' ||
    hasSuccessfulOutput
  if (!canUseInputFallback) {
    return null
  }

  const input = toolBlock.input
  const baseToolName = getBaseToolName(toolBlock.toolName)

  // Handle str_replace: construct diff from replacements
  if (baseToolName === 'str_replace' && Array.isArray(input.replacements)) {
    const replacements = input.replacements.filter(isReplacementInput)
    if (replacements.length > 0) {
      return constructDiffFromReplacements(replacements)
    }
  }

  // Handle write_file: show content as addition
  if (baseToolName === 'write_file' && typeof input.content === 'string') {
    return constructDiffFromWriteFile(input.content)
  }

  // FID-2026-0822-008: route the raw-content fallback through the existing
  // write-file constructor so content-shaped payloads classify as
  // additions (correct +N -0 counts, tinted rows) instead of context rows
  // that parse as a zero-change receipt (`+0 -0`). Already-signed diff
  // payloads (e.g. `{ type: 'patch', content: '- old\n+ new' }`) pass
  // through unchanged; space-prefixed signs are NOT treated as a diff
  // (they parse as context too — the FID-2026-0822-008 reproduced shape).
  if (input.content !== undefined && typeof input.content === 'string') {
    const content = input.content
    const hasSignedDiffLines = content
      .split('\n')
      .some((line) => /^[+\-@]|^(diff |index |--- |\+\+\+ )/.test(line))
    return hasSignedDiffLines ? content : constructDiffFromWriteFile(content)
  }

  return null
}

/**
 * Construct a simple diff view from str_replace replacements.
 */
type ReplacementInput = {
  oldString?: string
  newString?: string
  old?: string
  new?: string
}

function isReplacementInput(value: JSONValue): value is ReplacementInput {
  const parsed = safeParseJSONObject(value)
  if (!parsed) return false
  let hasString = false
  for (const key of ['oldString', 'newString', 'old', 'new']) {
    const field = parsed[key]
    if (field !== undefined && field !== null && typeof field !== 'string') {
      return false
    }
    if (typeof field === 'string') {
      hasString = true
    }
  }
  return hasString
}

function constructDiffFromReplacements(
  replacements: ReplacementInput[],
): string {
  const lines: string[] = []

  for (const replacement of replacements) {
    const oldString = replacement.oldString ?? replacement.old ?? ''
    const newString = replacement.newString ?? replacement.new ?? ''

    // Add old lines as removals
    const oldLines = oldString.split('\n')
    for (const line of oldLines) {
      lines.push(`- ${line}`)
    }
    // Add new lines as additions
    const newLines = newString.split('\n')
    for (const line of newLines) {
      lines.push(`+ ${line}`)
    }
    // Add separator between replacements if there are multiple
    if (replacements.length > 1) {
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Construct a diff view from write_file content.
 */
function constructDiffFromWriteFile(content: string): string {
  const lines = content.split('\n')
  return lines.map((line) => `+ ${line}`).join('\n')
}

/**
 * Check if a tool is a "create new file" operation.
 */
export function isCreateFile(toolBlock: ToolContentBlock): boolean {
  const outputStr = typeof toolBlock.output === 'string' ? toolBlock.output : ''
  const message = extractValueForKey(outputStr, 'message')
  return (
    typeof message === 'string' &&
    (message.startsWith('Created file successfully') ||
      message.startsWith('Created new file') ||
      message.startsWith('Proposed new file'))
  )
}

function hasToolResultOutput(toolBlock: ToolContentBlock): boolean {
  const outputStr = typeof toolBlock.output === 'string' ? toolBlock.output : ''
  return outputStr.length > 0 || toolBlock.outputRaw !== undefined
}

/**
 * Decide whether the direct edit tool renderer should show a diff preview.
 *
 * Real edit tool calls render immediately with input only, then receive output
 * once the edit completes. Wait for that result before showing diffs so create
 * operations never briefly flash an input-derived full-file diff.
 */
export function shouldShowEditDiff(toolBlock: ToolContentBlock): boolean {
  if (!extractDiff(toolBlock) || isCreateFile(toolBlock)) {
    return false
  }

  if (
    !isProposedToolName(toolBlock.toolName) &&
    !hasToolResultOutput(toolBlock)
  ) {
    return false
  }

  return true
}
