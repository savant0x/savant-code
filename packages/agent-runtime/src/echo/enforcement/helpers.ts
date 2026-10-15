/**
 * Stateless enforcement helpers (FID-2026-0819-005 Loop 303: extracted
 * verbatim from `echo/enforcement.ts`; pure predicates shared by the class
 * and the `enforcement/` pipeline modules).
 */
import { BOOT_LEARNINGS_PATH } from '@savant-code/common/constants/learnings-boot'

import {
  DESTRUCTIVE_COMMAND_REGEX,
  GIT_MUTATING_REGEX,
  PERMITTED_REDIRECT_REGEX,
  splitSafeAnd,
  splitSafePipes,
} from '../../tools/handlers/tool/readonly-command-validation'

import type { EnforcementMode } from '../types'
import type { AgentState } from '@savant-code/common/types/session-state'

// FID-2026-1001-003 step 1: the classifier consumes the SAME shell-token
// lists the readonly-command validator enforces with (Law 13 — one truth;
// import direction verified legal: that module imports nothing from echo/).
// FORBIDDEN_METACHAR_REGEX is deliberately NOT consumed: pipes/semicolons
// are command STRUCTURE (the readonly validator's rejection surface), not
// worktree mutation — every `bun test | tail` would otherwise classify as
// a tree mutation.

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
  return `Session-init grounding required: read \`${protocolFile}\` 0-EOF before ending your turn (also read \`ARCHITECTURE.md\`, \`protocol.config.yaml\`, and \`${BOOT_LEARNINGS_PATH}\`). The harness blocks ungrounded final answers.`
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
  // apply_patch nests the target under `operation.path`
  // (sdk/src/tools/apply-patch.ts). Without this branch every apply_patch
  // call resolved an undefined target and silently bypassed the Law 1/7
  // gates and the FID gate (FID-2026-0820-014 EC-2) — while
  // enforcement.ts's own getTargetPath tracked the write as dirty.
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

/**
 * FID-2026-1001-003 step 1: mutation classification by EFFECT, not tool
 * NAME. One code path classifies `write_file`/`str_replace`/`apply_patch`
 * AND the terminal tools, closing the bypass where one
 * `run_terminal_command` (`sed -i`, `>`, `git checkout`) mutated the tree
 * with no record for Law 1 / Law 3 / Law 15.
 *
 * `targets` is mandatory — a boolean-only classifier closes Law 1 but
 * leaves Law 15 blind. `scope: 'tree'` (indeterminate mutation) leaves
 * `targets` EMPTY and defers to step 2's worktree reconciliation, which
 * discovers the actual changed set — marking the whole repo dirty would
 * reproduce the FID-2026-0918-005 deadlock (Law 15 unsatisfiable).
 *
 * `skill_manage` is deliberately NOT classified here: the Adversary refuted
 * the claim that it traverses EHEL's write stage (`write-bookkeeping.ts →
 * isWriteToolName` does not include it).
 */
export interface MutationClassification {
  mutates: boolean
  targets: string[]
  scope: 'targeted' | 'tree'
}

/** Write-path tool names whose input carries the target path directly. */
const WRITE_PATH_TOOLS = new Set(['write_file', 'str_replace', 'apply_patch'])

/** Terminal tools whose payload is a command string/batch. */
const COMMAND_TOOLS = new Set(['run_terminal_command', 'run_readonly_command'])

/** Extract mutation-target paths from a terminal command segment. */
const DIAGNOSTIC_TARGETS = new Set(['/dev/null', 'nul', 'NUL'])

function terminalMutationTargets(segment: string): string[] {
  const targets: string[] = []
  // Redirection: `> file`, `>> file`, `2> file` (not the permitted
  // read-only redirects — `2>&1`, or any stream into a null sink, see
  // PERMITTED_REDIRECT_REGEX).
  const redirect = /(?:^|[\s])(\d?>{1,2})\s*("([^"]+)"|'([^']+)'|([^\s|&;]+))/g
  for (const m of segment.matchAll(redirect)) {
    const target = (m[3] ?? m[4] ?? m[5] ?? '').trim()
    if (
      target &&
      !DIAGNOSTIC_TARGETS.has(target) &&
      !PERMITTED_REDIRECT_REGEX.test(` ${m[1]}${target}`)
    ) {
      targets.push(target)
    }
  }
  // tee: `... | tee [-a] file`
  const tee = /\btee\s+(?:-a\s+)?("([^"]+)"|'([^']+)'|([^\s|&;]+))/g
  for (const m of segment.matchAll(tee)) {
    const target = (m[2] ?? m[3] ?? m[4] ?? '').trim()
    if (target && !DIAGNOSTIC_TARGETS.has(target)) targets.push(target)
  }
  return targets
}

