/**
 * @module echo/fid-verification-fingerprint
 *
 * FID-2026-0918-006 ceiling split: `computeFidFingerprint` moved verbatim
 * from fid-verification-gates.ts (FID-2026-0913-002 split discipline;
 * re-exported from the gates module so every importer is unchanged).
 */

import { createHash } from 'node:crypto'

import {
  receiptSpan,
  withoutFencedBlocks,
} from './fid-verification-gates-locators'

/**
 * Compute the receipt fingerprint: sha256 of the FID content with the whole
 * receipt section (heading + body) removed. `fid:verify --write` computes
 * this over the content BEFORE inserting the receipt, and the validator
 * recomputes it over the same heading-stripped content — so any edit to
 * the document outside the receipt invalidates the fingerprint (freshness).
 */
export function computeFidFingerprint(content: string): string {
  // Same fence-stripped view as receiptBlock; the removal consumes the exact
  // receipt span (anchored heading + body), so the hashed view is
  // byte-identical to the pre-stamp document fid:verify hashed — for both
  // the first stamp (insert) and re-stamp (replacement) paths
  // (FID-2026-0907-010).
  const stripped = withoutFencedBlocks(content)
  const span = receiptSpan(stripped)
  // FID-2026-0916-003: the hashed view is tail-normalized to exactly one
  // trailing newline. stampReceipt's EOF branches rewrite the document tail
  // (trimEnd + separator reinsertion), so the receipt-span-removed view of a
  // stamped doc ends in '\n\n' where the pre-stamp view ends in '\n' — a
  // sha256 mismatch that made every EOF-stamped receipt validate as stale.
  // The stamp operation itself destroys the exact tail shape and cannot
  // restore it, so the newline COUNT at EOF is excluded from the identity;
  // content edits (including the final line's text) still invalidate.
  const normalizeTail = (view: string): string => view.replace(/\n+$/, '\n')
  if (!span) {
    return createHash('sha256')
      .update(normalizeTail(stripped), 'utf8')
      .digest('hex')
  }
  const withoutReceipt =
    stripped.slice(0, span.start) + stripped.slice(span.start + span.length)
  return createHash('sha256')
    .update(normalizeTail(withoutReceipt), 'utf8')
    .digest('hex')
}
