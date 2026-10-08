/**
 * FID-2026-1007-008 — the gauntlet's transport. The only place in the program
 * that makes a request, split out of `identity-gauntlet.ts` so the CLI stays a
 * thin wrapper and neither file approaches the 300-line ceiling.
 *
 * An HTTP 4xx/5xx body is an error envelope, not an answer. Recording it as a
 * completed sample with empty text once let two failed endpoints "agree" and
 * read as controls `matched` on a live run (2026-10-07), so the status is
 * recorded as the failure class instead. A 200 that carries no choices is the
 * same kind of non-answer.
 */
import type { ProbeInvoker } from './identity-core'

const TIMEOUT_MS = 30_000

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
