#!/usr/bin/env bun
/**
 * probe-runner — the shared body of every `fid:verify` repo-gate probe.
 *
 * The FID gate executor permits four shapes: `typecheck <workspace>`,
 * `test <path>`, `probe <path>` and `quality` (FID-2026-0823-009). A repo gate
 * that is a workspace script, a binary (`eslint`, `prettier`, `cargo`), a
 * package-manager invocation, or a script that must be run with a flag has no
 * declaration in that vocabulary — so the check it performs cannot be recorded
 * on a FID at all. The FID template names the route: make the check
 * independently runnable (exit 0 clean / 1 with issues) and declare it as a
 * `probe`.
 *
 * Every such probe is the same program — spawn an allowlisted argv, relay its
 * output, exit with its status — so the body lives here once and each probe
 * file declares only its label, argv and failure headline. That keeps a probe
 * cheap enough that a new gate is never left un-recordable.
 *
 * Contract:
 *  - `argv` is an argv ARRAY, never shell text (no interpolation, no quoting).
 *  - the child is spawned through `process.execPath`, never a bare `bun`: a
 *    bare runtime name resolves case-sensitively through the Windows PATH and
 *    ENOENTs when an explicit env is passed (audit gate-env-parity; the
 *    v0.0.30 incident where every local gate passed and the release failed).
 *  - env is INHERITED, so a probe run by `fid:verify` (which exports
 *    NODE_ENV=test/BUN_ENV=test for every gate) behaves exactly like the same
 *    probe run by hand.
 *  - a red probe prints the child's own stdout/stderr, so the receipt names
 *    the file and line rather than reporting an opaque non-zero exit.
 *  - a probe NEVER re-enters FID verification. `validate:repository` can never
 *    be a gate: it live-re-runs every active FID's declared gates (C3) and
 *    would recurse into itself (lesson, FID-2026-0915-004).
 *
 * `scripts/probe-runner.test.ts` pins the contract; the probe files themselves
 * are enumerated by `scripts/gate-declarability.ts`.
 */
import path from 'node:path'

export const REPO_ROOT = path.resolve(import.meta.dir, '..')

export type ProbeSpec = {
  /** Gate name for the failure headline (e.g. `eslint-check`). */
  label: string
  /** argv only — never shell text. Spawned via `process.execPath`. */
  argv: string[]
  /** Printed on exit 0. */
  pass: string
  /** Printed before the child's output on a non-zero exit. */
  fail: string
  /** Working directory; defaults to the repository root. */
  cwd?: string
  /** Wall-clock budget for the child; 0 (the default) waits indefinitely. */
  timeoutMs?: number
}

/**
 * Run one probe and return the status to exit with. `main()` in each probe is
 * a one-line delegation to this, so the whole program is auditable in one
 * place.
 */
export function runProbe(spec: ProbeSpec): number {
  const result = Bun.spawnSync([process.execPath, ...spec.argv], {
    cwd: spec.cwd ?? REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    ...(spec.timeoutMs === undefined || spec.timeoutMs <= 0
      ? {}
      : { timeout: spec.timeoutMs }),
  })

  const stdout = result.stdout.toString().trim()
  const stderr = result.stderr.toString().trim()

  if (result.exitCode !== 0) {
    console.error(`${spec.fail} (exit ${result.exitCode ?? 'signal'})`)
    if (stdout) console.error(stdout)
    if (stderr) console.error(stderr)
    return result.exitCode === 0 ? 1 : (result.exitCode ?? 1)
  }

  console.log(spec.pass)
  return 0
}

/** Standard `import.meta.main` tail for a probe: exit with the probe status. */
export function runProbeMain(spec: ProbeSpec): void {
  process.exitCode = runProbe(spec)
}
