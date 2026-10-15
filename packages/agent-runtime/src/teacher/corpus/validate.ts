/**
 * Corpus validation — FID-2026-0813-015.
 *
 * Proves behavior before a challenge ships: the known-good solution passes
 * deterministically across repeated runs, every registered mutation has a real
 * witness (the mutated source actually fails), and no private answer material
 * leaks into the learner-visible public prose. No generated challenge becomes
 * curriculum merely because an agent generated it.
 */
import { applyMutation } from '../mutation'
import { buildSandboxPolicy } from '../sandbox'

import type { ChallengeSource } from './source'
import type { SandboxBackend } from '../sandbox'
import type { SandboxStatus } from '@savant-code/common/teacher'

export type KnownGoodReport = {
  runs: number
  allPassed: boolean
  statuses: SandboxStatus[]
}

export type MutationWitnessReport = {
  mutationId: string
  applied: boolean
  /** True when the mutated source actually fails the hidden tests. */
  witnessReal: boolean
  status: SandboxStatus
}

export type IsolationReport = {
  passed: boolean
  findings: string[]
}

export type ValidationReport = {
  valid: boolean
  knownGood: KnownGoodReport
  mutations: MutationWitnessReport[]
  isolation: IsolationReport
  errors: string[]
}

/** Public prose surfaces that must never contain private answer material. */
function publicProseFields(source: ChallengeSource): string[] {
  return [
    source.objective,
    source.prompt,
    source.visibleGuidance,
    source.inputContract.signature,
    ...source.inputContract.examples,
    source.outputContract.description,
    ...source.outputContract.examples,
    ...source.prerequisites.map((prerequisite) => prerequisite.reason),
  ]
}

/** Private markers that must not appear in any learner-visible prose. */
function privateMarkers(source: ChallengeSource): string[] {
  const markers = [source.knownGoodSource, source.hiddenTests]
  for (const mutation of source.mutationContracts) {
    markers.push(
      mutation.witness,
      mutation.changedBehavior,
      mutation.patch.find,
      mutation.patch.replace,
      ...mutation.acceptableConcepts,
    )
  }
  return markers
}

export function scanIsolation(source: ChallengeSource): IsolationReport {
  const fields = publicProseFields(source)
  const markers = privateMarkers(source)
  const findings: string[] = []
  for (const field of fields) {
    for (const marker of markers) {
      const trimmed = marker.trim()
      if (trimmed.length >= 8 && field.includes(trimmed)) {
        findings.push(
          `public field '${field.slice(0, 40)}…' contains private marker '${trimmed.slice(0, 40)}…'`,
        )
      }
    }
  }
  return { passed: findings.length === 0, findings }
}

export async function validateChallenge(
  source: ChallengeSource,
  sandbox: SandboxBackend,
  repetitions = 20,
): Promise<ValidationReport> {
  const errors: string[] = []
  const policy = buildSandboxPolicy(source.limits)

  // Known-good repeatability: identical status across every run.
  const statuses: SandboxStatus[] = []
  for (let i = 0; i < repetitions; i++) {
    const result = await sandbox.run({
      solutionSource: source.knownGoodSource,
      testsSource: source.hiddenTests,
      policy,
    })
    statuses.push(result.status)
  }
  const allPassed = statuses.every((status) => status === 'passed')

  // Mutation witnesses: each mutation must produce a real, detectable defect.
  const mutationReports: MutationWitnessReport[] = []
  for (const contract of source.mutationContracts) {
    const { applied, source: mutated } = applyMutation(
      source.knownGoodSource,
      contract,
    )
    if (!applied) {
      mutationReports.push({
        mutationId: contract.mutationId,
        applied: false,
        witnessReal: false,
        status: 'failed',
      })
      errors.push(`mutation '${contract.mutationId}' patch did not apply`)
      continue
    }
    const result = await sandbox.run({
      solutionSource: mutated,
      testsSource: source.hiddenTests,
      policy,
    })
    mutationReports.push({
      mutationId: contract.mutationId,
      applied: true,
      witnessReal: result.status === 'failed',
      status: result.status,
    })
  }
  const allWitnessesReal = mutationReports.every((report) => report.witnessReal)

  const isolation = scanIsolation(source)

  const valid =
    errors.length === 0 && allPassed && allWitnessesReal && isolation.passed

  return {
    valid,
    knownGood: { runs: repetitions, allPassed, statuses },
    mutations: mutationReports,
    isolation,
    errors,
  }
}