/** In-place edit commands whose first path argument is the mutation target. */
const IN_PLACE_EDIT_REGEX =
  /^\s*(?:sed\s+(?:[^ ]*\s+)?-i|perl\s+-i|gawk\s+-i\s*-? inplace)\b/i

/** Extract the operand paths of a segment's command words. */
function operandPaths(segment: string): string[] {
  if (IN_PLACE_EDIT_REGEX.test(segment)) {
    const operand = inPlaceOperand(segment)
    return operand ? [operand] : []
  }
  return []
}

/**
 * The operand of an in-place edit is either the last quoted span
 * (`sed -i 's/a/b/' "my file.ts"`) or the first word after it
 * (`sed -i "s/a/b/" file.ts`) — or simply the last word when nothing is
 * quoted (`sed -i s/a/b/ file.ts`). Tokenizing with space→underscore
 * replacement would corrupt exactly the paths that need quoting.
 */
function inPlaceOperand(segment: string): string | undefined {
  const spans = [...segment.matchAll(/"([^"]*)"|'([^']*)'/g)]
  const last = spans[spans.length - 1]
  if (last) {
    const tail = segment.slice((last.index ?? 0) + last[0].length).trim()
    if (tail.length > 0) {
      const word = tail.split(/\s+/)[0]
      if (word && !word.startsWith('-')) {
        return word.replace(/^["']+|["']+$/g, '')
      }
    }
    const inner = last[1] ?? last[2]
    if (inner && !inner.startsWith('-')) return inner
    return undefined
  }
  const words = segment.split(/\s+/).filter((w) => w.length > 0)
  const lastWord = words[words.length - 1]
  return lastWord && !lastWord.startsWith('-') ? lastWord : undefined
}

/**
 * Pure classifier: does this tool call mutate the worktree, and where?
 * Takes the whole tool call (name + input) so every write path classifies
 * through one function. Conservative on detection (a mutating command that
 * evades the patterns classifies `scope: 'tree'` — the reconciliation
 * backstop covers it), precise on targets where resolvable.
 */
export function classifyMutation(input: {
  toolName: string
  params: unknown
}): MutationClassification {
  const paramsRecord =
    input.params && typeof input.params === 'object'
      ? (input.params as Record<string, unknown>)
      : {}
  const toolName = input.toolName

  if (WRITE_PATH_TOOLS.has(toolName)) {
    const target = getTargetPath(paramsRecord)
    if (target !== undefined) {
      return { mutates: true, targets: [target], scope: 'targeted' }
    }
    // A write-path call without a resolvable target: tree scope, the
    // backstop discovers the changed set.
    return { mutates: true, targets: [], scope: 'tree' }
  }

  if (!COMMAND_TOOLS.has(toolName)) {
    return { mutates: false, targets: [], scope: 'targeted' }
  }

  const commands = terminalCommandCandidates(paramsRecord)
  const allTargets: string[] = []
  let anyMutationSignal = false
  for (const command of commands) {
    for (const segment of splitSafeAnd(command)) {
      for (const sub of splitSafePipes(segment).segments) {
        if (
          DESTRUCTIVE_COMMAND_REGEX.test(sub) ||
          GIT_MUTATING_REGEX.test(sub)
        ) {
          anyMutationSignal = true
          allTargets.push(...operandPaths(sub))
        }
        // In-place edits are their own signal (they match neither list
        // above) — checked before the operand extraction, which is
        // IN_PLACE-only.
        if (IN_PLACE_EDIT_REGEX.test(sub)) {
          anyMutationSignal = true
          allTargets.push(...operandPaths(sub))
        }
        // Redirection/tee targets are themselves the signal, scanned on
        // every segment (`bun test 2>&1 | tail` must stay clean while
        // `echo x > out.txt` must not).
        const redirected = terminalMutationTargets(sub)
        if (redirected.length > 0) {
          anyMutationSignal = true
          allTargets.push(...redirected)
        }
      }
    }
  }

  if (!anyMutationSignal) {
    return { mutates: false, targets: [], scope: 'targeted' }
  }
  const targets = [...new Set(allTargets.filter((t) => t.length > 0))]
  if (targets.length === 0) {
    return { mutates: true, targets: [], scope: 'tree' }
  }
  return { mutates: true, targets, scope: 'targeted' }
}
