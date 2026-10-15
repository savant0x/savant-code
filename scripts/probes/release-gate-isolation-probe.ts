#!/usr/bin/env bun
/**
 * release-gate-isolation-probe — FID-2026-0913-003 verification probe.
 *
 * Reproduces the exact environment shape that broke the v0.0.31 release
 * gates (the `repository-validation` fid-gate live re-run): repo-root
 * `bun test` under the sanitized public profile
 * (`NEXT_PUBLIC_CB_ENVIRONMENT=prod`, gateway key envs removed). The
 * companion canary `scripts/probes/config-dir-isolation.test.ts` fails
 * whenever that shape defeats the `SAVANT_CODE_CONFIG_DIR` test override —
 * the condition that made CLI provider tests read and write the real
 * `~/.savant-code/` directory during two failed release attempts.
 *
 * Pollution guard: `credentials.json` and `settings.json` in the real config
 * dir are captured before the child runs and restored byte-identically if
 * anything changes (the known damage channel from the incident). Exit 0
 * only when the canary passes AND the real config dir is untouched.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..', '..')

const CANARY = 'scripts/probes/config-dir-isolation.test.ts'
const REAL_DIR = path.join(os.homedir(), '.savant-code')
const GUARDED_FILES = ['credentials.json', 'settings.json']

interface RealSnapshot {
  dirExisted: boolean
  files: Record<string, Buffer>
}

function snapshotRealDir(): RealSnapshot {
  const files: Record<string, Buffer> = {}
  for (const name of GUARDED_FILES) {
    const filePath = path.join(REAL_DIR, name)
    if (fs.existsSync(filePath)) files[name] = fs.readFileSync(filePath)
  }
  return { dirExisted: fs.existsSync(REAL_DIR), files }
}

/** Restore any drift against the snapshot. Returns a problem description or null. */
function verifyAndHeal(snapshot: RealSnapshot): string | null {
  if (!snapshot.dirExisted && fs.existsSync(REAL_DIR)) {
    fs.rmSync(REAL_DIR, { recursive: true, force: true })
    return 'real config dir was created by the child'
  }
  for (const name of GUARDED_FILES) {
    const filePath = path.join(REAL_DIR, name)
    const captured = snapshot.files[name]
    if (captured === undefined) {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true })
        return `${name} was created by the child`
      }
    } else if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, captured)
      return `${name} was deleted by the child`
    } else if (!fs.readFileSync(filePath).equals(captured)) {
      fs.writeFileSync(filePath, captured)
      return `${name} was modified by the child`
    }
  }
  return null
}

function childEnv(configDir: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  delete env.OPENROUTER_API_KEY
  delete env.OR_MASTER_KEY
  delete env.INFERENCE_API_KEY
  // Exact public profile (scripts/public-release/fail.ts PROFILE_ENV).
  env.NEXT_PUBLIC_CB_ENVIRONMENT = 'prod'
  env.NEXT_PUBLIC_SAVANT_CODE_APP_URL = 'https://savant-code.com'
  env.NEXT_PUBLIC_SUPPORT_EMAIL = 'support@savant-code.com'
  env.NEXT_PUBLIC_POSTHOG_HOST_URL = 'https://us.i.posthog.com'
  env.NEXT_PUBLIC_WEB_PORT = '3000'
  env.SAVANT_CODE_CONFIG_DIR = configDir
  return env
}

export function main(): number {
  const snapshot = snapshotRealDir()
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-isolation-probe-'))
  try {
    // process.execPath, not bare 'bun': the release gate's sanitized spawn
    // environment has no PATH-resolvable runtime (v0.0.30 ENOENT incident).
    const spawned = Bun.spawnSync([process.execPath, 'test', CANARY], {
      cwd: root,
      env: childEnv(tmp),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (spawned.exitCode !== 0) {
      console.error(
        'probe: FAIL — canary failed under the release profile shape',
      )
      const output = `${spawned.stdout?.toString() ?? ''}${spawned.stderr?.toString() ?? ''}`
      console.error(output.slice(-2000))
      const healed = verifyAndHeal(snapshot)
      if (healed) console.error(`probe: healed real-dir drift (${healed})`)
      return 1
    }
    const drift = verifyAndHeal(snapshot)
    if (drift) {
      console.error(`probe: FAIL — canary passed but ${drift} (drift healed)`)
      return 1
    }
    console.log(
      'probe: PASS — SAVANT_CODE_CONFIG_DIR honored under prod profile at repo root; real config dir untouched',
    )
    return 0
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

if (import.meta.main) process.exitCode = main()
