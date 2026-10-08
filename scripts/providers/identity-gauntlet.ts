#!/usr/bin/env bun
/**
 * FID-2026-1007-008 — the operator-run identity gauntlet.
 *
 * `bun run providers:identity -- --provider hcnsec --model kimi-k3 [--json]`
 *
 * Operator-initiated only. It is never scheduled, never runs at startup, and
 * never runs as part of a user's turn: the passive half of this program lives
 * in `packages/agent-runtime/src/provider-boundary/identity-observation.ts` and
 * makes no request at all. Every rule — budget, redaction, controls, verdict,
 * composite calibration — lives in `lib/identity-core.ts` and
 * `lib/identity-runner.ts` and is pinned offline; this file is only the
 * transport and the argument parsing around them.
 *
 * The operator's key is read from `<SLUG>_API_KEY` or `IDENTITY_API_KEY` at
 * invocation, used in request headers only, and never written to disk. It is
 * checked BEFORE any request is attempted, so a missing key is a clear refusal
 * rather than a burst of 401 probe traffic.
 *
 * Costs the operator's own quota. Results are advisory: a mismatch forces human
 * review and a separate FID, never an automatic routing change.
 */
import { IDENTITY_VECTORS } from './lib/identity-core'
import { runIdentityGauntlet } from './lib/identity-runner'

import type {
  ProbeInvoker,
  ProbeManifest,
  ProbeSpec,
  IdentityVector,
} from './lib/identity-core'

const TIMEOUT_MS = 30_000
const MANIFEST_VERSION = 'identity-manifest/1'

