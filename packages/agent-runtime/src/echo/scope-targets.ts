/**
 * @module echo/scope-targets
 *
 * The ONE parser for the register's machine-readable target section
 * (`SCOPE.md` → "Machine-readable scope targets"), in two shapes:
 *
 * - `loadScopeTargetsByItem` — item id → its globs, for the per-record
 *   consumers (the Law 2 write gate matches a target against every item's
 *   set; the surface-coverage audit checks one record's declared gates
 *   against that record's own paths).
 * - `loadScopeArtifact` — the flat union, kept for the write gate's callers.
 *
 * Both come from this module on purpose: a second parser would be free to
 * disagree with the write gate about what an item covers, which is exactly the
 * drift this repository refuses elsewhere (see `dev/experiences/class-owners.json`
 * consuming one class-identity module).
 *
 * Line grammar, and its fail-closed bound, are unchanged from the write gate's
 * original parser (FID-2026-1004-006 B): `- <item-id>: \`glob\`, \`glob\`` with
 * indented continuation lines; continuation stops at the next item, a blank
 * line, or any non-indented text, so prose that merely mentions a backticked
 * glob contributes nothing.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ScopeTargetsByItem {
  /**
   * Item id → its globs. The id must match `[A-Za-z0-9-]+` (the ITEM_HEAD
   * token): a FID id, a `Tnnn` id, or a hyphenated label. A label containing
   * spaces or dots (`Release-0.0.36`) is not a machine key — its globs grant
   * nothing, so an item that needs targets must carry a parseable id.
   */
  targets: Map<string, string[]>
  exists: boolean
  /**
   * Whether the register carries the machine-readable section at all. A
   * consumer that audits COVERAGE (rather than gating a write) must not read
   * "section absent" as "every item is unregistered": the register's own
   * completeness gate owns that question.
   */
  sectionPresent: boolean
}

export interface ScopeArtifact {
  /** Every item's globs, flattened, in file order. */
  patterns: string[]
  exists: boolean
  sectionPresent: boolean
}

const SECTION_HEAD = /^##\s+Machine-readable scope targets\s*$/
const ITEM_HEAD = /^- ([A-Za-z0-9-]+): (.+)$/
const INDENTED = /^[ \t]+\S/
const BACKTICKED = /`([^`]+)`/g

function globsIn(line: string): string[] {
  return [...line.matchAll(BACKTICKED)].map((match) => match[1]!)
}

/** Item id → the globs its line (and indented continuation lines) declare. */
function* scanItemOccurrences(lines: string[]): Generator<{
  id: string
  globs: string[]
}> {
  for (let i = 0; i < lines.length; i++) {
    const head = ITEM_HEAD.exec(lines[i]!)
    if (!head) continue
    const globs = [...globsIn(head[2]!)]
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j]!
      if (next.trim() === '' || !INDENTED.test(next)) break
      globs.push(...globsIn(next))
    }
    yield { id: head[1]!, globs }
  }
}

/** Item id → the globs its line (and indented continuation lines) declare. */
export function loadScopeTargetsByItem(
  scopePath: string = join(process.cwd(), 'SCOPE.md'),
): ScopeTargetsByItem {
  const targets = new Map<string, string[]>()
  if (!existsSync(scopePath)) {
    return { targets, exists: false, sectionPresent: false }
  }
  const lines = readFileSync(scopePath, 'utf8').split(/\r?\n/)

  for (const { id, globs } of scanItemOccurrences(lines)) {
    const existing = targets.get(id)
    if (existing) existing.push(...globs)
    else targets.set(id, globs)
  }
  const sectionPresent = lines.some((line) => SECTION_HEAD.test(line))
  return { targets, exists: true, sectionPresent }
}

/**
 * The flat union, in FILE order — the write gate's callers depend on the
 * patterns reading in the order a reviewer sees them in the register, so this
 * flattens the raw scan rather than the per-item map (which groups an item's
 * globs together, reordering an item that is declared more than once).
 */
export function loadScopeArtifact(
  scopePath: string = join(process.cwd(), 'SCOPE.md'),
): ScopeArtifact {
  if (!existsSync(scopePath)) {
    return { patterns: [], exists: false, sectionPresent: false }
  }
  const lines = readFileSync(scopePath, 'utf8').split(/\r?\n/)
  const patterns: string[] = []
  for (const { globs } of scanItemOccurrences(lines)) patterns.push(...globs)
  const sectionPresent = lines.some((line) => SECTION_HEAD.test(line))
  return { patterns, exists: true, sectionPresent }
}
