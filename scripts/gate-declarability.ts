/**
 * gate-declarability — the audit that makes every repository gate recordable.
 *
 * The FID gate executor accepts four shapes only: `typecheck <workspace>`,
 * `test <path>`, `probe <path>`, `quality` (FID-2026-0823-009). A gate that is
 * a binary (`eslint`, `prettier`, `cargo`), a package-manager invocation
 * (`bun install --frozen-lockfile`), a build, or a script that only checks when
 * passed `--check` has NO declaration in that vocabulary — so a record whose
 * subject is that gate could not declare the gate that proves it. That is how a
 * check becomes un-recordable: not by being wrong, but by being undeclarable.
 *
 * The audited table lives in `./gate-declarability-registry`; this module holds
 * the guard. `collectGateDeclarabilityIssues(root)` fails when a contract gate
 * has no audited entry, when a declaration is not accepted by the real
 * allowlist (it resolves it with `resolveGate`, so "expressible" means the
 * executor agrees — the file exists, the kind is allowed, the path cannot
 * escape the repo), or when a gate is left undeclarable without a stated,
 * permitted reason.
 *
 * Wired into `validate:repository`, so the audit is a hard gate: adding a gate
 * with no declarable form fails the repository rather than surfacing years
 * later inside a FID that cannot prove its own fix.
 */
import { resolveGate } from './fid-verify'
import {
  auditedGates,
  INTENTIONALLY_NON_DECLARABLE,
} from './gate-declarability-registry'
import { repositoryValidationGates } from './validation-manifest'

import type { ValidationIssue } from './validation-manifest'

export {
  auditedGates,
  INTENTIONALLY_NON_DECLARABLE,
} from './gate-declarability-registry'
export type {
  AuditedGate,
  GateDeclaration,
  GateSource,
} from './gate-declarability-registry'

/**
 * The declarability audit. Fails when a gate the repository enforces cannot be
 * declared on a FID: a contract gate with no audited entry, a declaration the
 * real allowlist rejects, a probe file that does not exist, or an undeclarable
 * gate with no stated (and permitted) reason.
 */
export function collectGateDeclarabilityIssues(
  root: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const byLabel = new Map<string, ReturnType<typeof auditedGates>[number]>()

  for (const gate of auditedGates()) {
    if (byLabel.has(gate.label)) {
      issues.push({
        code: 'gate-declarability.duplicate',
        message: `${gate.label} appears more than once in the gate audit.`,
      })
    }
    byLabel.set(gate.label, gate)

    for (const declaration of gate.declarations) {
      const resolved = resolveGate(declaration.kind, declaration.arg)
      if ('error' in resolved) {
        issues.push({
          code: 'gate-declarability.unresolvable',
          message: `${gate.label}: declared ${declaration.kind} ${declaration.arg} is not accepted by the gate allowlist — ${resolved.error}`,
        })
      }
    }

    if (gate.memberKind === 'test' && gate.declarations.length === 0) {
      // Prove the vocabulary admits members rather than asserting it: the
      // executor must accept a real suite path under the declared kind.
      const member = resolveGate('test', 'scripts/__tests__/fid-verify.test.ts')
      if ('error' in member) {
        issues.push({
          code: 'gate-declarability.member-kind',
          message: `${gate.label}: kind "test" admits no member suite — ${member.error}`,
        })
      }
    }

    if (gate.nonDeclarable !== undefined) {
      if (!INTENTIONALLY_NON_DECLARABLE.has(gate.label)) {
        issues.push({
          code: 'gate-declarability.undeclarable',
          message: `${gate.label} is marked undeclarable but is not in INTENTIONALLY_NON_DECLARABLE.`,
        })
      }
      if (gate.nonDeclarable.trim() === '') {
        issues.push({
          code: 'gate-declarability.reason-missing',
          message: `${gate.label} is undeclarable with no stated reason.`,
        })
      }
    } else if (
      gate.declarations.length === 0 &&
      gate.memberKind === undefined
    ) {
      issues.push({
        code: 'gate-declarability.no-form',
        message: `${gate.label} has no declarable form and no stated reason.`,
      })
    }
  }

  // Every gate the release contract enforces must be audited — this is the
  // direction that actually regresses: a NEW contract gate nobody declared.
  for (const contractGate of repositoryValidationGates(root)) {
    if (!byLabel.has(contractGate.label)) {
      issues.push({
        code: 'gate-declarability.unaudited',
        message: `${contractGate.label} is enforced by the root gate contract but is not in the gate audit.`,
      })
    }
  }

  return issues
}
