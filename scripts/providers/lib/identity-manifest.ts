/**
 * FID-2026-1007-008 — the probe manifest, shared by the single-target run and
 * the catalog sweep so both send exactly the same probes. Split out of
 * `identity-gauntlet.ts` to keep the CLI well under the 300-line ceiling.
 *
 * Probe bodies are benign, versioned, and never a hidden prompt.
 */
import { IDENTITY_VECTORS } from './identity-core'

import type {
  IdentityVector,
  ProbeBudget,
  ProbeManifest,
  ProbeSpec,
} from './identity-core'

export const MANIFEST_VERSION = 'identity-manifest/1'

export const PROBE_TEXTS: Record<
  IdentityVector,
  { claim: string; prompt: string }
> = {
  A: {
    claim: 'reported input-token counts are consistent with the response text',
    prompt: 'Reply with exactly: ALPHA BRAVO CHARLIE',
  },
  B: {
    claim: 'the served model handles delimiters as the claimed model does',
    prompt: 'Between <<< and >>> say OK. <<<OK>>>',
  },
  C: {
    claim: 'deterministic output constraints are met',
    prompt: 'Output only the number 17 and nothing else.',
  },
  D: {
    claim:
      'refusals and benign alignment behavior are distributionally typical',
    prompt: 'Summarize in one sentence why backups matter.',
  },
  E: {
    claim: 'repeated positional retrieval succeeds and latency is recorded',
    prompt: 'List the third word of this sentence: one two three four.',
  },
}

const DEFAULT_BUDGET: ProbeBudget = {
  maxAttempts: 25,
  maxTotalTokens: 40_000,
  maxWallMs: 300_000,
}

export interface ManifestTarget {
  provider: string
  model: string
  baseUrl: string
  controls?: ProbeManifest['controls']
  /** Defaults to all five vectors; a sweep uses `['A']` for a handshake. */
  vectors?: readonly IdentityVector[]
  budget?: ProbeBudget
}

export function buildManifest(target: ManifestTarget): ProbeManifest {
  const vectors = target.vectors ?? IDENTITY_VECTORS
  const probes: ProbeSpec[] = vectors.map((vector) => ({
    id: `probe-${vector}`,
    vector,
    ...PROBE_TEXTS[vector],
  }))
  return {
    version: MANIFEST_VERSION,
    target: {
      provider: target.provider,
      requestedModel: target.model,
      baseUrl: target.baseUrl,
    },
    budget: target.budget ?? DEFAULT_BUDGET,
    probes,
    controls: target.controls ?? {},
  }
}
