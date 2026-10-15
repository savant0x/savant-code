/**
 * fid-surface-coverage — the missing relation between a record's declared
 * gates and the surfaces its fix touched (FID-2026-1012-027).
 *
 * `fid:verify` runs the gates a record CHOOSES and stamps a receipt when they
 * pass. Nothing checked that the chosen set COVERS the paths the record was
 * authorised to touch, so on 2026-10-13 `FID-2026-1012-021` stamped a green
 * receipt while the root `typecheck`'s scripts-tree leg was red on a file
 * inside that record's own `SCOPE.md` surface — and the omission was invisible
 * to `validate:repository`, which audits whether every enforced gate is
 * *declarable* (a property of the gate) but never whether a record's
 * declarations are *sufficient* (a property of the record).
 *
 * Coverage is a relation, so this module holds it. Both inputs already exist
 * and are machine-readable:
 *
 *   - the record's declared gates — its `## Verification Gates` block, parsed
 *     by the same module `fid:verify` uses (`parseVerificationGates`), so the
 *     audit and the executor can never disagree about what a record declared;
 *   - the record's authorised write surface — its line in `SCOPE.md`'s
 *     machine-readable scope-targets section, read through the ONE parser the
 *     Law 2 write gate also uses (`loadScopeTargetsByItem`).
 *
 * Mapping v1 (conservative and extensible; every rule states the enforced gate
 * it implies, not a guess about the fix):
 *
 *   - any path under `scripts/**` ⇒ `probe scripts/scripts-typecheck-check.ts`
 *     (the root typecheck chain's scripts-tree leg; `scripts` is not a bun
 *     workspace, so it has no `typecheck <workspace>` form);
 *   - any path under a workspace whose `VALIDATION_WORKSPACE_POLICY` says
 *     `requiredTypecheck` ⇒ `typecheck <workspace>`;
 *   - every record with a known surface ⇒ `quality` (the repo-wide gate).
 *
 * Boundaries, stated because they are real: the mapping proves a leg is
 * *declared*, never that the declaration is the strongest gate for that
 * surface (that stays the subject of the declared gate's own artifact). A
 * `fixed`/`verified` record with no register line, or a line naming no paths,
 * is reported as its own issue: the surface is unknown, so coverage cannot be
 * claimed. Records outside the enforced statuses (`converged`, `created`,
 * `analyzed`) are not gated — they are pre-implementation by construction.
 *
 * Wired into `validate:repository`, so an omission fails the repository with
 * the record, the missing declaration and the demanding surface named —
 * fixed by declaring the gate or by narrowing the surface, never by prose.
 */

import path from 'node:path'

import { parseVerificationGates } from '@savant-code/agent-runtime/echo/fid-verification-gates'
import { loadScopeTargetsByItem } from '@savant-code/agent-runtime/echo/scope-targets'

import { activeFixedFidFiles } from './fid-gates'
import { gateLabel } from './fid-verify'
import { VALIDATION_WORKSPACE_POLICY } from './validation-manifest'

import type { ValidationIssue } from './validation-manifest'
import type { VerificationGate } from '@savant-code/agent-runtime/echo/fid-verification-gates'

/** The scripts-tree leg's declarable form (see ./gate-declarability-registry). */
const SCRIPTS_TYPECHECK_DECLARATION: VerificationGate = {
  kind: 'probe',
  arg: 'scripts/scripts-typecheck-check.ts',
}

/** The repo-wide gate every record with a known surface must declare. */
const QUALITY_DECLARATION: VerificationGate = { kind: 'quality', arg: '' }

/** Workspaces whose typecheck is part of the root `typecheck` chain. */
const REQUIRED_TYPECHECK_WORKSPACES: ReadonlySet<string> = new Set(
  VALIDATION_WORKSPACE_POLICY.filter((entry) => entry.requiredTypecheck).map(
    (entry) => entry.workspace,
  ),
)

const FID_ID = /\bFID-\d{4}-\d{4}-\d{3}\b/

/** A gate the record's own surface demands, with the glob that demands it. */
type Demand = {
  declaration: VerificationGate
  surface: string
}

/**
 * The declaration key `fid:verify` uses for a gate — delegated to the executor's
 * own `gateLabel`, so this audit and the receipt contract cannot disagree about
 * whether a record declared a gate (a blank `quality` arg is the case that
 * bites a hand-rolled join).
 */
