// FID-2026-0901-006 P15 — tool-card copy affordance (CLI CopyableBlock parity).
//
// The CLI wraps every tool branch in `CopyableBlock`
// (`cli/src/components/blocks/copyable-block.tsx`) with a right-aligned
// footer row: optional left node (e.g. the `[-N/+M]` edit counter) plus a
// copy button. The copy text mirrors `cli/src/components/blocks/tool-branch.tsx:146`:
// `[Tool: name]\nInput:\n<pretty json>\n\nOutput:\n<output|(no output)>`.
// Pure helpers, never throw (Law 14).

/** Tools that own their copy affordance in the CLI (no outer copy button). */
const COPY_SKIP_TOOLS = new Set([
  'run_terminal_command',
  'run_readonly_command',
  'transition_phase',
])

/** CLI skip-list: these blocks render without the outer copy button. */
export function toolHasCopyButton(toolName: string): boolean {
  return !COPY_SKIP_TOOLS.has(toolName)
}

/** Pretty-print the tool input for the copy payload; raw text on parse failure. */
function prettyInput(inputJson: string | null): string {
  if (inputJson === null) return '(no input)'
  try {
    const value: unknown = JSON.parse(inputJson)
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2)
    }
  } catch {
    // fall through — copy the raw text rather than nothing
  }
  return inputJson
}

/** The full copy payload for a tool card, CLI format. */
export function toolCopyText(
  toolName: string,
  inputJson: string | null,
  outputText: string | null,
): string {
  return `[Tool: ${toolName}]\nInput:\n${prettyInput(inputJson)}\n\nOutput:\n${
    outputText ?? '(no output)'
  }`
}

export interface DiffStats {
  added: number
  removed: number
}

/** Count added/removed lines in a parsed diff (CLI `[-N/+M]` counter). */
export function diffStats(
  hunks: ReadonlyArray<{
    lines: ReadonlyArray<{ type: 'add' | 'del' | 'ctx' }>
  }>,
): DiffStats {
  let added = 0
  let removed = 0
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') added += 1
      else if (line.type === 'del') removed += 1
    }
  }
  return { added, removed }
}
