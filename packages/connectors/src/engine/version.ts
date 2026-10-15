/**
 * Engine version — replaces the upstream `import denoJson from
 * "./deno.json" with { type: "json" }` (port deviation, PORT-NOTES.md
 * "Substitutions"): Bun supports JSON import attributes, but the version
 * is a single constant and the import pulled a Deno-idiomatic module
 * graph into tsc. Source of truth: resources/monid-main/engine/deno.json
 * (`"version": "0.5.0"`). An upstream engine bump is a deliberate,
 * diffable port edit.
 */

export const ENGINE_VERSION: string = '0.5.0'
