import {
  assembleUsage,
  type EndpointDoc,
  type FnUsage,
  formatZodError,
  countsMismatch,
  type RunCompleted,
  type RunInput,
  type Usage,
  zSealedUnit,
} from '@shared/core'

import { EngineError, EngineErrorCode } from './errors.ts'
import { toHookLogger } from './fn-utils.ts'
import { type LinkedFns, linkFns } from './link.ts'
import { buildRequest, validateInput } from './request.ts'
import { settle } from './settle.ts'
import { sniffDecode } from './transport.ts'
import { ENGINE_VERSION as denoJsonVersion } from './version.ts' // port: was deno.json import (PORT-NOTES.md)
import { greaterThan, parse as parseSemver } from '../shared/semver.ts' // port: was @std/semver (PORT-NOTES.md)

import type {
  ConnectorEngine,
  EngineCtx,
  RunnableEndpoint,
} from './interfaces/mod.ts'
import type { Logger } from '../shared/logging.ts' // port: was @shared/logging (PORT-NOTES.md)

// T106 strip: the async/resource engine surface (loadResource, the
// start/poll/stop phase machine, the run() poll loop, the resource
// ownership gate, LoadedResource) was removed — the launch catalog is
// sync-only and an async doc now fails closed at LOAD with
// ASYNC_UNSUPPORTED (link.ts guard) instead of failing open mid-run.
// Recorded in PORT-NOTES.md.

/** The compatibility contract — the engine package version IS the version. */
export const ENGINE_VERSION: string = denoJsonVersion

/**
 * Default: silent. The engine stays standalone (no pino at import time —
 * `Logger` is a type-only seam); hosts that want logs (CLI, hosted workers)
 * pass a real logger through EngineCtx.logger.
 */
const NOOP_LOGGER: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child: () => NOOP_LOGGER,
}

export class Engine implements ConnectorEngine {
  private readonly logger: Logger

  constructor(private readonly ctx: EngineCtx) {
    this.logger = ctx.logger ?? NOOP_LOGGER
  }

  /**
   * Parse + gate + link a sealed unit {doc, fns}. All gates fail closed:
   * BAD_DOC → UNSUPPORTED_DOC → ASYNC_UNSUPPORTED → UNKNOWN_FN →
   * LINK_INTEGRITY → UNSUPPORTED_FN_ABI. Linked fns are wrapped in their
   * hook contracts (FN_CONTRACT).
   */
  async load(unitJson: unknown): Promise<LoadedEndpoint> {
    const parsed = zSealedUnit.safeParse(unitJson)
    if (!parsed.success) {
      throw new EngineError(
        EngineErrorCode.BAD_DOC,
        `sealed unit invalid: ${formatZodError(parsed.error)}`,
      )
    }
    const { doc, fns } = parsed.data
    if (
      greaterThan(
        parseSemver(doc.minEngineVersion),
        parseSemver(ENGINE_VERSION),
      )
    ) {
      throw new EngineError(
        EngineErrorCode.UNSUPPORTED_DOC,
        `${doc.id} needs engine ${doc.minEngineVersion}, this engine is ${ENGINE_VERSION}`,
      )
    }
    const hookLogger = toHookLogger(this.logger)
    const linked = await linkFns(doc, fns, ENGINE_VERSION, hookLogger)
    this.logger.debug('loaded endpoint', { id: doc.id })
    return new LoadedEndpoint(
      doc,
      fns[doc.auth.inject.$fn.key],
      linked,
      this.ctx,
      this.logger,
    )
  }
}

export class LoadedEndpoint implements RunnableEndpoint {
  constructor(
    readonly doc: EndpointDoc,
    private readonly injectEntry: Parameters<typeof buildRequest>[2],
    private readonly fns: LinkedFns,
    private readonly ctx: EngineCtx,
    private readonly logger: Logger,
  ) {}

  // ---- Temporal-activity-shaped: stateless, strict-JSON in/out ----

