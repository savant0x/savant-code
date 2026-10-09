/**
 * FID-2026-1007-016 — operator-owned sweep control manifest.
 *
 * The verdict rule (`verdictFor`) needs a same-model AND a different-model
 * control to conclude anything; the sweep threaded neither, so every row was
 * `inconclusive`. Controls come from this manifest — authored and owned by
 * the operator, never hardcoded — keyed by `<provider>/<family>` (family via
 * `modelFamily`). A route with no manifest entry runs uncontrolled and stays
 * `inconclusive`; that is a first-class state, not an error.
 *
 * `capturedAt` records control provenance. Credential-epoch enforcement
 * (a control older than the provider's last key rotation is inadmissible)
 * needs a rotation source that does not exist yet, so the field is validated
 * and surfaced, not enforced — see the FID.
 *
 * Pure I/O boundary: loading only reads the file. Nothing here sends anything.
 */
import fs from 'node:fs'

export interface SweepControlEndpoint {
  provider: string
  requestedModel: string
  baseUrl: string
}

export interface SweepControlEntry {
  sameModel?: SweepControlEndpoint
  differentModel?: SweepControlEndpoint
  /** ISO capture timestamp (provenance only — see above). */
  capturedAt?: string
}

export interface SweepControlsManifest {
  version: 'sweep-controls/1'
  entries: Record<string, SweepControlEntry>
}

/** Manifest lookup key for one sweep route. */
export function controlKey(provider: string, family: string): string {
  return `${provider}/${family}`
}

function isEndpoint(value: unknown): value is SweepControlEndpoint {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.provider === 'string' &&
    typeof record.requestedModel === 'string' &&
    typeof record.baseUrl === 'string'
  )
}

function isEntry(value: unknown): value is SweepControlEntry {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (
    record.sameModel !== undefined &&
    !isEndpoint(record.sameModel)
  ) {
    return false
  }
  if (
    record.differentModel !== undefined &&
    !isEndpoint(record.differentModel)
  ) {
    return false
  }
  if (record.capturedAt !== undefined) {
    if (typeof record.capturedAt !== 'string') return false
    if (Number.isNaN(Date.parse(record.capturedAt))) return false
  }
  return true
}

/**
 * Loads the operator-owned manifest. An `undefined` path means no controls
 * (today's behavior — every row `inconclusive`). A named-but-missing file, a
 * version drift, or a malformed entry throws a named refusal: a typo'd path
 * must never silently run uncontrolled. Nothing is sent.
 */
export function loadSweepControls(
  manifestPath: string | undefined,
): SweepControlsManifest | null {
  if (manifestPath === undefined) return null
  let raw: string
  try {
    raw = fs.readFileSync(manifestPath, 'utf8')
  } catch {
    throw new Error(
      `sweep controls manifest not found: ${manifestPath} (nothing was sent)`,
    )
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(
      `sweep controls manifest is not JSON: ${manifestPath} (nothing was sent)`,
    )
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(
      `sweep controls manifest is not an object: ${manifestPath} (nothing was sent)`,
    )
  }
  const record = parsed as Record<string, unknown>
  if (record.version !== 'sweep-controls/1') {
    throw new Error(
      `sweep controls manifest version unsupported (want sweep-controls/1): ${manifestPath} (nothing was sent)`,
    )
  }
  if (typeof record.entries !== 'object' || record.entries === null) {
    throw new Error(
      `sweep controls manifest has no entries map: ${manifestPath} (nothing was sent)`,
    )
  }
  const entries: Record<string, SweepControlEntry> = {}
  for (const [key, value] of Object.entries(
    record.entries as Record<string, unknown>,
  )) {
    if (!isEntry(value)) {
      throw new Error(
        `sweep controls manifest entry ${key} is malformed (want sameModel/differentModel endpoints + optional ISO capturedAt): ${manifestPath} (nothing was sent)`,
      )
    }
    entries[key] = value
  }
  return { version: 'sweep-controls/1', entries }
}
