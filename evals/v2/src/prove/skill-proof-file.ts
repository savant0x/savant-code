import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { loadProvenanceSession } from '@savant-code/common/provenance/loader'

import { proofArtifactSchema } from '../stats/skill-efficacy'

import type { SkillProofArtifact, ZtapMode } from '../stats/skill-efficacy'

/** On-disk location of a skill's proof artifact. */
export function skillProofPath(projectRoot: string, name: string): string {
  return path.join(projectRoot, '.savant', 'skill-proofs', `${name}.json`)
}

/**
 * Read + schema-validate a proof artifact; null when absent or malformed
 * (fail-open — a corrupt artifact must never block an operator decision).
 */
export function readSkillProofArtifact(
  projectRoot: string,
  name: string,
): SkillProofArtifact | null {
  try {
    const raw = readFileSync(skillProofPath(projectRoot, name), 'utf8')
    return proofArtifactSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

/**
 * FID-2026-0824-016 step 4 — ZTAP receipt binding.
 *
 * When provenance mode is record/enforce AND a session ledger exists for the
 * prove run, bind the NEWEST signed receipt into the on-disk artifact as
 * `ztap.receipt_fingerprint` (sha256 over the canonical receipt identity:
 * sessionId + seq + changeHash + signatures) and flip `bound` to true only
 * when such a receipt was found.
 *
 * Fail-open: any ledger error leaves the artifact unbound rather than
 * blocking an operator trust decision. Receipt CREATION itself lives in the
 * agent-runtime provenance session during real runs; this call-site binds
 * artifact ↔ receipt after the fact.
 */
export async function bindZtapReceipt(params: {
  projectRoot: string
  skillName: string
  ztapMode: ZtapMode
  /** Provenance session dir; defaults to <projectRoot>/.savant/provenance. */
  sessionDir?: string
}): Promise<SkillProofArtifact | null> {
  const existing = readSkillProofArtifact(params.projectRoot, params.skillName)
  if (!existing || params.ztapMode === 'off') {
    return existing
  }

  const sessionDir =
    params.sessionDir ?? path.join(params.projectRoot, '.savant', 'provenance')

  let fingerprint: string | undefined
  try {
    const session = await loadProvenanceSession(sessionDir)
    const newestSigned = [...session.receipts]
      .reverse()
      .find((receipt) => receipt.signatures.length > 0)
    if (newestSigned) {
      const canonical = JSON.stringify({
        sessionId: newestSigned.sessionId,
        seq: newestSigned.seq,
        changeHash: newestSigned.changeHash,
        signatures: newestSigned.signatures,
      })
      fingerprint = `sha256:${createHash('sha256').update(canonical).digest('hex')}`
    }
  } catch {
    // Fail-open: provenance ledger errors never block trust decisions.
  }

  const bound: SkillProofArtifact =
    fingerprint === undefined
      ? existing
      : proofArtifactSchema.parse({
          ...existing,
          ztap: {
            ...existing.ztap,
            bound: true,
            receipt_fingerprint: fingerprint,
          },
        })

  writeFileSync(
    skillProofPath(params.projectRoot, params.skillName),
    `${JSON.stringify(bound, null, 2)}\n`,
    'utf8',
  )
  return bound
}
