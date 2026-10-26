/**
 * @module util/npm-pack-artifacts
 *
 * FID-2026-1026-001 — the `npm pack --json` envelope belongs to npm, and it
 * changed shape between majors.
 *
 * npm ≤ 11 prints an array of artifacts:
 * `[ { filename, files, version, … } ]`
 * npm 12 prints an object keyed by package name:
 * `{ "savant-code": { filename, files, version, … } }`
 *
 * Two consumers read that stream — the post-release verifier
 * (`scripts/public-release/npm-guards.ts`) and the CLI release catalog test —
 * and both encoded the array shape inline, so npm 12 turned a successful
 * publish into a failed verification and a red test suite.
 *
 * This is the one reader. It answers a single question: "which entry is the
 * packed artifact?". It returns the first entry for either envelope and
 * `undefined` for every shape it cannot vouch for — an empty array, an empty
 * object, more than one key (a release packs one package per call), or a
 * non-object entry — so each caller keeps its own fail-closed message. Field
 * validation stays with the caller: this module does not pretend a JSON object
 * is a verified artifact.
 */

import type { JSONValue } from '../types/json'

export type NpmPackArtifact = Record<string, JSONValue>

function isJsonObject(
  value: JSONValue | undefined,
): value is Record<string, JSONValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function firstPackedArtifact(
  entries: JSONValue,
): NpmPackArtifact | undefined {
  if (Array.isArray(entries)) {
    const [first] = entries
    return isJsonObject(first) ? first : undefined
  }
  if (!isJsonObject(entries)) return undefined
  const values = Object.values(entries)
  if (values.length !== 1) return undefined
  const [only] = values
  return isJsonObject(only) ? only : undefined
}
