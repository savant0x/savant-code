// FID-2026-0922-001 — shared env-ms parsing for bounded post-publish retry
// windows.
//
// Two stages poll an external system that may lag behind the pipeline's own
// write: GitHub release assets and the npm registry. Both take their window
// from the environment so tests can shrink the wait. The parse is one truth
// for both (Law 13): a missing, non-numeric or negative value falls back to
// the caller's default rather than collapsing the window to zero.

export function positiveEnvMs(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}
