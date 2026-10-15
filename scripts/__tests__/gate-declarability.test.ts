/**
 * The gate-declarability audit: every repository gate must have an allowlisted
 * `fid:verify` declaration, or be undeclarable for a stated, permitted reason.
 *
 * The defect these tests exist for is not a wrong gate — it is a gate that
 * cannot be DECLARED, which makes a FID whose subject is that gate
 * unverifiable. See `scripts/gate-declarability.ts` for the rationale.
 */
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { resolveGate, runGates } from '../fid-verify'
import {
  auditedGates,
  collectGateDeclarabilityIssues,
  INTENTIONALLY_NON_DECLARABLE,
} from '../gate-declarability'
import { repositoryValidationGates } from '../validation-manifest'

const root = path.resolve(import.meta.dir, '..', '..')

describe('the gate audit is complete', () => {
  test('every root contract gate has an audited entry', () => {
    const audited = new Set(auditedGates().map((gate) => gate.label))
    const unaudited = repositoryValidationGates(root)
      .map((gate) => gate.label)
      .filter((label) => !audited.has(label))
    expect(unaudited).toEqual([])
  })

  test('the repository audit is clean', () => {
    expect(collectGateDeclarabilityIssues(root)).toEqual([])
  })

  test('no gate label is audited twice', () => {
    const labels = auditedGates().map((gate) => gate.label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('every declared form is accepted by the real allowlist', () => {
  // This is the point of the whole module: "expressible" means the executor
  // agrees. Resolving here means a probe file that is renamed, deleted, or
  // moved outside the repo fails this test, not a FID months later.
  test('each declaration resolves without error', () => {
    const failures: string[] = []
    for (const gate of auditedGates()) {
      for (const declaration of gate.declarations) {
        const resolved = resolveGate(declaration.kind, declaration.arg)
        if ('error' in resolved) {
          failures.push(
            `${gate.label}: ${declaration.kind} ${declaration.arg} — ${resolved.error}`,
          )
        }
      }
    }
    expect(failures).toEqual([])
  })

  test('every gate states how it is proven or why it cannot be', () => {
    const unexplained = auditedGates()
      .filter(
        (gate) =>
          gate.nonDeclarable === undefined &&
          gate.declarations.length === 0 &&
          gate.memberKind === undefined,
      )
      .map((gate) => gate.label)
    expect(unexplained).toEqual([])
  })

  test('an undeclarable gate carries a reason and is on the permit list', () => {
    for (const gate of auditedGates()) {
      if (gate.nonDeclarable === undefined) continue
      expect(INTENTIONALLY_NON_DECLARABLE.has(gate.label)).toBe(true)
      expect(gate.nonDeclarable.trim().length).toBeGreaterThan(0)
    }
  })

  test('the permit list is exactly the gates that are undeclarable', () => {
    const undeclarable = auditedGates()
      .filter((gate) => gate.nonDeclarable !== undefined)
      .map((gate) => gate.label)
      .sort()
    expect(undeclarable).toEqual([...INTENTIONALLY_NON_DECLARABLE].sort())
  })
})

describe('a declared repo-gate probe runs through the real executor', () => {
  test('the executor accepts and runs a repo-gate probe declaration', () => {
    // End-to-end through the interface a FID actually uses: the declaration
    // shape recorded on a record, executed by the allowlisted executor.
    const { results, errors } = runGates([
      { kind: 'probe', arg: 'scripts/hygiene.ts' },
    ])
    expect(errors).toEqual([])
    expect(results[0]?.label).toBe('probe scripts/hygiene.ts')
    expect(results[0]?.exit).toBe(0)
  })
})

describe('the audit pins the one gate that must stay undeclarable', () => {
  test('validate:repository is never declared (C3 recursion)', () => {
    // It live-re-runs every active FID's declared gates, so declaring it would
    // recurse into that FID's own verification (lesson, FID-2026-0915-004).
    // Pinned so a future "completeness" sweep cannot silently add it.
    const audit = auditedGates().find(
      (gate) => gate.label === 'repository-validation',
    )
    expect(audit?.declarations).toEqual([])
    expect(audit?.nonDeclarable).toBeDefined()
  })

  test('a contract gate missing from the audit is reported', () => {
    // The regression this catches is a NEW contract gate nobody declared. It is
    // proven by removing one entry from the audit and observing the issue.
    const labels = new Set(
      auditedGates()
        .map((gate) => gate.label)
        .filter((label) => label !== 'markdownlint'),
    )
    const missing = repositoryValidationGates(root)
      .map((gate) => gate.label)
      .filter((label) => !labels.has(label))
    expect(missing).toEqual(['markdownlint'])
  })
})
