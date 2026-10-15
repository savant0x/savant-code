/**
 * P19 (operator: "the model name is missing" + "trimming the provider, only
 * include the model" + "remove the whole ':free'") — one shared display-label
 * formatter for model ids, used by the header badge and the deck's floor tag.
 *
 * Mirrors the CLI presence layer's `sanitizeModel` rules
 * (cli/src/state/presence/presence-privacy.ts) minus the Discord-separator
 * neutralization: display text may keep dots/dashes, but a model id's
 * provider prefix and OpenRouter tier markers never belong on screen.
 *
 * - Provider trimmed:  "nous/meituan/longcat-2.0:free" → "longcat-2.0"
 * - Tier markers stripped wherever they appear (lookahead keeps a real
 *   token like "foo:freeze" intact): ":free" ":beta" ":online" ":extended"
 * - The odd-ball router gets a human name: "openrouter/free" → "OpenRouter Free"
 */

/** OpenRouter tier markers are routing metadata, not part of the model name. */
const TIER_SUFFIX = /:(free|beta|online|extended)(?=$|:)/gi

export function formatModelLabel(model: string): string {
  if (model === 'openrouter/free') return 'OpenRouter Free'
  const lastSegment = model.split(/[/\\]/).filter(Boolean).pop() ?? model
  return lastSegment.replace(TIER_SUFFIX, '')
}
