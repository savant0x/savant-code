import { lookupRetention } from '../evidence/retention-registry'

import type { RetentionRefusal } from '../evidence/spill'

/**
 * The omission marker and the one rule that governs it (FID-2026-1007-004 step 3).
 *
 * Ceiling split from `./simplify-tool-results`, not a new mechanism: the marker
 * shape and the proof lookup are what the destructive transforms share, and they
 * are also what the READER side (`evidence/omission.ts`) has to recognise. The
 * reader is duck-typed on purpose, so nothing here is imported by it and the
 * splice stays dependency-free.
 *
 * The rule: **a transform may discard model-facing bytes ONLY on the strength of
 * a retention handle the tool-result boundary proved it wrote.** No handle means
 * the payload is returned untouched, because a refusal is not a loss — a bigger
 * prompt is a cost, a silently dropped finding is a defect.
 */

/**
 * Where the bytes that were taken went — a verified handle, or the reason there
 * is none. A reader must never have to guess which of the two it is holding.
 */
export type OmissionRetention =
  | {
      ok: true
      file: string
      toolCallId: string
      sha256: string
      bytes: number
      redacted: boolean
    }
  | { ok: false; why: RetentionRefusal | 'no-retention-verdict' }

/** The one marker shape every destructive path leaves behind. */
export type OmissionMarker = {
  /** Which cap was hit — or that nothing was actually taken. */
  reason: string
  originalChars: number
  keptChars: number
  omittedChars: number
  preview: string
  retained: OmissionRetention
}

/**
 * The only thing that authorises a drop. Reads the boundary's verdict for this
 * tool call; an absent verdict is `no-retention-verdict`, which is NOT the same
 * as a refusal and is never read as "then drop it".
 */
export function retentionProof(
  toolCallId: string | undefined,
): OmissionRetention {
  const verdict = lookupRetention(toolCallId)
  if (!verdict || !verdict.retained) {
    return { ok: false, why: verdict ? verdict.reason : 'no-retention-verdict' }
  }
  return { ok: true, ...verdict.handle }
}

/**
 * "Nothing was taken" — the honest reason for a marker that accompanies a
 * payload which is still whole. The old marker reported a byte-cap truncation
 * alongside `omittedChars: 0` (measured: a 60,026-char object returned 60,727
 * chars with `reason: 'output exceeded 50000 bytes'`), which is a marker that
 * contradicts itself.
 */
const NOTHING_OMITTED_REASON =
  'nothing omitted: the payload keeps all of its own fields'

export function buildOmissionMarker(params: {
  limitReason: string
  originalChars: number
  keptChars: number
  preview: string
  retained: OmissionRetention
}): OmissionMarker {
  const omittedChars = Math.max(0, params.originalChars - params.keptChars)
  return {
    reason: omittedChars > 0 ? params.limitReason : NOTHING_OMITTED_REASON,
    originalChars: params.originalChars,
    keptChars: params.keptChars,
    omittedChars,
    preview: params.preview,
    retained: params.retained,
  }
}
