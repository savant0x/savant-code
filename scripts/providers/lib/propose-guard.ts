/**
 * FID-2026-0916-001 — the propose candidate-tracking guard (Stage C).
 *
 * `providers:propose` scaffolds curation checklists — it must not invent
 * evidence for hosts the pipeline never tracked (MQ3, fail-closed): the
 * scaffold's probe citations and boundary warnings are only trustworthy
 * when candidates.json actually carries the host.
 *
 * Pure module: the parser accepts all persisted state shapes
 * (v2 `{_meta, hosts}`, v1 wrapper, legacy bare host map) exactly like
 * discovery-state-io's parseStateFile, so the guard cannot drift from
 * what the harvester persists. The CLI owns the failure UX; this module
 * owns the decision.
 */

/**
 * True iff `host` has a parseable tracked entry in `stateRaw` (the raw
 * candidates.json text). Corrupt/empty state and absent/malformed host
 * entries are all fail-closed false.
 */
export function isTrackableCandidateHost(
  host: string,
  stateRaw: string,
): boolean {
  const normalized = host.trim().toLowerCase()
  if (normalized.length === 0 || stateRaw.trim().length === 0) return false
  let parsed: unknown
  try {
    parsed = JSON.parse(stateRaw)
  } catch {
    return false
  }
  if (typeof parsed !== 'object' || parsed === null) return false
  const record = parsed as Record<string, unknown>
  const hostsValue =
    typeof record['hosts'] === 'object' && record['hosts'] !== null
      ? record['hosts']
      : parsed
  if (typeof hostsValue !== 'object' || hostsValue === null) return false
  const entry = (hostsValue as Record<string, unknown>)[normalized]
  if (typeof entry !== 'object' || entry === null) return false
  return typeof (entry as Record<string, unknown>)['fingerprint'] === 'string'
}
