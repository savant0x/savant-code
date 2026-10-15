/**
 * @module module-state-analyze
 *
 * FID-2026-1007-002 — the per-file analysis half of the module-state audit
 * (split from `./module-state-scan.ts` for the 300-line ceiling).
 *
 * A module-scope binding is state when the file MUTATES it after
 * initialization — a `set`/`add`/`delete`/`clear`/`push` member call, an index
 * write, or any reassignment. A read-only constant typed as a container is not
 * state, so the mutating use is the evidence, never the type. A binding is
 * covered when the same file exposes a seam that NAMES it: `reset*`, the older
 * `clear*`, and `__reset*` all count — a seam that already exists is coverage,
 * and calling it a gap is how a fan-out mints duplicate resets.
 */
import { maskNonCode } from './test-budget-scan.js'

export type ModuleStateKind =
  'map' | 'set' | 'weak-container' | 'array' | 'object' | 'let'

export type ModuleStateClass = 'mutable-container' | 'mutable-binding'

export type ModuleStateFinding = {
  file: string
  line: number
  name: string
  kind: ModuleStateKind
  stateClass: ModuleStateClass
}

/** A binding whose reset already exists in its own module. */
export type CuredBinding = {
  file: string
  name: string
  reset: string
}
type Candidate = {
  line: number
  name: string
  kind: ModuleStateKind
  stateClass: ModuleStateClass
}

/** A module-scope declaration head: `const`/`let` and the binding name. */
const DECL_HEAD = /^(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\b/
/** A module-scope `let` of any shape — a binding, not a constant. */
const LET_DECL = /^(?:export\s+)?let\s+([A-Za-z_$][\w$]*)\b/
/** The container initializer shapes this audit treats as a registry. */
const CONTAINER_INIT = /^(?:new\s+(Map|Set|WeakMap|WeakSet)\b|\[\]|\{\})/
/** Mutating member calls that prove the binding is written after init. */
const MUTATORS = [
  'set',
  'add',
  'delete',
  'clear',
  'push',
  'unshift',
  'splice',
  'pop',
  'shift',
]

function kindOf(initializer: string): ModuleStateKind {
  if (initializer.startsWith('new Map')) return 'map'
  if (initializer.startsWith('new Set')) return 'set'
  if (initializer.startsWith('new Weak')) return 'weak-container'
  if (initializer.startsWith('[]')) return 'array'
  return 'object'
}

/**
 * The initializer of a declaration that may wrap across lines: a type
 * annotation or a `new Map<…>(` can put the literal several lines below the
 * binding name (`const listToolsCache: Record<\n string,\n …> = {}`), and a
 * scanner that reads only the declaration's own line misses those registries.
 */
function initializerOf(lines: string[], start: number): string | undefined {
  let depth = 0
  for (
    let index = start;
    index < lines.length && index < start + 12;
    index += 1
  ) {
    const text = lines[index] ?? ''
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i]
      if (ch === '(' || ch === '[' || ch === '{' || ch === '<') depth += 1
      else if (ch === ')' || ch === ']' || ch === '}' || ch === '>') depth -= 1
      else if (ch === '=' && depth <= 0 && text[i + 1] !== '=') {
        return [text.slice(i + 1), ...lines.slice(index + 1)]
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 60)
      }
    }
  }
  return undefined
}

/** Candidates declared at column 0, so a nested binding is never reported. */
function candidates(masked: string): Candidate[] {
  const found: Candidate[] = []
  const lines = masked.split('\n')
  for (const [index, line] of lines.entries()) {
    const head = DECL_HEAD.exec(line)
    if (head?.[1]) {
      const initializer = initializerOf(lines, index)
      if (initializer !== undefined && CONTAINER_INIT.test(initializer)) {
        found.push({
          line: index + 1,
          name: head[1],
          kind: kindOf(initializer),
          stateClass: 'mutable-container',
        })
        continue
      }
    }
    const binding = LET_DECL.exec(line)
    if (binding?.[1]) {
      found.push({
        line: index + 1,
        name: binding[1],
        kind: 'let',
        stateClass: 'mutable-binding',
      })
    }
  }
  return found
}

function isMutated(masked: string, name: string, line: number): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const memberWrite = new RegExp(
    `(?<![\\w$.])${escaped}\\s*\\.\\s*(?:${MUTATORS.join('|')})\\s*\\(`,
  )
  const indexWrite = new RegExp(`(?<![\\w$.])${escaped}\\s*\\[[^\\]]*\\]\\s*=`)
  const rebind = new RegExp(`(?<![\\w$.])${escaped}\\s*(?:=[^=]|\\+\\+|--)`)
  for (const [index, rawLine] of masked.split('\n').entries()) {
    if (index + 1 === line) continue
    if (
      memberWrite.test(rawLine) ||
      indexWrite.test(rawLine) ||
      rebind.test(rawLine)
    )
      return true
  }
  return false
}

/** Body text of every `reset*` / `clear*` / `__reset*` function, by name. */
function resetBodies(masked: string): Map<string, string> {
  const bodies = new Map<string, string>()
  const pattern =
    /^(?:export\s+)?(?:async\s+)?function\s+((?:__)?(?:reset|clear)[\w$]*)\s*\(/gm
  for (const match of masked.matchAll(pattern)) {
    const name = match[1]
    if (!name || match.index === undefined) continue
    const open = masked.indexOf('{', match.index)
    if (open === -1) continue
    let depth = 0
    for (let i = open; i < masked.length; i += 1) {
      if (masked[i] === '{') depth += 1
      else if (masked[i] === '}') {
        depth -= 1
        if (depth === 0) {
          bodies.set(name, masked.slice(open + 1, i))
          break
        }
      }
    }
  }
  return bodies
}

function coveringResets(masked: string, name: string): string[] {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const named = new RegExp(`(?<![\\w$.])${escaped}(?![\\w$])`)
  return [...resetBodies(masked)]
    .filter(([, body]) => named.test(body))
    .map(([resetName]) => resetName)
}

/** The analysis for one file's source. */
export function analyzeSource(source: string): {
  findings: ModuleStateFinding[]
  cured: CuredBinding[]
  constants: number
} {
  const masked = maskNonCode(source)
  const findings: ModuleStateFinding[] = []
  const cured: CuredBinding[] = []
  let constants = 0
  for (const candidate of candidates(masked)) {
    const mutated =
      candidate.stateClass === 'mutable-binding' ||
      isMutated(masked, candidate.name, candidate.line)
    if (!mutated) {
      constants += 1
      continue
    }
    const resets = coveringResets(masked, candidate.name)
    if (resets.length > 0) {
      cured.push({ file: '', name: candidate.name, reset: resets[0] ?? '' })
      continue
    }
    findings.push({
      file: '',
      line: candidate.line,
      name: candidate.name,
      kind: candidate.kind,
      stateClass: candidate.stateClass,
    })
  }
  return { findings, cured, constants }
}
