/**
 * FID-2026-1013-013 W4-3 — the `answers` payload for an approval decision.
 *
 * `approval_response` has always accepted `answers: Array<Record<string,
 * unknown>>` (see `gateway-protocol.ts`), but the Desktop client hardcoded `[]`
 * in `use-gateway.ts`, so an operator had no way to attach a note or an answer
 * to an approval. An operator note now rides as a single `{ note }` entry; with
 * no note the payload stays the empty-answers shape the gateway has always
 * received, so existing behaviour is unchanged.
 *
 * Pure and dependency-free (split out of `../hooks/use-gateway` for the
 * 300-line ceiling, FID-2026-0913-002 convention) so the Desktop suite can pin
 * the mapping without a DOM: `components/chat/__tests__/approval-card.test.tsx`.
 */
export function approvalAnswerPayload(
  note?: string,
): Array<Record<string, unknown>> {
  const trimmed = note?.trim() ?? ''
  return trimmed === '' ? [] : [{ note: trimmed }]
}