/** Probe bodies, one per vector. Benign, versioned, and never a hidden prompt. */
const PROBE_TEXTS: Record<IdentityVector, { claim: string; prompt: string }> = {
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

export interface CliArgs {
  provider: string
  model: string
  baseUrl: string
  json: boolean
  controlModel?: string
  controlProvider?: string
  controlBaseUrl?: string
  differentProvider?: string
  differentModel?: string
  differentBaseUrl?: string
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const read = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`)
    return index >= 0 ? argv[index + 1] : undefined
  }
  const provider = read('provider')
  const model = read('model')
  const baseUrl = read('base-url')
  if (provider === undefined || model === undefined || baseUrl === undefined) {
    // The target must be explicit: a guessed endpoint would spend the
    // operator's quota probing a host nobody named, and every probe would come
    // back `inconclusive` for a reason that is not about the provider.
    throw new Error(
      'usage: --provider <slug> --model <id> --base-url <url> [--json]',
    )
  }
  return {
    provider,
    model,
    baseUrl,
    json: argv.includes('--json'),
    controlProvider: read('control-provider'),
    controlModel: read('control-model'),
    controlBaseUrl: read('control-base-url'),
    differentProvider: read('different-provider'),
    differentModel: read('different-model'),
    differentBaseUrl: read('different-base-url'),
  }
}

/**
 * Resolves the key without touching the network. Throws a named refusal so the
 * caller never spends quota discovering that nothing was configured.
 */
export function resolveKey(
  provider: string,
  env: Record<string, string | undefined>,
): string {
  const slug = provider.toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const key = env[`${slug}_API_KEY`] ?? env['IDENTITY_API_KEY']
  if (key === undefined || key.length === 0) {
    throw new Error(
      `no credential for ${provider}: set ${slug}_API_KEY or IDENTITY_API_KEY (nothing was sent)`,
    )
  }
  return key
}

export function buildManifest(
  args: CliArgs,
  budget = { maxAttempts: 25, maxTotalTokens: 40_000, maxWallMs: 300_000 },
): ProbeManifest {
  const probes: ProbeSpec[] = IDENTITY_VECTORS.map((vector) => ({
    id: `probe-${vector}`,
    vector,
    ...PROBE_TEXTS[vector],
  }))
  const controls: ProbeManifest['controls'] = {}
  if (args.controlProvider !== undefined && args.controlModel !== undefined) {
    controls.sameModel = {
      provider: args.controlProvider,
      requestedModel: args.controlModel,
      baseUrl: args.controlBaseUrl ?? args.baseUrl,
    }
  }
  if (
    args.differentProvider !== undefined &&
    args.differentModel !== undefined
  ) {
    controls.differentModel = {
      provider: args.differentProvider,
      requestedModel: args.differentModel,
      baseUrl: args.differentBaseUrl ?? args.baseUrl,
    }
  }
  return {
    version: MANIFEST_VERSION,
    target: {
      provider: args.provider,
      requestedModel: args.model,
      baseUrl: args.baseUrl,
    },
    budget,
    probes,
    controls,
  }
}

/** The only place in this program that makes a request. */
export function createInvoker(keys: Map<string, string>): ProbeInvoker {
  return async (target, spec) => {
    const startedAt = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(`${target.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${keys.get(target.provider) ?? ''}`,
        },
        body: JSON.stringify({
          model: target.requestedModel,
          messages: [{ role: 'user', content: spec.prompt }],
        }),
        signal: controller.signal,
      })
      // A 4xx/5xx body is an error envelope, not an answer. Recording it as a
      // completed sample with empty text lets two failed endpoints "agree" and
      // read as controls `matched`; the status is the failure class here.
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        return {
          probeId: spec.id,
          text: '',
          latencyMs: Date.now() - startedAt,
          failure: {
            class: `http-${response.status}`,
            message: detail.slice(0, 500),
          },
        }
      }
      const body: unknown = await response.json()
      const parsed =
        typeof body === 'object' && body !== null
          ? (body as Record<string, unknown>)
          : {}
      const choices = Array.isArray(parsed['choices']) ? parsed['choices'] : []
      // A 200 that carries no assistant message (some proxies wrap errors in a
      // 200 envelope) is still not an answer, so it is a failure, not a sample.
      if (choices.length === 0) {
        return {
          probeId: spec.id,
          text: '',
          servedModel:
            typeof parsed['model'] === 'string' ? parsed['model'] : undefined,
          latencyMs: Date.now() - startedAt,
          failure: {
            class: 'no-content',
            message: 'response carried no choices',
          },
        }
      }
      const first = choices[0] as Record<string, unknown> | undefined
      const message = first?.['message'] as Record<string, unknown> | undefined
      const usage = parsed['usage'] as Record<string, unknown> | undefined
      return {
        probeId: spec.id,
        text:
          typeof message?.['content'] === 'string' ? message['content'] : '',
        servedModel:
          typeof parsed['model'] === 'string' ? parsed['model'] : undefined,
        usage: {
          inputTokens:
            typeof usage?.['prompt_tokens'] === 'number'
              ? usage['prompt_tokens']
              : undefined,
          outputTokens:
            typeof usage?.['completion_tokens'] === 'number'
              ? usage['completion_tokens']
              : undefined,
        },
        latencyMs: Date.now() - startedAt,
        headers: { 'x-request-id': response.headers.get('x-request-id') ?? '' },
      }
    } finally {
      clearTimeout(timer)
    }
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv)
  const env = process.env
  const keys = new Map<string, string>([
    [args.provider, resolveKey(args.provider, env)],
  ])
  if (args.controlProvider !== undefined) {
    keys.set(args.controlProvider, resolveKey(args.controlProvider, env))
  }
  if (args.differentProvider !== undefined) {
    keys.set(args.differentProvider, resolveKey(args.differentProvider, env))
  }
  const report = await runIdentityGauntlet({
    manifest: buildManifest(args),
    invoke: createInvoker(keys),
  })
  console.log(
    args.json
      ? JSON.stringify(report, null, 2)
      : [
          `verdict: ${report.verdict}`,
          `attempts ${report.attemptsUsed}, tokens ${report.tokensUsed}, ${report.wallMs}ms`,
          ...report.evidence.map((line) => `  ${line}`),
          ...report.vectors.map(
            (vector) =>
              `  vector ${vector.vector}: ${vector.status} (${vector.completed}/${vector.probes})`,
          ),
          'advisory only — no routing change is made by this tool',
        ].join('\n'),
  )
  return 0
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error))
    process.exitCode = 1
  }
}
