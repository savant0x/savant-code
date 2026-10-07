/**
 * FID-2026-1007-008 — identity gauntlet: manifest, budget, evidence shapes and
 * redaction. The runner lives in `identity-runner.ts`.
 *
 * Pure: no network, no filesystem, no clock of its own. The caller injects a
 * `ProbeInvoker`, so every rule is testable offline and live mode is a wrapper
 * around the same engine rather than a second implementation.
 *
 * What this deliberately is NOT:
 * - **Not a fraud verdict from one probe.** The research's own sources put the
 *   equal error rate at 7.3% *with forty probe cells*, and the detector it
 *   references calls a mismatch evidence rather than proof. A weak signal, an
 *   absent control or an unavailable endpoint yields `inconclusive`.
 * - **Not the addendum's 0.85 auto-failover.** No numeric decision threshold is
 *   applied anywhere in this program. A composite is emitted only when the
 *   caller supplies held-out calibration, and even then it carries its
 *   components and stays advisory.
 * - **Not a routing change.** The engine returns a report; it cannot mutate a
 *   catalog, a config or a call path.
 *
 * Vectors A–E are reported separately because they test different claims. A
 * response that looks like another model may be a proxy, a chat template, a
 * quantized build or load variance; folding them into one number would hide
 * exactly the distinction the operator has to judge.
 */

export const IDENTITY_VECTORS = ['A', 'B', 'C', 'D', 'E'] as const
export type IdentityVector = (typeof IDENTITY_VECTORS)[number]

/**
 * Mirrors the runtime seam's union in
 * `packages/agent-runtime/src/provider-boundary/identity-observation.ts`. Kept
 * as a local literal union because a cross-package deep import does not resolve
 * under `scripts/tsconfig.json`; the pin test reads that module's source and
 * fails if the two diverge.
 */
export type IdentityVerdictStatus =
  'verified-for-tested-claims' | 'mismatch-requiring-review' | 'inconclusive'

export interface IdentityTarget {
  provider: string
  requestedModel: string
  baseUrl: string
}

export interface ProbeSpec {
  id: string
  vector: IdentityVector
  /** The claim this probe contributes evidence about, in the caller's words. */
  claim: string
  /** Harness-shaped prompt. Never seeks or prints a hidden system prompt. */
  prompt: string
}

export interface ProbeBudget {
  maxAttempts: number
  maxTotalTokens: number
  maxWallMs: number
}

export interface ProbeManifest {
  version: string
  target: IdentityTarget
  budget: ProbeBudget
  probes: readonly ProbeSpec[]
  /** Controls the verdict depends on. Absent controls force `inconclusive`. */
  controls?: {
    sameModel?: IdentityTarget
    differentModel?: IdentityTarget
  }
}

export interface ProbeSample {
  probeId: string
  /** Normalized-comparable text; '' when the probe produced no text. */
  text: string
  servedModel?: string
  usage?: { inputTokens?: number; outputTokens?: number }
  latencyMs: number
  headers?: Record<string, string>
  /** Set when the probe did not complete. `timeout` is its own class. */
  failure?: { class: string; message: string }
}

export type ProbeInvoker = (
  target: IdentityTarget,
  spec: ProbeSpec,
) => Promise<ProbeSample>

export interface VectorFinding {
  vector: IdentityVector
  probes: number
  completed: number
  /** `no-signal` when nothing completed — never a silent pass. */
  status: 'consistent' | 'inconsistent' | 'no-signal'
  evidence: readonly string[]
}

export interface GauntletReport {
  manifestVersion: string
  target: IdentityTarget
  budget: ProbeBudget
  attemptsUsed: number
  tokensUsed: number
  wallMs: number
  exhausted: boolean
  exhaustionReason?: 'attempts' | 'tokens' | 'wall'
  vectors: readonly VectorFinding[]
  controls: {
    sameModel?: 'matched' | 'separated' | 'unavailable'
    differentModel?: 'matched' | 'separated' | 'unavailable'
  }
  verdict: IdentityVerdictStatus
  testedClaims: readonly string[]
  evidence: readonly string[]
  composite?: { score: number; components: Record<string, number> }
  redactedSamples: readonly ProbeSample[]
}

const SECRET_HEADER =
  /^(authorization|proxy-authorization|x-api-key|api-key|cookie|set-cookie)$/i
const SECRET_VALUE = /\b(sk|pk|api|key)[-_][A-Za-z0-9_-]{8,}\b/gi

/** Header names whose values must never be recorded. */
export function redactHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (headers === undefined) return undefined
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(headers)) {
    out[name] = SECRET_HEADER.test(name) ? '[redacted]' : value
  }
  return out
}

/** Removes anything that looks like key material from a free-text value. */
export function redactValue(value: string): string {
  return value.replace(SECRET_VALUE, '[redacted]')
}

export function redactSample(sample: ProbeSample): ProbeSample {
  return {
    ...sample,
    text: redactValue(sample.text),
    headers: redactHeaders(sample.headers),
    failure: sample.failure
      ? { ...sample.failure, message: redactValue(sample.failure.message) }
      : undefined,
  }
}

/** Whitespace/punctuation-insensitive form, so formatting is not a signal. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** FNV-1a. Deterministic, dependency-free, enough for text comparison. */
export function stableTextHash(text: string): string {
  let hash = 0x811c9dc5
  for (const char of normalizeText(text)) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Vector A's overhead rule. A served model's own tokenizer reports roughly the
 * prompt's token count, so a very different count is worth reporting — but a
 * chat template, tool preamble, proxy billing layer or CJK-heavy prompt
 * legitimately shifts it, so the band is wide and a breach is reported as
 * inconsistent evidence, never as proof of substitution.
 */
export function tokenizerOverhead(
  inputTokens: number,
  localEstimate: number,
): { ratio: number; withinBand: boolean } | null {
  if (localEstimate <= 0 || !Number.isFinite(inputTokens)) return null
  const ratio = inputTokens / localEstimate
  return { ratio, withinBand: ratio >= 0.5 && ratio <= 2.5 }
}
