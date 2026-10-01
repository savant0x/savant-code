import {
  assembleUsage,
  countsMismatch,
  creditsDisagree,
  type EndpointDoc,
  type EnvelopeData,
  type FnUsage,
  type Json,
  pruneZeroCredits,
  type RunCompleted,
  type RunInput,
  RunKind,
  type RunTiming,
  zeroUsage,
} from '@shared/core'

import { EngineError, EngineErrorCode } from './errors.ts'
import { validateAgainst } from './validate.ts'

import type { LinkedFns } from './link.ts'
import type { Logger } from '../shared/logging.ts'

/**
 * THE settle pipeline — extracted verbatim from the pre-T106 engine
 * monolith (file-split for the 300-line ceiling, zero behavior change):
 * usage.consolidate on the RAW envelope (billing truth anchors to the
 * wire) → output.fromResponse → final output.schema. Vendor error
 * (non-2xx httpStatus) ⇒ zero usage FORCED; no hook runs, so a fn can
 * never bill an error.
 */
export function settle(
  doc: EndpointDoc,
  fns: LinkedFns,
  logger: Logger,
  input: RunInput,
  httpStatus: number,
  raw: Json,
  providerHttpStatus: number | undefined,
  timing: RunTiming,
): RunCompleted {
  const isProviderError = !(httpStatus >= 200 && httpStatus < 300)
  let usage = zeroUsage()
  let output = raw
  if (isProviderError && fns.fromError) {
    // presentation-only error projection — runs AFTER zero-usage
    // forcing (a projection can never touch a bill); output.schema
    // never applies to error shapes
    output = fns.fromError({
      input,
      output: raw,
      usage: { model: doc.usage.model },
    })
  }
  if (!isProviderError) {
    const envelope: EnvelopeData = {
      input,
      output: raw,
      // the doc's OWN model rides along (at its provenance path
      // data.usage.model) so a GENERIC provider consolidate can
      // key its counts (design D19)
      usage: { model: doc.usage.model },
    }
    // QUANTITIES first (usage.evidence — metered line keys only),
    // then the D26 assembly: folded through the doc's own rate
    // card → {credits, evidence}. Error settles keep zeroUsage() —
    // nothing billed, nothing evidenced.
    const settled = fns.usageEvidence(envelope)
    validateUsage(doc, settled)
    usage = assembleUsage(doc.usage.model, settled.counts)
    // THE VENDOR'S OWN METER (usage.consolidate — design D27):
    // a non-empty claim WINS (source of truth; zero entries mean
    // "nothing consumed" and are pruned — an all-empty claim
    // falls back to our derived fold). On disagreement the fold
    // rides out as usage.mismatch.derived — said, never hidden,
    // never failing the run. The claim's pool ids must be
    // DECLARED credit systems (fail-closed: a nonzero claim on a
    // FREE doc trips this loudly).
    if (fns.usageConsolidate) {
      const consolidated = fns.usageConsolidate(envelope)
      const claim = pruneZeroCredits(consolidated.credits)
      for (const pool of Object.keys(claim)) {
        if (!(pool in doc.usage.credits)) {
          throw new EngineError(
            EngineErrorCode.FN_CONTRACT,
            `${doc.id}: consolidate claimed undeclared ` +
              `credit pool "${pool}" (declared: ` +
              `${Object.keys(doc.usage.credits).join(', ') || 'none'})`,
          )
        }
      }
      if (Object.keys(claim).length > 0) {
        const derived = usage.credits
        usage = {
          credits: claim,
          evidence: usage.evidence,
          ...(creditsDisagree(claim, derived)
            ? { mismatch: { derived } }
            : {}),
        }
        if (usage.mismatch) {
          logger.warn('usage mismatch', {
            endpoint: doc.id,
            reported: claim,
            derived,
          })
        }
      }
      output = consolidated.output ?? raw
    } else {
      output = raw
    }
    if (fns.fromResponse) {
      output = fns.fromResponse({
        input,
        output,
        usage: { model: doc.usage.model },
      })
    }
    if (doc.output.schema) {
      const check = validateAgainst(doc.output.schema, output)
      if (!check.ok) {
        throw new EngineError(
          EngineErrorCode.CONTRACT_VIOLATION,
          `${doc.id}: output ${check.message}`,
        )
      }
    }
  }
  // flat, kind-discriminated (no nested result to unwrap)
  return {
    kind: RunKind.COMPLETED,
    httpStatus,
    ...(providerHttpStatus !== undefined && providerHttpStatus !== httpStatus
      ? { providerHttpStatus }
      : {}),
    output,
    usage,
    isProviderError,
    timing,
  }
}

/** Counts ↔ model discipline (design D19), fail-closed (FN_CONTRACT —
 *  a doc fn wrote the counts; the type + loader gates already forced
 *  correct authorship, so this is the LIVE-DATA residue). Applied to
 *  consolidate output at settle AND to the estimate fn's return —
 *  `{counts: {}}` passes everywhere. */
function validateUsage(doc: EndpointDoc, usage: FnUsage): void {
  const problem = countsMismatch(doc.usage.model, usage.counts)
  if (problem !== undefined) {
    throw new EngineError(
      EngineErrorCode.FN_CONTRACT,
      `${doc.id}: ${problem}`,
    )
  }
}
