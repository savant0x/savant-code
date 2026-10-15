#!/usr/bin/env bun
/**
 * lint-md-check — the repository markdown gate as an independently runnable
 * check (FID-2026-1006-005).
 *
 * `bun run lint:md` (`markdownlint .`) has NO allowlisted `fid:verify` gate
 * kind: the permitted shapes are `typecheck`, `test`, `probe` and `quality`
 * (FID-2026-0823-009, enforced in fid-verify.ts), and `quality` runs the
 * file-ceiling/style report — it is not markdownlint. So a record whose
 * subject IS the markdown gate could not declare the gate that proves it.
 * This is the `probe` route the FID template names: "make the check
 * independently runnable (exit 0 clean / 1 with issues) and declare it as a
 * probe". Same intent as `scripts/audit-gate-env-parity.ts`.
 *
 * Exit 0 iff the pinned `lint:md` script exits 0; exit 1 with markdownlint's
 * own output otherwise, so a red probe names the file and line rather than
 * reporting an opaque failure.
 *
 * The child is spawned through `process.execPath` rather than a bare `bun`:
 * a bare name resolves through the Windows PATH case-sensitively and ENOENTs
 * when an explicit env is passed (audit gate-env-parity, the v0.0.30
 * incident). `lint:md` re-reads `.markdownlintignore`, so the exemption set
 * stays the single source of truth for what this gate scans.
 */
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..')

export function main(): number {
  const result = Bun.spawnSync([process.execPath, 'run', 'lint:md'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = result.stdout.toString().trim()
  const stderr = result.stderr.toString().trim()

  if (result.exitCode !== 0) {
    console.error('lint:md-check FAILED — markdownlint reported violations:')
    if (stdout) console.error(stdout)
    if (stderr) console.error(stderr)
    return 1
  }

  console.log('lint:md-check PASS — markdownlint reported no violations.')
  return 0
}

if (import.meta.main) {
  process.exitCode = main()
}
