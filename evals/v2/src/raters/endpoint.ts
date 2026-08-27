// Operator-configured out-of-process autorater endpoint contract
// (FID-2026-0824-017 Loop 3).
//
// The bounded autorater adapter (./autorater.ts) accepts an injectable
// out-of-process transport; this module resolves that transport's endpoint
// exclusively from operator environment variables. Nothing here is referenced
// by the Tier-1 governance smoke (`--governance-smoke`): the smoke exercises
// deterministic stages only and constructs no HTTP transport, so Tier 1 stays
// zero-token and zero-network by construction.
//
// Contract (all variables optional; URL absence disables the adapter):
//   SAVANT_CODE_AUTORATER_URL          absolute http(s) endpoint that receives
//                                      forced-choice judge requests via POST
//   SAVANT_CODE_AUTORATER_KEY          bearer token sent as
//                                      `Authorization: Bearer …` — never echoed
//                                      into errors or logs
//   SAVANT_CODE_AUTORATER_TIMEOUT_MS   per-request timeout override (bounded)
//
// Failure posture is fail-closed: a variable that is present but invalid throws
// an error naming the variable — never its value, which may itself be
// credential-shaped.

import { runBoundedAutorater } from './autorater'

import type { AutoraterProcess, AutoraterRequest } from './autorater'
import type { GovernanceTask } from '../governance'
import type { GovernanceAutorater } from '../governance-pipeline'
import type { TraceDocument } from '../runner'

export const AUTORATER_URL_ENV_VAR = 'SAVANT_CODE_AUTORATER_URL'
export const AUTORATER_KEY_ENV_VAR = 'SAVANT_CODE_AUTORATER_KEY'
export const AUTORATER_TIMEOUT_ENV_VAR = 'SAVANT_CODE_AUTORATER_TIMEOUT_MS'

const DEFAULT_ENDPOINT_TIMEOUT_MS = 30_000
const MIN_ENDPOINT_TIMEOUT_MS = 500
const MAX_ENDPOINT_TIMEOUT_MS = 120_000

export type AutoraterEndpointConfig = {
  url: URL
  apiKey?: string
  timeoutMs: number
}

export type ResolvedAutoraterEndpoint =
  { configured: false } | { configured: true; config: AutoraterEndpointConfig }

type EnvSource = Record<string, string | undefined>

/**
 * Minimal structural fetch seam. Deliberately narrower than `typeof fetch`:
 * Bun augments the global fetch with extra members (e.g. `preconnect`), and
 * call sites must be able to inject plain test doubles without reproducing
 * runtime-specific surface area.
 */
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

function invalid(varName: string, expectation: string): Error {
  return new Error(`${varName} is set but invalid: expected ${expectation}`)
}

function parseTimeout(raw: string): number {
  const value = Number(raw)
  if (
    raw === '' ||
    !Number.isSafeInteger(value) ||
    value < MIN_ENDPOINT_TIMEOUT_MS ||
    value > MAX_ENDPOINT_TIMEOUT_MS
  ) {
    throw invalid(
      AUTORATER_TIMEOUT_ENV_VAR,
      `an integer between ${MIN_ENDPOINT_TIMEOUT_MS} and ${MAX_ENDPOINT_TIMEOUT_MS}`,
    )
  }
  return value
}

function parseUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw invalid(AUTORATER_URL_ENV_VAR, 'an absolute http(s) URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw invalid(AUTORATER_URL_ENV_VAR, 'an absolute http(s) URL')
  }
  // Credentials belong in SAVANT_CODE_AUTORATER_KEY, never in the URL itself.
  if (url.username !== '' || url.password !== '') {
    throw invalid(
      AUTORATER_URL_ENV_VAR,
      'an http(s) URL without embedded credentials',
    )
  }
  return url
}

/**
 * Resolves the autorater endpoint from an environment source (defaults to
 * `process.env`). Returns `{ configured: false }` when the URL variable is
 * absent or blank — the adapter is disabled, not broken. Any present-but-
 * invalid variable fails closed with an error naming the variable only.
 */
export function resolveAutoraterEndpoint(
  env: EnvSource = process.env,
): ResolvedAutoraterEndpoint {
  const rawUrl = env[AUTORATER_URL_ENV_VAR]?.trim()
  if (!rawUrl) return { configured: false }

  const rawKey = env[AUTORATER_KEY_ENV_VAR]?.trim()
  const rawTimeout = env[AUTORATER_TIMEOUT_ENV_VAR]?.trim()
  return {
    configured: true,
    config: {
      url: parseUrl(rawUrl),
      ...(rawKey ? { apiKey: rawKey } : {}),
      timeoutMs: rawTimeout
        ? parseTimeout(rawTimeout)
        : DEFAULT_ENDPOINT_TIMEOUT_MS,
    },
  }
}

/**
 * Builds the out-of-process transport for a resolved endpoint: one HTTP(S)
 * POST carrying the origin-masked forced-choice request. Masking is applied
 * by `runBoundedAutorater` before the transport ever sees the payload, so the
 * endpoint never learns the project, FID, or filesystem origins of the text
 * it judges. The response body is returned raw; categorical A/B parsing stays
 * the bounded autorater's concern.
 *
 * `fetchImpl` is injectable for tests; production uses the platform fetch.
 */
export function httpAutoraterProcess(
  config: AutoraterEndpointConfig,
  fetchImpl: FetchLike = fetch,
): AutoraterProcess {
  return async (request: AutoraterRequest) => {
    const response = await fetchImpl(config.url, {
      method: 'POST',
      // Hardening: never follow redirects — a redirected endpoint would relay
      // the Authorization header cross-origin (Verifier finding, Loop 3).
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        rubric: request.rubric,
        candidateA: request.candidateA,
        candidateB: request.candidateB,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    })
    if (!response.ok) {
      throw new Error(`autorater endpoint returned HTTP ${response.status}`)
    }
    return response.text()
  }
}

export type EndpointCandidateSelector = (
  task: GovernanceTask,
  trace: TraceDocument,
) => Pick<AutoraterRequest, 'rubric' | 'candidateA' | 'candidateB'>

/**
 * Composes a resolved endpoint into the governance pipeline's injectable
 * `GovernanceAutorater` seam. Candidate extraction is deliberately injected:
 * what counts as candidate A vs B (and under which rubric) is task-specific
 * and owned by the calling eval mode — never by this module. Choice `A` is
 * the passing answer by convention, matching the always-pass development
 * default in governance-pipeline.
 */
export function makeEndpointGovernanceAutorater(
  config: AutoraterEndpointConfig,
  select: EndpointCandidateSelector,
  fetchImpl: FetchLike = fetch,
): GovernanceAutorater {
  return async (task, trace) => {
    const selected = select(task, trace)
    const response = await runBoundedAutorater(
      { ...selected, timeoutMs: config.timeoutMs },
      httpAutoraterProcess(config, fetchImpl),
      config.timeoutMs,
    )
    return {
      passed: response.choice === 'A',
      choice: response.choice,
      ...(response.rationale ? { rationale: response.rationale } : {}),
    }
  }
}
