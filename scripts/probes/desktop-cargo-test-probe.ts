#!/usr/bin/env bun
/**
 * FID-2026-1002-004 probe: runs the desktop crate's Rust test suite
 * (`cargo test` in desktop/src-tauri) and fails closed on any failure.
 *
 * The FID gate executor's workspace allowlist covers bun workspaces only;
 * the Rust sidecar-supervisor suite is proven through this
 * independently-runnable probe (the FID-2026-0823-009 allowlisted probe
 * shape: exit 0 clean, non-zero with issues; never re-enters FID
 * verification).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'

// Moved into `scripts/probes/` (FID-2026-1016-013): one more level to climb,
// and the directory is the durable probes home the FID template points at.
const crateDir = path.resolve(
  import.meta.dir,
  '..',
  '..',
  'desktop',
  'src-tauri',
)
const result = spawnSync('cargo', ['test'], {
  cwd: crateDir,
  encoding: 'utf8',
  timeout: 10 * 60_000,
})
if (result.error !== undefined) {
  console.error(`cargo test failed to launch: ${result.error.message}`)
  process.exit(1)
}
if (result.status !== 0) {
  console.error(result.stdout ?? '')
  console.error(result.stderr ?? '')
  process.exit(result.status ?? 1)
}
// Surface the per-suite tails so the receipt names the passing suites.
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
const tail = output
  .trim()
  .split('\n')
  .filter((line) => /test result: ok/.test(line))
console.log(tail.join('\n') || 'cargo test reported no failures')
