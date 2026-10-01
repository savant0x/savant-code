/**
 * Contract configuration — the `schema:` and `compiler:` sections of the
 * upstream monid `config.yml`, INLINED as a frozen module (port
 * deviation, PORT-NOTES.md "Substitutions"): upstream reads the YAML at
 * runtime via Deno; here the values are constants so bundle bytes remain
 * a pure function of package content — upstream's own determinism
 * invariant. Source of truth: resources/monid-main/config.yml (verbatim
 * values, upstream spec_version 1.0.0). Any upstream config change is a
 * deliberate, diffable port edit.
 */

/** Frozen, camel-cased view of the contract sections (upstream shape). */
export const contractConfig = Object.freeze({
  schema: Object.freeze({
    specVersion: '1.0.0',
    jsonSchemaDialect: '2020-12',
    fnSrcMaxBytes: 32768,
    /** Oldest engine that understands the current doc format (minEngineVersion floor). */
    docFormatSince: '0.3.0',
    /** Engine release of the current hook ABI — stamped as fn entries' `api`. */
    fnAbiSince: '0.1.0',
    /** Engine release of the lifecycle (async) hook family (D10/D29 surface). */
    asyncSince: '0.2.0',
    /** Engine release of the resource family (D30–D47 surface). */
    resourcesSince: '0.5.0',
    /** Hard engine cap on serialized lifecycle state bytes. */
    stateMaxBytes: 65536,
  }),
  compiler: Object.freeze({
    docSizeWarnBytes: 65536,
    docSizeFailBytes: 262144,
    defaultTimeouts: Object.freeze({
      requestMs: 30000,
      runMs: 60000,
      pollMs: 2000,
    }),
  }),
})
export type ContractConfig = typeof contractConfig
