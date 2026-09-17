/**
 * FID-2026-0916-006 — compaction-contamination guards, extracted from
 * structured-summary.ts under the 300-line ceiling (FID-2026-0913-002 split
 * discipline; zero behavior change). All three guards are embedded into the
 * generated pruner scope via .toString() (handle-steps.ts) — pure functions,
 * regexes inside function bodies.
 */

/**
 * FID-2026-0916-006 RC2: strip harness framing from transcribed user-turn
 * text BEFORE dedupe/pin/transcription. Removes <system>…</system> blocks
 * (interrupt notices, allowance notices, protocol dumps), <compaction-notice>
 * blocks, <user_message>/<previous_assistant_message> wrappers, and <think>
 * blocks. Operator prose survives; harness framing never does.
 * Embeddable-safe: regexes live inside the function body.
 */
export function stripHarnessFraming(text: string): string {
  return text
    .replace(/<system>[\s\S]*?<\/system>/g, '')
    .replace(/<compaction-notice[^>]*>[\s\S]*?<\/compaction-notice>/g, '')
    .replace(/<compaction-notice[^>]*>[\s\S]*/g, '')
    .replace(/<user_message>([\s\S]*?)<\/user_message>/g, '$1')
    .replace(
      /<previous_assistant_message>[\s\S]*?<\/previous_assistant_message>/g,
      '',
    )
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<!--echo-critical-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * FID-2026-0916-006 RC4a: a candidate text carries no decision substance.
 * Fragments like '.', 'hosts', 'ok' (interrupted assistant turns) fail the
 * sentence-substance test: real decisions are sentence-like — at least two
 * words and at least one word of ≥4 letters. Wordlist-free.
 * Embeddable-safe: regexes live inside the function body.
 */
export function hasDecisionSubstance(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length < 3) return false
  const words = trimmed.split(/[^a-zA-Z]+/).filter((w) => w.length > 0)
  if (words.length < 2) return false
  return words.some((w) => w.length >= 4)
}

/**
 * FID-2026-0916-006 RC4b: a user turn that is pure greeting/interrupt spam
 * ('hey', 'resume', 'ok'…) carries no goal substance.
 * Embeddable-safe: regex lives inside the function body.
 */
export function isGreetingSpam(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false
  return /^(?:hey+|hello+|hi+|yo+|resume|continue|ok(?:ay)?|deepseek)[!.,\s]*$/i.test(
    trimmed,
  )
}
