/**
 * Compiler version — replaces the upstream compiler `deno.json` read
 * (port deviation, PORT-NOTES.md "Substitutions"). Source of truth:
 * resources/monid-main/shared/compiler/deno.json (`"version": "0.1.0"`).
 * Lands in the bundle's `toolchain` provenance.
 */

export const COMPILER_VERSION: string = '0.1.0'
