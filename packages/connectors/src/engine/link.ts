
import { EngineError, EngineErrorCode } from './errors.ts'
import { fnUtils } from './fn-utils.ts'
import { resolveFn } from './resolve.ts'
import {
  type AuthData,
  AuthInjectContract,
  type AuthInjectFn,
  type Consolidated,
  type EndpointDoc,
  type EnvelopeData,
  type EstimateData,
  type FnEntry,
  type FnUsage,
  type HookLogger,
  type HttpRequestParts,
  InputToRequestContract,
  type InputToRequestFn,
  type Json,
  OutputFromErrorContract,
  type OutputFromErrorFn,
  OutputFromResponseContract,
  type OutputFromResponseFn,
  type RunInput,
  type ToRequestData,
  UsageConsolidateContract,
  type UsageConsolidateFn,
  UsageEstimateContract,
  type UsageEstimateFn,
  UsageEvidenceContract,
  type UsageEvidenceFn,
} from '../core/mod.ts'

/**
 * Linked hook fns — each wrapped with its hook's contract
 * (`Contract.implement()`), so the ctx argument AND the return are
 * zod-validated on EVERY call (the same z.function factories that type the
 * defs — drift impossible). Violations and throws → FN_CONTRACT, fail-closed.
 * `utils` is injected by the wrapper; callers pass data only.
 *
 * link.ts lives in the ENGINE deliberately: every gate here (UNKNOWN_FN,
 * LINK_INTEGRITY, UNSUPPORTED_FN_ABI, FN_CONTRACT) is an engine load-time
 * guarantee tied to ENGINE_VERSION, and instantiation calls `new Function` —
 * an execution capability the contract package must never have.
 */
export interface LinkedFns {
  authInject: (data: AuthData) => HttpRequestParts
  toRequest?: (data: ToRequestData) => RunInput
  fromResponse?: (data: EnvelopeData) => Json
  /** Provider-error projection — runs only on error envelopes. */
  fromError?: (data: EnvelopeData) => Json
  /** Post-run quantities settle: raw envelope → {counts} (D27 —
   *  estimate's settle-side twin; the engine folds to credits). */
  usageEvidence: (data: EnvelopeData) => FnUsage
  /** The vendor-meter fn: raw envelope → {credits, output?} — the
   *  vendor's own claim + its removal from the payload (D27). */
  usageConsolidate?: (data: EnvelopeData) => Consolidated
  /** Pre-run estimate: validated input → the QUANTITY promise per
   *  metered line (pure, no IO) — the engine folds to credits (D26). */
  usageEstimate?: (data: EstimateData) => FnUsage
}

// T106 file split: `instantiate` + `resolveFn` live in resolve.ts (verbatim
// move for the 300-line ceiling); linkFns consumes them below.

/** Contract shape shared by the z.function factories we wrap. */
interface ContractLike<F> {
  implement(fn: F): F
}

/**
 * Wrap a raw linked fn with its hook contract: `Contract.implement` validates
 * the ctx argument and the return per call (ZodError); any violation or
 * throw becomes FN_CONTRACT. `utils` and `logger` are injected by the
 * wrapper; callers pass data only.
 */
function wrapContract<
  D,
  R,
  F extends (ctx: { data: D; utils: typeof fnUtils; logger: HookLogger }) => R,
>(
  contract: ContractLike<F>,
  raw: unknown,
  label: string,
  hookName: string,
  logger: HookLogger,
): (data: D) => R {
  const impl = contract.implement(raw as F)
  return (data: D): R => {
    try {
      return impl({ data, utils: fnUtils, logger } as Parameters<F>[0])
    } catch (error) {
      throw new EngineError(
        EngineErrorCode.FN_CONTRACT,
        `${label}: ${hookName} broke its contract: ${error}`,
        { cause: error },
      )
    }
  }
}

const NOOP_HOOK_LOGGER: HookLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
}

export async function linkFns(
  doc: EndpointDoc,
  fns: Record<string, FnEntry>,
  engineVersion: string,
  hookLogger: HookLogger = NOOP_HOOK_LOGGER,
): Promise<LinkedFns> {
  const logger = hookLogger

  // T106 strip: the engine runs SYNC endpoints only (the launch catalog's
  // posture). An async-lifecycle or resource-bound doc cannot execute here —
  // fail closed at LOAD with the dedicated code instead of failing open
  // mid-run (poll would throw NOT_ASYNC after start already billed a
  // durable job).
  if (doc.lifecycle !== undefined || doc.resources !== undefined) {
    throw new EngineError(
      EngineErrorCode.ASYNC_UNSUPPORTED,
      `${doc.id}: async lifecycle / resource endpoints are stripped in this ` +
        `engine build (sync-only); the doc needs a host with the async surface`,
    )
  }

  const linked: LinkedFns = {
    authInject: wrapContract<AuthData, HttpRequestParts, AuthInjectFn>(
      AuthInjectContract,
      await resolveFn(
        doc.auth.inject,
        fns,
        engineVersion,
        `${doc.id}#auth.inject`,
      ),
      doc.id,
      'auth.inject',
      logger,
    ),
    usageEvidence: wrapContract<EnvelopeData, FnUsage, UsageEvidenceFn>(
      UsageEvidenceContract,
      await resolveFn(
        doc.usage.evidence,
        fns,
        engineVersion,
        `${doc.id}#usage.evidence`,
      ),
      doc.id,
      'usage.evidence',
      logger,
    ),
  }
  if (doc.usage.consolidate) {
    linked.usageConsolidate = wrapContract<
      EnvelopeData,
      Consolidated,
      UsageConsolidateFn
    >(
      UsageConsolidateContract,
      await resolveFn(
        doc.usage.consolidate,
        fns,
        engineVersion,
        `${doc.id}#usage.consolidate`,
      ),
      doc.id,
      'usage.consolidate',
      logger,
    )
  }
  if (doc.usage.estimate) {
    linked.usageEstimate = wrapContract<EstimateData, FnUsage, UsageEstimateFn>(
      UsageEstimateContract,
      await resolveFn(
        doc.usage.estimate,
        fns,
        engineVersion,
        `${doc.id}#usage.estimate`,
      ),
      doc.id,
      'usage.estimate',
      logger,
    )
  }
  if (doc.input.toRequest) {
    linked.toRequest = wrapContract<ToRequestData, RunInput, InputToRequestFn>(
      InputToRequestContract,
      await resolveFn(
        doc.input.toRequest,
        fns,
        engineVersion,
        `${doc.id}#input.toRequest`,
      ),
      doc.id,
      'input.toRequest',
      logger,
    )
  }
  if (doc.output.fromResponse) {
    linked.fromResponse = wrapContract<
      EnvelopeData,
      Json,
      OutputFromResponseFn
    >(
      OutputFromResponseContract,
      await resolveFn(
        doc.output.fromResponse,
        fns,
        engineVersion,
        `${doc.id}#output.fromResponse`,
      ),
      doc.id,
      'output.fromResponse',
      logger,
    )
  }
  if (doc.output.fromError) {
    linked.fromError = wrapContract<EnvelopeData, Json, OutputFromErrorFn>(
      OutputFromErrorContract,
      await resolveFn(
        doc.output.fromError,
        fns,
        engineVersion,
        `${doc.id}#output.fromError`,
      ),
      doc.id,
      'output.fromError',
      logger,
    )
  }
  return linked
}
