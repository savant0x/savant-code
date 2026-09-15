/**
 * FID-2026-0914-002 — LLM semantic summary upgrade for the context-pruner.
 *
 * The context-pruner agent is a deterministic, model-less transcriber (its
 * source is embedded via .toString() and re-eval'd — it CANNOT call a
 * model). The deterministic writer stays as the guardrail + input
 * material, but its prose is upgraded here, at the spawn boundary, where
 * the parent's model access (`promptAiSdk: PromptAiSdkFn`, executor
 * contract agent-runtime.ts) exists.
 *
 * Failure contract (FID Loop 4): any writer failure — throw, refusal,
 * off-band output — degrades to the deterministic excerpt VERBATIM
 * (degraded mode is still strictly better than the pre-fix transcriber).
 * User aborts propagate (never swallowed, common/util/error contract).
 */
import {
  buildSemanticSummaryPrompt,
  estimateSummaryTokens,
  SEMANTIC_SUMMARY_MAX_TOKENS,
  SEMANTIC_SUMMARY_MIN_TOKENS,
} from './semantic-summary-prompt'

import type { TrackEventFn } from '@savant-code/common/types/contracts/analytics'
import type { SendActionFn } from '@savant-code/common/types/contracts/client'
import type { PromptAiSdkFn } from '@savant-code/common/types/contracts/llm'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

export type SemanticSummaryProvenance =
  'semantic-llm' | 'deterministic-fallback'

export type SemanticSummaryUpgradeResult = {
  status: 'applied' | 'deterministic-fallback'
  provenance: SemanticSummaryProvenance
  excerpt: string
}

/** Secret-looking strings (API keys, bearer tokens) never enter memory. */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\bsk-or-v1-[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi,
]

export function redactSecrets(text: string): string {
  let redacted = text
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]')
  }
  return redacted
}

/** Tool-call syntax that must never appear in stored memory. */
const TOOL_CALL_LEAK_PATTERNS: RegExp[] = [
  /<tool_call>[\s\S]*?<\/tool_call>/i,
  /<\/?tool_call>/i,
  /"@?tool-call\b/i,
  /\btoolCalls\s*:\s*\[/,
]

export type SemanticSummaryValidation =
  { ok: true; text: string } | { ok: false; reason: string }

/**
 * Validate + sanitize the model's summary: token band (800-6000, MQ2),
 * tool-call leak strip (any leak rejects the output), credential
 * redaction. Deterministic — unit-pinned in the upgrade suite.
 */
export function validateSemanticSummary({
  text,
}: {
  text: string
}): SemanticSummaryValidation {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty summary' }
  }
  const tokens = estimateSummaryTokens(trimmed)
  if (tokens < SEMANTIC_SUMMARY_MIN_TOKENS) {
    return {
      ok: false,
      reason: `summary below the ${SEMANTIC_SUMMARY_MIN_TOKENS}-token band (${tokens})`,
    }
  }
  if (tokens > SEMANTIC_SUMMARY_MAX_TOKENS) {
    return {
      ok: false,
      reason: `summary above the ${SEMANTIC_SUMMARY_MAX_TOKENS}-token band (${tokens})`,
    }
  }
  for (const pattern of TOOL_CALL_LEAK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { ok: false, reason: 'tool-call syntax leaked into the summary' }
    }
  }
  return { ok: true, text: redactSecrets(trimmed) }
}

/**
 * Produce the compaction summary excerpt: the session model's semantic
 * handoff when it validates, else the deterministic excerpt verbatim.
 * Aborts propagate (PromptResult.aborted → throw); every other failure
 * degrades to the fallback (writer failure must never fail the
 * compaction itself).
 */
export async function applySemanticSummaryUpgrade({
  promptAiSdk,
  model,
  apiKey,
  runId,
  clientSessionId,
  fingerprintId,
  userInputId,
  userId,
  deterministicExcerpt,
  signal,
  logger,
  sendAction,
  trackEvent,
  maxRetries,
}: {
  promptAiSdk: PromptAiSdkFn
  /** The session model (operator ruling MQ1: main model only — no override). */
  model: string
  apiKey: string
  runId: string
  clientSessionId: string
  fingerprintId: string
  userInputId: string
  userId: string | undefined
  deterministicExcerpt: string
  signal: AbortSignal
  logger: Logger
  sendAction: SendActionFn
  trackEvent: TrackEventFn
  maxRetries?: number
}): Promise<SemanticSummaryUpgradeResult> {
  const fallback: SemanticSummaryUpgradeResult = {
    status: 'deterministic-fallback',
    provenance: 'deterministic-fallback',
    excerpt: deterministicExcerpt,
  }
  try {
    if (signal.aborted) {
      throw new Error('Semantic summary aborted before the model call')
    }
    const { system, user } = buildSemanticSummaryPrompt({
      deterministicSummary: deterministicExcerpt,
    })
    const messages: Message[] = [
      { role: 'system', content: [{ type: 'text', text: system }] },
      { role: 'user', content: [{ type: 'text', text: user }] },
    ]
    const result = await promptAiSdk({
      apiKey,
      runId,
      messages,
      clientSessionId,
      fingerprintId,
      userInputId,
      model: model as Parameters<PromptAiSdkFn>[0]['model'],
      userId,
      sendAction,
      logger,
      trackEvent,
      signal,
      maxRetries,
    })
    if (result.aborted) {
      // Aborts are user intent — propagate, never swallow.
      throw new Error('Semantic summary aborted by the user')
    }
    const validated = validateSemanticSummary({ text: result.value })
    if (!validated.ok) {
      logger.warn(
        { reason: validated.reason },
        'Semantic summary rejected — falling back to the deterministic writer',
      )
      return fallback
    }
    logger.debug(
      { tokens: estimateSummaryTokens(validated.text) },
      'Semantic summary applied',
    )
    return {
      status: 'applied',
      provenance: 'semantic-llm',
      excerpt: validated.text,
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('abort'))
    ) {
      throw error
    }
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Semantic summary writer failed — deterministic fallback',
    )
    return fallback
  }
}

// Re-exported for the unit suite's single import surface.
export {
  buildSemanticSummaryPrompt,
  estimateSummaryTokens,
  SEMANTIC_SUMMARY_MAX_TOKENS,
  SEMANTIC_SUMMARY_MIN_TOKENS,
}
