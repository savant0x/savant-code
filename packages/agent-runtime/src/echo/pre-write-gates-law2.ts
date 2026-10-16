/**
 * @module echo/pre-write-gates-law2
 *
 * FID-2026-1001-003 step 5a — the Law 2 write-time scope gate (Ruling 2:
 * "if it's in scope, then it's mechanically presented"). Presentation of
 * scope happens ONCE, at approval; the register records what was approved.
 * This gate makes that record mechanical: a write target not covered by an
 * approved item's pattern is blocked — which also removes the failure mode
 * where an agent emits one token of presentation and then writes freely.
 *
 * Contract:
 * - The register is `SCOPE.md` at `process.cwd()`; its "Machine-readable
 *   scope targets" section maps item IDs to glob patterns (operator-approved
 *   2026-10-02). No pattern covers a target → block, fail-closed.
 * - An item with no pattern is non-covering by construction (its line
 *   contributes no globs).
 * - A MISSING register is a stated limit: presence/structure of SCOPE.md is
 *   the repo gate's contract (`validate:repository` → `scope.*`), so the
 *   write-time gate is active only where the register exists. Never a
 *   silent pass where the register exists and does not cover.
 * - Governance surfaces the protocol itself MANDATES writing (dev/, agent
 *   skills, hooks, the root protocol artifacts) are GATE-LEVEL exemptions
 *   (operator ruling 2026-10-02) — not register items — so mandatory
 *   protocol behavior (FID writes, session summaries, register updates)
 *   cannot wedge the gate.
 * - JURISDICTION BOUNDARY (closure correction, 2026-10-02): the gate's
 *   authority is the register at `process.cwd()` over targets UNDER that
 *   cwd. A target that does not resolve under cwd cannot be matched
 *   against a repo-relative pattern set (the match would be nonsense) and
 *   is not this gate's business — out-of-project writes are the
 *   project-directory G-law's surface. Skipping keeps the gate
 *   fail-closed exactly where its register has authority (pinned in
 *   law2-scope-gate.test.ts); a synthetic `/proj/...` target in a unit
 *   test is not a real write the register must cover.
 * - Laws 1-4 block in every mode and tier (FID-2026-0823-007); this gate
 *   carries no tier/mode branch.
 */

import { canonicalizePath } from './path-canonicalization'
// FID-2026-1012-027: the parser moved to `./scope-targets` and is shared with
// the surface-coverage audit, so the write gate and the audit cannot disagree
// about what an item covers. Behavior (grammar + fail-closed continuation) is
// unchanged; the module's own pins stay green. The local import is what the
// gate calls; the re-exports keep this module's published surface (and its
// pinned unit test imports) intact.
import { loadScopeArtifact } from './scope-targets'
export { loadScopeArtifact } from './scope-targets'
export type { ScopeArtifact } from './scope-targets'

/** Root-relative governance surfaces exempt at the gate (operator ruling). */
const GOVERNANCE_EXEMPT_EXACT = new Set([
  'SCOPE.md',
  'CHANGELOG.md',
  'ECHO.md',
  'AGENTS.md',
  'ARCHITECTURE.md',
  'CONTRIBUTING.md',
  'protocol.config.yaml',
])

const GOVERNANCE_EXEMPT_PREFIXES = ['dev/', '.agents/', '.githooks/']

/**
 * Minimal glob matcher for the register's pattern vocabulary: `**` crosses
 * separators, `*` stays within one segment, everything else is literal.
 * Unit-pinned in law2-scope-gate.test.ts.
 */
export function globToRegExp(pattern: string): RegExp {
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        re += '.*'
        i++
      } else {
        re += '[^/]*'
      }
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${re}$`)
}

/**
 * Repo-relative posix form of a write target (the register's namespace),
 * or undefined when the target does not resolve under cwd — outside this
 * gate's jurisdiction (see the module contract).
 *
 * `canonicalizePath` strips the drive letter (its Law-1 comparison form),
 * so the cwd is reduced the same way before a prefix comparison — a
 * `relative()` call would compare a drive-lettered prefix against a
 * stripped path and mis-resolve every target on Windows.
 */
function toRepoRelative(raw: string): string | undefined {
  const canonical = canonicalizePath(raw)
  const prefix = process
    .cwd()
    .replace(/\\/g, '/')
    .replace(/^[A-Za-z]:/, '')
  if (!canonical.startsWith(`${prefix}/`)) return undefined
  return canonical.slice(prefix.length + 1)
}

function isGovernanceExempt(rel: string): boolean {
  if (GOVERNANCE_EXEMPT_EXACT.has(rel)) return true
  return GOVERNANCE_EXEMPT_PREFIXES.some((prefix) => rel.startsWith(prefix))
}

/**
 * Resolve every mutating target against the register. `targets` carries the
 * write tool's target AND the classifier's terminal mutation targets, so a
 * `sed -i src/foo.ts` resolves through the same gate as a write_file.
 */
export function runLaw2Gate(params: {
  targets: (string | undefined)[]
  scopePath?: string
  allowedWriteGlobs?: readonly (readonly string[])[]
}): { blocked: boolean; reason?: string } {
  const artifact = loadScopeArtifact(params.scopePath)
  for (const raw of params.targets) {
    if (!raw) continue
    const rel = toRepoRelative(raw)
    if (
      params.allowedWriteGlobs?.some(
        (layer) =>
          rel === undefined ||
          !layer.some((pattern) => globToRegExp(pattern).test(rel)),
      )
    ) {
      return {
        blocked: true,
        reason: `Law 2 (writeScope clamp): target "${raw}" is outside this subagent's assigned writeScope.`,
      }
    }
    // Jurisdiction boundary: a target outside cwd is not resolvable
    // against the register's repo-relative patterns (see module contract).
    if (rel === undefined) continue
    if (!artifact.exists) continue
    if (isGovernanceExempt(rel)) continue
    if (!artifact.patterns.some((p) => globToRegExp(p).test(rel))) {
      return {
        blocked: true,
        reason:
          `Law 2: no approved scope item covers "${raw}"; present it first ` +
          '(FID-2026-1001-003 step 5a).',
      }
    }
  }
  return { blocked: false }
}
