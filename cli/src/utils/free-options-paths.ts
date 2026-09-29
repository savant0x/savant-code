/**
 * FID-2026-0928-012 — on-disk paths for the free-options cache and the
 * agent-answerable markdown reference. Own module so tests and callers can
 * import path resolution without pulling the fetch half.
 */
import { getConfigDir } from './config-dir'

/** Config dir paths; test-overridable via SAVANT_CODE_CONFIG_DIR. */
export function freeOptionsPaths(): { cache: string; markdown: string } {
  const dir = getConfigDir()
  return {
    cache: `${dir}/free-options.json`,
    markdown: `${dir}/free-options.md`,
  }
}
