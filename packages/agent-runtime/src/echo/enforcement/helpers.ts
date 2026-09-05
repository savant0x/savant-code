/**
 * Stateless enforcement helpers (FID-2026-0819-005 Loop 303: extracted
 * verbatim from `echo/enforcement.ts`; pure predicates shared by the class
 * and the `enforcement/` pipeline modules).
 */
import type { EnforcementMode } from '../types'
import type { AgentState } from '@savant-code/common/types/session-state'

export function resolveEnforcementMode(
  value: AgentState['enforcementMode'],
): EnforcementMode {
  if (value === undefined) return 'hybrid'
  if (value === 'hybrid' || value === 'strict') return value
  throw new Error(`Invalid EHEL enforcement mode: ${String(value)}`)
}
export function getTier(mode: EnforcementMode): 'core_4' | 'all_15' {
  return mode === 'strict' ? 'all_15' : 'core_4'
}

/**
 * FID-2026-0824-001: terminal tool calls carry their payload in EITHER the
 * singular `command` field or the plural `commands` batch array
 * (`run_readonly_command`). The tool schema states `command` is IGNORED when
 * `commands` is present, so extraction is BATCH-FIRST; credit detectors must
 * evaluate every executed entry or batched verification silently earns no
 * credit (the live false-block/wedged-tracker failure this fixes).
 */
export function terminalCommandCandidates(
  input: Record<string, unknown>,
): string[] {
  const batch = input.commands
  if (Array.isArray(batch)) {
    return batch.filter(
      (entry): entry is string => typeof entry === 'string' && entry.length > 0,
    )
  }
  const singular = input.command
  return typeof singular === 'string' ? [singular] : []
}
/**
 * FID-2026-0810-002 Change 5: hard retry cap for the first-turn completion
 * gate. After this many ungrounded text-only completions, the completion gate
 * disarms for the session with a one-time notice (the tool-level gate stays
 * armed).
 */
export const COMPLETION_GATE_MAX_RETRIES = 3
export function buildCompletionGateSteering(protocolFile: string): string {
  return `Session-init grounding required: read \`${protocolFile}\` 0-EOF before ending your turn (also read \`ARCHITECTURE.md\`, \`protocol.config.yaml\`, and \`dev/LEARNINGS.md\`). The harness blocks ungrounded final answers.`
}
export const COMPLETION_GATE_DISARM_NOTICE =
  'The session-init grounding gate has been disarmed for this session after repeated attempts; proceeding without the boot reads.'
export function isPreReadAllowed(toolName: string): boolean {
  return (
    toolName === 'read_files' ||
    toolName === 'read_subtree' ||
    toolName === 'ask_user' ||
    toolName === 'write_todos'
  )
}
export function isTerminalTool(toolName: string): boolean {
  return toolName === 'end_turn' || toolName === 'task_completed'
}
export function isWriteTool(toolName: string): boolean {
  return (
    toolName === 'write_file' ||
    toolName === 'str_replace' ||
    toolName === 'apply_patch'
  )
}
export function isFidFile(path: string): boolean {
  return /dev\/fids\/FID-[\w.-]+\.md$/.test(path)
}
export function getTargetPath(
  input: Record<string, unknown>,
): string | undefined {
  if (typeof input.path === 'string') return input.path
  const operation = input.operation
  if (operation && typeof operation === 'object') {
    const path = (operation as Record<string, unknown>).path
    if (typeof path === 'string') return path
  }
  return undefined
}
export function extractPaths(input: Record<string, unknown>): string[] {
  if (Array.isArray(input.paths))
    return input.paths.filter((p): p is string => typeof p === 'string')
  if (typeof input.path === 'string') return [input.path]
  return []
}
