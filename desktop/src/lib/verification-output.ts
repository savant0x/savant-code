import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'

export interface VerificationEntry {
  command: string
  exitCode: number | null
  stdout: string
  stderr: string
}

const VERIFICATION_TOOLS = new Set([
  'run_readonly_command',
  'run_terminal_command',
])

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asExitCode(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function parseEntry(value: unknown): VerificationEntry | null {
  const record = asRecord(value)
  if (record === null || typeof record.command !== 'string') return null
  return {
    command: record.command,
    exitCode: asExitCode(record.exitCode),
    stdout: asString(record.stdout),
    stderr: asString(record.stderr),
  }
}

function jsonValues(output: ToolResultOutput[]): unknown[] {
  return output.flatMap((part) => (part.type === 'json' ? [part.value] : []))
}

export function parseVerificationOutput(
  toolName: string,
  outputText: string | null,
): VerificationEntry[] | null {
  if (!VERIFICATION_TOOLS.has(toolName) || outputText === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(outputText)
  } catch {
    return null
  }

  const record = asRecord(parsed)
  if (record !== null && Array.isArray(record.results)) {
    const entries = record.results
      .map((value) => parseEntry(value))
      .filter((entry): entry is VerificationEntry => entry !== null)
    return entries.length === record.results.length ? entries : null
  }

  const entry = parseEntry(parsed)
  return entry === null ? null : [entry]
}

export function parseVerificationParts(
  toolName: string,
  output: ToolResultOutput[],
): VerificationEntry[] | null {
  if (!VERIFICATION_TOOLS.has(toolName)) return null
  const entries = jsonValues(output).flatMap((value) => {
    const record = asRecord(value)
    if (record !== null && Array.isArray(record.results)) {
      return record.results
        .map((item) => parseEntry(item))
        .filter((entry): entry is VerificationEntry => entry !== null)
    }
    const entry = parseEntry(value)
    return entry === null ? [] : [entry]
  })
  return entries.length === 0 ? null : entries
}