function declarationKey(gate: VerificationGate): string {
  return gateLabel(gate.kind, gate.arg)
}

/** Path segments of a register glob, normalised to posix. */
function globSegments(glob: string): string[] {
  return glob.replace(/^\.\//, '').replace(/\\/g, '/').split('/')
}

/**
 * The workspace a glob's paths live in: the first segment, except under
 * `packages/` where the workspace is the two-segment package root. A glob with
 * no workspace (`dev/**`, `docs/**`, `SCOPE.md`, `package.json`) returns
 * undefined, so it demands nothing but the repo-wide gate.
 */
function workspaceForGlob(glob: string): string | undefined {
  const segments = globSegments(glob)
  const first = segments[0]
  if (!first) return undefined
  if (first === 'packages') {
    const second = segments[1]
    return second ? `packages/${second}` : undefined
  }
  return first
}

/** Every enforced gate a register glob list implies, deduplicated. */
function demandedDeclarations(globs: readonly string[]): Demand[] {
  const demands = new Map<string, Demand>()
  const add = (declaration: VerificationGate, surface: string): void => {
    const key = declarationKey(declaration)
    if (!demands.has(key)) demands.set(key, { declaration, surface })
  }

  add(QUALITY_DECLARATION, 'the repository-wide quality ceiling')
  for (const glob of globs) {
    const workspace = workspaceForGlob(glob)
    if (workspace === 'scripts') {
      add(SCRIPTS_TYPECHECK_DECLARATION, glob)
      continue
    }
    if (workspace && REQUIRED_TYPECHECK_WORKSPACES.has(workspace)) {
      add({ kind: 'typecheck', arg: workspace }, glob)
    }
  }
  return [...demands.values()]
}

/**
 * Every coverage gap under `root`: an enforced record whose declared gate set
 * does not include a gate its own register surface demands, a record with no
 * register line, or one whose line names no paths.
 */
export function collectRecordCoverageIssues(root: string): ValidationIssue[] {
  const { targets, exists, sectionPresent } = loadScopeTargetsByItem(
    path.join(root, 'SCOPE.md'),
  )
  // A missing register, or one without the machine-readable section, is the
  // register-completeness gate's contract (`scope.unregistered-item`), not this
  // audit's: with no surface section there is no relation to check. Reading
  // "section absent" as "every record is unregistered" would report the same
  // fact once per record and turn one register fix into N findings.
  if (!exists || !sectionPresent) return []

  const issues: ValidationIssue[] = []
  for (const record of activeFixedFidFiles(root)) {
    const id = FID_ID.exec(record.name)?.[0]
    if (!id) continue

    const globs = targets.get(id)
    if (globs === undefined) {
      issues.push({
        code: 'fid.coverage.unregistered',
        message:
          `${record.name}: ${id} is ${record.status} but has no line in ` +
          "SCOPE.md's machine-readable scope targets, so the surface its fix " +
          'touched is unknown and coverage cannot be claimed. Add the ' +
          'register line (the paths this record may write) or narrow the ' +
          'record — FID-2026-1012-027.',
      })
      continue
    }
    if (globs.length === 0) {
      issues.push({
        code: 'fid.coverage.pathless',
        message:
          `${record.name}: ${id}'s register line names no paths, so its ` +
          'surface is unknown and coverage cannot be claimed. Name the paths ' +
          'the record may write (a head-line glob is mandatory — see the ' +
          'register grammar) — FID-2026-1012-027.',
      })
      continue
    }

    const declared = new Set(
      parseVerificationGates(record.content).gates.map(declarationKey),
    )
    for (const demand of demandedDeclarations(globs)) {
      const key = declarationKey(demand.declaration)
      if (declared.has(key)) continue
      issues.push({
        code: 'fid.coverage.missing-gate',
        message:
          `${record.name}: declares no gate that covers its own surface — ` +
          `the register glob \`${demand.surface}\` demands ` +
          `\`- gate: ${key}\`, which the record's ## Verification Gates ` +
          'block does not declare. Declare the gate (and re-stamp the ' +
          'receipt) or narrow the write surface — FID-2026-1012-027.',
      })
    }
  }
  return issues
}
