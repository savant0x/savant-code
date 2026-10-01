import type {
  EndpointDoc,
  Json,
  JsonSchemaDoc,
  FnEntry,
  FnRef,
  HttpMethod,
  RunCompleted,
  RunInput,
  Usage,
} from '../../core/mod.ts'
import type { Logger } from '../../shared/logging.ts' // port: was @shared/logging (PORT-NOTES.md)


/**
 * The engine's PUBLIC INTERFACE — monid-services `interfaces/` +
 * implementation pattern. Hosts (the CLI, the test runner) code against
 * these shapes, never against the classes.
 */

/** The transport contract. Auth is UNEXECUTED here: the inject fn ref + its
 *  entry travel with the request so any injector (directTransport locally)
 *  can verify + run it self-contained. The engine pipeline never sees
 *  credentials. */
export interface PreparedRequest {
  method: HttpMethod
  /** Absolute, pathParams already substituted. */
  url: string
  headers: Record<string, string>
  /** Multimap: `["v"]` is one value; `["a","b"]` is a REPEATED key
   *  (`?k=a&k=b`), appended in order. A list a connector joined for its
   *  vendor (akta, comma) arrives as the single element `["a,b"]`. */
  query: Record<string, string[]>
  body?: Json
  /** ABSENT ⇒ the request egresses BARE (no credential injection) — the
   *  same-origin credential rule (design D16): lifecycle fns targeting a
   *  different origin than the doc's request never carry the provider's
   *  credentials. */
  auth?: {
    inject: { ref: FnRef; entry: FnEntry }
    credentials: JsonSchemaDoc
  }
  /** Credential lookup key (provider name). */
  provider: string
  timeouts: { requestMs: number }
}

export interface TransportResponse {
  status: number
  body: string
  /** The vendor's response headers, keys LOWERCASED (multi-valued
   *  comma-joined per the fetch spec). OPTIONAL so a transport that
   *  does not surface them stays source-compatible; the engine
   *  presents `{}` to fns in that case. */
  headers?: Record<string, string>
  contentType?: string
}

/** The only IO port of the engine. Owns credential injection + egress. */
export interface Transport {
  execute(req: PreparedRequest): Promise<TransportResponse>
}

/** Credential lookup. `fields` are the credential field names the doc's
 *  `auth.credentials` declares — the injector passes them so a resolver can
 *  address each one individually (the env resolver maps them to
 *  `<PROVIDER>_CREDENTIALS_<FIELD>`). A resolver that ignores `fields`
 *  stays assignable; absent, it means the default `{apiKey}` shape. */
export type ParamsResolver = (
  provider: string,
  fields?: readonly string[],
) => Promise<Record<string, string>>

export interface EngineCtx {
  /** The only IO port — owns credential injection + egress. */
  transport: Transport
  now?: () => Date
  logger?: Logger
}

/** Result shapes live in @shared/core (schema/run/result.ts — zod-first,
 *  flat, kind-discriminated; they cross process boundaries by value).
 *  Re-exported here so hosts import the engine interface in one place. */
export type { RunCompleted, RunResult } from '../../core/mod.ts'

/** Load side: sealed unit in, runnable endpoint out (fail-closed gates).
 *  (The async/resource load surface was stripped in T106 — an async doc
 *  fails closed at load with ASYNC_UNSUPPORTED.) */
export interface ConnectorEngine {
  load(unitJson: unknown): Promise<RunnableEndpoint>
}

/**
 * Execution side, SYNC-ONLY build: one declarative request, settled
 * (the async phase machine — start/poll/stop and the run() poll loop —
 * was stripped in T106).
 */
export interface RunnableEndpoint {
  readonly doc: EndpointDoc
  /** Cost estimate — PURE (no IO, no state): validated input →
   *  estimated Usage. `elapsedMs` (design D40) re-runs the SAME
   *  estimate mid-flight for docs declaring
   *  `usage.updateEstimateEveryMs`. */
  estimate(runInput: RunInput, elapsedMs?: number): Usage
  /** Sugar: `estimate(runInput, elapsedMs)` for cadenced docs; the
   *  static estimate otherwise. */
  accrued(runInput: RunInput, elapsedMs: number): Usage
  /** The declarative sync execution: build → transport → settle. */
  start(runInput: RunInput): Promise<RunCompleted>
  /** Alias of `start` for the sync surface. */
  run(runInput: RunInput): Promise<RunCompleted>
}