  /** Pre-run cost estimate: validated input → the QUANTITY promise per
   *  metered line — PURE, no IO, no state; compile-REQUIRED on every doc
   *  (the billing triple, D25; the absent-fn arm below is defense in
   *  depth only). The ENGINE folds through the doc's OWN rate card
   *  (design D26): the returned Usage is `{credits, evidence}` — the
   *  priced vector plus the per-line why, re-derivable by anyone
   *  holding the doc. */
  estimate(runInput: RunInput, elapsedMs?: number): Usage {
    // PRE-toRequest input (design D25): the estimate is a promise about
    // the CALLER's request, so it reads the schema-shaped validated
    // input (defaults materialized) — NOT the wire reshape.
    const input = validateInput(this.doc, runInput)
    const model = this.doc.usage.model
    let fnUsage: FnUsage = { counts: {} }
    if (this.fns.usageEstimate) {
      fnUsage = this.fns.usageEstimate({
        input,
        // design D40: absent at admission; set on cadenced re-runs
        ...(elapsedMs !== undefined ? { elapsedMs } : {}),
        usage: { model },
      })
      // the fn's promise: metered line quantities only
      this.validateUsage(fnUsage)
    }
    return assembleUsage(model, fnUsage.counts)
  }

  /** MID-RUN accrued cost (design D40) — the ESTIMATE, re-run with
   *  `elapsedMs` set. Docs without `usage.updateEstimateEveryMs` return
   *  the static estimate (a flat promise IS its own curve). */
  accrued(runInput: RunInput, elapsedMs: number): Usage {
    if (this.doc.usage.updateEstimateEveryMs === undefined) {
      return this.estimate(runInput)
    }
    return this.estimate(runInput, Math.max(0, elapsedMs))
  }

  /** The DECLARATIVE sync execution — one request, engine-executed:
   *  1. build request — auth travels UNEXECUTED (credentials stay out
   *     of the pipeline),
   *  2. transport: injection + egress inside the port →
   *     EXECUTION_FAILED (retriable),
   *  3. sniffing decode: JSON if it parses, else the faithful raw
   *     string — then THE settle pipeline (settle.ts, extracted
   *     verbatim for the ceiling split). */
  async start(runInput: RunInput): Promise<RunCompleted> {
    const input = this.deriveInput(runInput)
    const t0 = this.now()

    const request = buildRequest(this.doc, input, this.injectEntry)
    const response = await this.ctx.transport.execute(request)
    const completedAt = this.now()
    return settle(
      this.doc,
      this.fns,
      this.logger,
      input,
      response.status,
      sniffDecode(response),
      undefined,
      {
        startedAt: t0.toISOString(),
        completedAt: completedAt.toISOString(),
        attempts: 0,
        startRequestMs: Math.max(0, completedAt.getTime() - t0.getTime()),
        pollMsTotal: 0,
        providerTotalMs: Math.max(0, completedAt.getTime() - t0.getTime()),
      },
    )
  }

  /** Sugar for the sync surface: one declarative start, settled. (The
   *  upstream `run()` poll loop lived with the stripped async surface.) */
  async run(runInput: RunInput): Promise<RunCompleted> {
    return await this.start(runInput)
  }

  // ---- shared pipeline pieces ----

  /** validate the input trio (INVALID_INPUT) then input.toRequest. */
  private deriveInput(runInput: RunInput): RunInput {
    let input = validateInput(this.doc, runInput)
    if (this.fns.toRequest) input = this.fns.toRequest({ input })
    return input
  }

  /** The engine's clock — injectable via EngineCtx.now (testability). */
  private now(): Date {
    return (this.ctx.now ?? (() => new Date()))()
  }

  /** Counts ↔ model discipline (design D19), fail-closed (FN_CONTRACT);
   *  the settle-side twin lives in settle.ts. */
  private validateUsage(usage: FnUsage): void {
    const problem = countsMismatch(this.doc.usage.model, usage.counts)
    if (problem !== undefined) {
      throw new EngineError(
        EngineErrorCode.FN_CONTRACT,
        `${this.doc.id}: ${problem}`,
      )
    }
  }
}
