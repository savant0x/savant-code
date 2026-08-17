#!/usr/bin/env bun

import { spawnSync, type SpawnSyncOptions } from 'child_process'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

type TargetInfo = {
  bunTarget: string
  platform: NodeJS.Platform
  arch: string
}

const VERBOSE = process.env.VERBOSE === 'true'
const OVERRIDE_TARGET = process.env.OVERRIDE_TARGET
const OVERRIDE_PLATFORM = process.env.OVERRIDE_PLATFORM as
  NodeJS.Platform | undefined
const OVERRIDE_ARCH = process.env.OVERRIDE_ARCH ?? undefined
const OVERRIDE_COMPILE_EXECUTABLE_PATH = process.env.BUN_COMPILE_EXECUTABLE_PATH

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const cliRoot = join(__dirname, '..')
const repoRoot = dirname(cliRoot)

function log(message: string) {
  if (VERBOSE) {
    console.log(message)
  }
}

function logAlways(message: string) {
  console.log(message)
}

// FID-2026-0805-002: canonical NEXT_PUBLIC_* defaults for release binaries.
// The sibling env.json must match these exactly (unless the build is an
// explicit dev build or override) so dev values never ship in a release
// artifact. Exported for the env-integrity unit test.
export const CANONICAL_NEXT_PUBLIC_DEFAULTS: Record<string, string> = {
  NEXT_PUBLIC_CB_ENVIRONMENT: 'prod',
  NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'https://savant-code.com',
  NEXT_PUBLIC_WEB_PORT: '3000',
  NEXT_PUBLIC_SUPPORT_EMAIL: 'support@savant-code.com',
  NEXT_PUBLIC_POSTHOG_API_KEY: 'phc_release_placeholder',
  NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://us.i.posthog.com',
  NEXT_PUBLIC_GRAVITY_PIXEL_ID: '00000000-0000-0000-0000-000000000000',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_release_placeholder',
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: 'https://savant-code.com/portal',
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID: 'release_placeholder',
}

/** Runtime route embedded in Savant-Code release binaries' sibling env.json. */
export const CANONICAL_RELEASE_RUNTIME_DEFAULTS: Record<string, string> = {
  DIRECT_PROVIDER: 'openrouter',
  INFERENCE_BASE_URL: 'https://openrouter.ai/api/v1',
  SAVANT_CODE_DEFAULT_MODEL_ID: 'openrouter/free',
}

/**
 * Keep Savant-Free's backend/session flow intact while making the paid
 * Savant-Code release artifact direct-provider-first. Both variants share the
 * compiler, so this decision must be explicit and testable at build time.
 */
export function getReleaseRuntimeDefaults(
  binaryName: string,
): Record<string, string> {
  return binaryName === 'savant-free'
    ? {}
    : { ...CANONICAL_RELEASE_RUNTIME_DEFAULTS }
}

export interface BinaryEnvLeak {
  key: string
  expected: string
  actual: string
}

/**
 * Result of evaluating the binary env against the canonical NEXT_PUBLIC_*
 * defaults. `block` is true only when a release gate must fail the build;
 * `warning` carries the accepted-override notice for dev/override builds;
 * `reason` explains why overrides were accepted (or null when none were).
 */
export interface EnvIntegrityDecision {
  block: boolean
  warning: string | null
  reason: 'dev-build' | 'override' | null
  leaks: BinaryEnvLeak[]
}

/**
 * FID-2026-0805-002: decide whether the env-integrity gate blocks the build.
 * Pure + exported so both escape hatches are unit-testable without running a
 * full binary build:
 * - `devBuild` (SAVANT_CODE_BUILD_ENV set) → intentional local dev binary;
 *   overrides accepted, gate does not block, warning explains why.
 * - `allowOverrides` (SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1) → explicit
 *   CI override (e.g. injecting real prod PostHog/Stripe keys); same behavior
 *   but the warning names it an explicit override.
 * With neither set and leaks present, the gate blocks.
 */
export function evaluateBinaryEnvIntegrity(
  binaryEnv: Record<string, string>,
  canonicalDefaults: Record<string, string>,
  options: { devBuild?: boolean; allowOverrides?: boolean } = {},
): EnvIntegrityDecision {
  const leaks = findBinaryEnvLeaks(binaryEnv, canonicalDefaults)
  const devBuild = options.devBuild ?? false
  const allowOverrides = options.allowOverrides ?? false

  if (leaks.length > 0 && !devBuild && !allowOverrides) {
    return { block: true, warning: null, reason: null, leaks }
  }

  const accepted = leaks.length > 0
  return {
    block: false,
    warning: accepted
      ? `⚠️  ${leaks.length} NEXT_PUBLIC_* override(s) accepted (${
          devBuild ? 'dev build' : 'explicit override'
        }):\n` +
        leaks.map(({ key, actual }) => `  ${key} = "${actual}"`).join('\n')
      : null,
    reason: accepted ? (devBuild ? 'dev-build' : 'override') : null,
    leaks,
  }
}

/**
 * FID-2026-0805-002: detect dev NEXT_PUBLIC_* values in a built binary env.
 * Returns the keys whose value differs from the canonical release default,
 * unexpected NEXT_PUBLIC_* keys that are not in the canonical set, and
 * canonical keys that are missing entirely. Non-NEXT_PUBLIC_ keys are ignored.
 * Pure + exported so the release-env integrity check is unit-testable.
 */
export function findBinaryEnvLeaks(
  binaryEnv: Record<string, string>,
  canonicalDefaults: Record<string, string>,
): BinaryEnvLeak[] {
  const leaks: BinaryEnvLeak[] = []

  for (const [key, actual] of Object.entries(binaryEnv)) {
    if (!key.startsWith('NEXT_PUBLIC_')) continue
    const expected = canonicalDefaults[key]
    if (expected === undefined) {
      leaks.push({ key, expected: '<none>', actual })
    } else if (actual !== expected) {
      leaks.push({ key, expected, actual })
    }
  }

  // Canonical keys missing from the final env (shouldn't happen; be strict).
  for (const key of Object.keys(canonicalDefaults)) {
    if (!key.startsWith('NEXT_PUBLIC_')) continue
    if (binaryEnv[key] === undefined) {
      leaks.push({ key, expected: canonicalDefaults[key], actual: '<unset>' })
    }
  }

  return leaks
}

function getBunExecutable(): string {
  // When run under Bun (the normal case), process.execPath points at the Bun
  // binary even when `bun` is not on the child process PATH (Windows).
  if (process.execPath && !process.execPath.endsWith('node')) {
    return process.execPath
  }
  return 'bun'
}

function runCommand(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {},
) {
  const executable = command === 'bun' ? getBunExecutable() : command
  const result = spawnSync(executable, args, {
    cwd: options.cwd,
    stdio: VERBOSE ? 'inherit' : 'pipe',
    env: options.env,
  })

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? ''
    const failure = result.error
      ? `${result.error.message}`
      : result.signal
        ? `signal ${result.signal}`
        : result.status === null
          ? 'exited without a status (null)'
          : `exit code ${result.status}`
    throw new Error(
      `Command "${command} ${args.join(' ')}" failed: ${failure}${
        stderr ? `\n${stderr}` : ''
      }`,
    )
  }
}

function getTargetInfo(): TargetInfo {
  if (OVERRIDE_TARGET && OVERRIDE_PLATFORM && OVERRIDE_ARCH) {
    return {
      bunTarget: OVERRIDE_TARGET,
      platform: OVERRIDE_PLATFORM,
      arch: OVERRIDE_ARCH,
    }
  }

  const platform = process.platform
  const arch = process.arch

  const mappings: Record<string, TargetInfo> = {
    'linux-x64': { bunTarget: 'bun-linux-x64', platform: 'linux', arch: 'x64' },
    'linux-arm64': {
      bunTarget: 'bun-linux-arm64',
      platform: 'linux',
      arch: 'arm64',
    },
    'darwin-x64': {
      bunTarget: 'bun-darwin-x64',
      platform: 'darwin',
      arch: 'x64',
    },
    'darwin-arm64': {
      bunTarget: 'bun-darwin-arm64',
      platform: 'darwin',
      arch: 'arm64',
    },
    'win32-x64': {
      bunTarget: 'bun-windows-x64',
      platform: 'win32',
      arch: 'x64',
    },
  }

  const key = `${platform}-${arch}`
  const target = mappings[key]

  if (!target) {
    throw new Error(`Unsupported build target: ${key}`)
  }

  return target
}

function getCliTargetLabel(targetInfo: TargetInfo): string {
  const baseTarget = `${targetInfo.platform}-${targetInfo.arch}`
  return targetInfo.bunTarget.endsWith('-baseline')
    ? `${baseTarget}-baseline`
    : baseTarget
}

async function main() {
  const [, , binaryNameArg, version] = process.argv
  const binaryName = binaryNameArg ?? 'savant-code'

  if (!version) {
    throw new Error('Version argument is required when building a binary')
  }

  // Release binaries must run in production mode. Local dev builds can opt out
  // by setting SAVANT_CODE_BUILD_ENV before invoking this script. Note: this
  // force-set runs BEFORE the env overlay below, so a dev NEXT_PUBLIC_CB_ENVIRONMENT
  // in the shell can never reach env.json — the force-set is the primary guard
  // for that one var; findBinaryEnvLeaks covers the other nine NEXT_PUBLIC_*.
  const buildEnv = process.env.SAVANT_CODE_BUILD_ENV
  process.env.NEXT_PUBLIC_CB_ENVIRONMENT = buildEnv ?? 'prod'

  log(
    `Building ${binaryName} @ ${version} (env=${process.env.NEXT_PUBLIC_CB_ENVIRONMENT})`,
  )

  const targetInfo = getTargetInfo()
  const binDir = join(cliRoot, 'bin')

  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true })
  }

  // Generate bundled agents file before compiling
  log('Generating bundled agents...')
  runCommand('bun', ['run', 'scripts/prebuild-agents.ts'], {
    cwd: cliRoot,
    env: process.env,
  })

  // Ensure SDK assets exist before compiling the CLI
  log('Building SDK dependencies...')
  runCommand('bun', ['run', '--cwd', '../sdk', 'build'], {
    cwd: cliRoot,
    env: process.env,
  })

  patchOpenTuiAssetPaths()
  await ensureOpenTuiNativeBundle(targetInfo)

  const outputFilename =
    targetInfo.platform === 'win32' ? `${binaryName}.exe` : binaryName
  const outputFile = join(binDir, outputFilename)

  // Build the canonical runtime environment for the release binary. We used
  // to pass these as `--define` flags, but workspace packages are pre-built
  // to dist and minified, so `--define` does not reliably replace every
  // `process.env.*` reference. Instead we ship an `env.json` next to the
  // binary and load it at startup (see cli/src/pre-init/load-dev-env.ts).
  const binaryEnv: Record<string, string> = {
    NODE_ENV: 'production',
    SAVANT_CODE_IS_BINARY: 'true',
    SAVANT_CODE_CLI_VERSION: version,
    SAVANT_CODE_CLI_TARGET: getCliTargetLabel(targetInfo),
    SAVANT_FREE_MODE: process.env.SAVANT_FREE_MODE ?? 'false',
    // Savant-Code release binaries use the same direct OpenRouter free route
    // as local onboarding. Savant-Free intentionally receives no direct
    // provider values here; its backend/session flow remains intact.
    ...getReleaseRuntimeDefaults(binaryName),
    // Canonical runtime defaults so a locally built (or released) binary can
    // boot without relying on the build shell exporting every NEXT_PUBLIC_*.
    ...CANONICAL_NEXT_PUBLIC_DEFAULTS,
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('NEXT_PUBLIC_') && value !== undefined) {
      binaryEnv[key] = value
    }
  }

  // FID-2026-0805-002: a release build must never ship dev NEXT_PUBLIC_*
  // values (localhost URLs, personal emails, placeholder keys) inside the
  // env.json sibling — the build shell and the repo .env.local routinely
  // inject them. Fail the build instead of shipping. Escape hatches:
  // - SAVANT_CODE_BUILD_ENV=<env>  → intentional local dev build (skips check)
  // - SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1 → explicit CI override
  //   (e.g. injecting real production PostHog/Stripe keys)
  const integrity = evaluateBinaryEnvIntegrity(
    binaryEnv,
    CANONICAL_NEXT_PUBLIC_DEFAULTS,
    {
      devBuild: Boolean(process.env.SAVANT_CODE_BUILD_ENV),
      allowOverrides:
        process.env.SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES === '1',
    },
  )
  if (integrity.block) {
    throw new Error(
      'Release build aborted: dev NEXT_PUBLIC_* values leaked into env.json.\n' +
        'Unset them (and remove/ignore the repo .env.local) before building, set ' +
        'SAVANT_CODE_BUILD_ENV to build a local dev binary, or set ' +
        'SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1 to explicitly accept them.\n' +
        integrity.leaks
          .map(
            ({ key, expected, actual }) =>
              `  ${key}: got "${actual}", expected "${expected}"`,
          )
          .join('\n'),
    )
  }
  if (integrity.warning) {
    logAlways(integrity.warning)
  }

  const defineFlags = [
    ['process.env.NODE_ENV', '"production"'],
    ['process.env.SAVANT_CODE_IS_BINARY', '"true"'],
    ['process.env.SAVANT_CODE_CLI_VERSION', `"${version}"`],
    [
      'process.env.SAVANT_CODE_CLI_TARGET',
      `"${getCliTargetLabel(targetInfo)}"`,
    ],
    [
      'process.env.SAVANT_FREE_MODE',
      `"${process.env.SAVANT_FREE_MODE ?? 'false'}"`,
    ],
    // FID-2026-0803-002 DB-8: llm-providers' `openai-compatible/version.ts`
    // reads `__PACKAGE_VERSION__` (bare identifier, source-consumed) with a
    // `0.0.0-test` fallback. Without this define every request advertises the
    // test suffix in the User-Agent. `--define` is reliable here because the
    // reference lives in source (not a pre-built dist bundle).
    ['__PACKAGE_VERSION__', `"${version}"`],
  ]

  const buildArgs = [
    'build',
    'src/index.tsx',
    '--compile',
    '--production', // Required so compiled binaries use the production JSX runtime (avoids jsxDEV crashes).
    '--no-compile-autoload-bunfig', // User project bunfig.toml must not affect the standalone CLI.
    `--target=${targetInfo.bunTarget}`,
    ...(OVERRIDE_COMPILE_EXECUTABLE_PATH
      ? [`--compile-executable-path=${OVERRIDE_COMPILE_EXECUTABLE_PATH}`]
      : []),
    `--outfile=${outputFile}`,
    '--sourcemap=none',
    // Keep non-env build constants as `--define` fallbacks. Env vars are
    // injected at runtime via the sibling env.json file.
    ...defineFlags.flatMap(([key, value]) => ['--define', `${key}=${value}`]),
  ]

  log(
    `bun ${buildArgs
      .map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
      .join(' ')}`,
  )

  runCommand('bun', buildArgs, { cwd: cliRoot })

  // Ship tree-sitter.wasm as a sibling file next to the binary. Bun
  // --compile asset embedding is unreliable on Windows (every JS-level
  // retrieval mechanism we tried — `with { type: 'file' }`, base64 string
  // literals, chunked base64, function-wrapped chunked base64 — got
  // tree-shaken, minified away, or returned an undefined binding even
  // when the bytes were in the binary). The pre-init reads it from
  // `dirname(process.execPath)`, which works the same on every platform
  // because it's a normal disk read, not a bunfs lookup.
  const sourceWasm = findWebTreeSitterWasm()
  const siblingWasm = join(binDir, 'tree-sitter.wasm')
  writeFileSync(siblingWasm, readFileSync(sourceWasm))
  logAlways(`Copied tree-sitter.wasm sibling: ${sourceWasm} → ${siblingWasm}`)

  // FID-2026-0806-017: ship elkjs's GWT worker bundle as a sibling file too.
  // The export-time ELK layout reads it at runtime (manual-eval extraction
  // under Bun, see cli/src/commands/graph-export/layout.ts). Same rationale as
  // tree-sitter.wasm: bun --compile asset embedding is unreliable on Windows,
  // and the bundle is a plain disk read next to the binary.
  const sourceElkWorker = findElkWorkerBundle()
  const siblingElkWorker = join(binDir, 'elk-worker.min.js')
  writeFileSync(siblingElkWorker, readFileSync(sourceElkWorker))
  logAlways(
    `Copied elkjs worker sibling: ${sourceElkWorker} → ${siblingElkWorker}`,
  )

  // FID-2026-0807-007: ship the six verified Kenney CC0 OGG cues beside
  // compiled binaries. The export generator reads this directory when the
  // binary cannot resolve source files from its bundled module tree.
  const sourceGraphAudio = join(
    cliRoot,
    'src',
    'commands',
    'graph-export',
    'audio',
  )
  const siblingGraphAudio = join(binDir, 'graph-export-audio')
  const graphAudioFiles = [
    'click1.ogg',
    'switch1.ogg',
    'switch2.ogg',
    'switch3.ogg',
    'switch4.ogg',
    'switch5.ogg',
    'License.txt',
  ]
  mkdirSync(siblingGraphAudio, { recursive: true })
  for (const audioFile of graphAudioFiles) {
    const source = join(sourceGraphAudio, audioFile)
    if (!existsSync(source)) {
      throw new Error(`Missing graph export audio asset: ${source}`)
    }
    copyFileSync(source, join(siblingGraphAudio, audioFile))
  }
  logAlways(`Copied graph export audio assets: ${siblingGraphAudio}`)

  // Ship the loadable design-system skill beside the binary. Resource files are
  // resolved executable-adjacent at runtime so packaged installs do not depend
  // on the source tree or caller cwd.
  const designSystemsSource = join(
    repoRoot,
    '.agents',
    'skills',
    'savant-design-systems',
  )
  const designSystemsDestination = join(binDir, 'savant-design-systems')
  if (!existsSync(join(designSystemsSource, 'manifest.json'))) {
    throw new Error(
      `Missing generated design-system skill: ${designSystemsSource}`,
    )
  }
  rmSync(designSystemsDestination, { recursive: true, force: true })
  mkdirSync(designSystemsDestination, { recursive: true })
  cpDirectory(designSystemsSource, designSystemsDestination)
  logAlways(`Copied design-system skill: ${designSystemsDestination}`)

  // Ship the runtime environment as a sibling JSON file. This is more
  // reliable than `--define` because workspace packages are pre-built to
  // dist and minified, so compile-time replacements can miss references.
  const envJsonPath = join(binDir, 'env.json')
  writeFileSync(envJsonPath, JSON.stringify(binaryEnv, null, 2))
  logAlways(`Wrote env.json sibling: ${envJsonPath}`)

  // FID-2026-0803-011 BH-3: bun --compile emits an `index.js.map` sibling
  // even with `--sourcemap=none` (verified on bun 1.3.11). It is not shipped
  // by the release tarball (binary + tree-sitter.wasm + env.json only) and
  // nothing references it — remove it so local builds stay lean.
  rmSync(join(binDir, 'index.js.map'), { force: true })

  if (targetInfo.platform !== 'win32') {
    chmodSync(outputFile, 0o755)
  }

  logAlways(`✅ Built ${outputFilename} (${getCliTargetLabel(targetInfo)})`)
}

// FID-2026-0805-002: exported for the env-integrity unit test
// (cli/src/__tests__/unit/build-binary-env.test.ts). Guarded so importing the
// module for tests never runs the build.
if (import.meta.main) {
  main().catch((error: unknown) => {
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error(error)
    }
    process.exit(1)
  })
}

/**
 * Find elkjs's GWT worker bundle (elk-worker.min.js) in any plausible
 * node_modules layout, same as findWebTreeSitterWasm. The graph export reads
 * it at runtime to run the export-time ELK layout (FID-2026-0806-017).
 */
function cpDirectory(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true })
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name)
    const destinationPath = join(destination, entry.name)
    if (entry.isDirectory()) {
      cpDirectory(sourcePath, destinationPath)
    } else {
      copyFileSync(sourcePath, destinationPath)
    }
  }
}

function findElkWorkerBundle(): string {
  const candidates = [
    join(cliRoot, 'node_modules', 'elkjs', 'lib', 'elk-worker.min.js'),
    join(cliRoot, '..', 'node_modules', 'elkjs', 'lib', 'elk-worker.min.js'),
    join(
      cliRoot,
      '..',
      'sdk',
      'node_modules',
      'elkjs',
      'lib',
      'elk-worker.min.js',
    ),
  ]
  const found = candidates.find((p) => existsSync(p))
  if (found) return found
  try {
    const cliRequire = createRequire(join(cliRoot, 'package.json'))
    return cliRequire.resolve('elkjs/lib/elk-worker.min.js')
  } catch (err) {
    throw new Error(
      `Could not locate elkjs/lib/elk-worker.min.js. Searched:\n  - ` +
        candidates.join('\n  - ') +
        `\nAnd createRequire failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Find web-tree-sitter's tree-sitter.wasm in any plausible node_modules
 * layout — bun hoists differently across platforms and `bun install`
 * variants, and CI Windows lays it out differently than monorepo-root
 * installs.
 */
function findWebTreeSitterWasm(): string {
  const candidates = [
    join(cliRoot, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),
    join(cliRoot, '..', 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),
    join(
      cliRoot,
      '..',
      'sdk',
      'node_modules',
      'web-tree-sitter',
      'tree-sitter.wasm',
    ),
  ]
  const found = candidates.find((p) => existsSync(p))
  if (found) return found
  try {
    const cliRequire = createRequire(join(cliRoot, 'package.json'))
    return cliRequire.resolve('web-tree-sitter/tree-sitter.wasm')
  } catch (err) {
    throw new Error(
      `Could not locate web-tree-sitter/tree-sitter.wasm. Searched:\n  - ` +
        candidates.join('\n  - ') +
        `\nAnd createRequire failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

function patchOpenTuiAssetPaths() {
  const coreDir = join(cliRoot, 'node_modules', '@opentui', 'core')
  if (!existsSync(coreDir)) {
    log('OpenTUI core package not found; skipping asset patch')
    return
  }

  const indexFile = readdirSync(coreDir).find(
    (file) => file.startsWith('index') && file.endsWith('.js'),
  )

  if (!indexFile) {
    log('OpenTUI core index bundle not found; skipping asset patch')
    return
  }

  const indexPath = join(coreDir, indexFile)
  const content = readFileSync(indexPath, 'utf8')

  const absolutePathPattern =
    /var __dirname = ".*?packages\/core\/src\/lib\/tree-sitter\/assets";/
  if (!absolutePathPattern.test(content)) {
    log('OpenTUI core bundle already has relative asset paths')
    return
  }

  const replacement =
    'var __dirname = path3.join(path3.dirname(fileURLToPath(new URL(".", import.meta.url))), "lib/tree-sitter/assets");'

  const patched = content.replace(absolutePathPattern, replacement)
  writeFileSync(indexPath, patched)
  logAlways('Patched OpenTUI core tree-sitter asset paths')
}

/**
 * OpenTUI 0.5.3 splits its native bundles into per-platform optional
 * dependencies. Which libc variant Bun's bundler resolves for a linux
 * cross-target is HOST-dependent — observed in the v0.0.25 release:
 * `bun-linux-arm64` resolved `@opentui/core-linux-arm64-musl` on an
 * ubuntu (glibc) CI runner, but `@opentui/core-linux-arm64` on a Windows
 * host. Installing only one variant fails on the other host, so every linux
 * target installs BOTH the glibc and musl bundles of its arch; whichever
 * Bun resolves is present. Darwin/win32 targets have a single variant.
 * Exported so the variant mapping is unit-tested (regression: v0.0.25
 * linux-arm64 release binary missing).
 */
export function getOpenTuiNativePackageNames(targetInfo: TargetInfo): string[] {
  const { platform, arch } = targetInfo
  if (platform === 'linux') {
    const base = `@opentui/core-linux-${arch}`
    return [base, `${base}-musl`]
  }
  return [`@opentui/core-${platform}-${arch}`]
}

async function ensureOpenTuiNativeBundle(targetInfo: TargetInfo) {
  const packageNames = getOpenTuiNativePackageNames(targetInfo)

  // A half-extracted/stub directory (e.g. after a failed fetch) must not
  // count as "present" — the bundler needs the actual package contents.
  const isMissingDirectory = (dir: string): boolean => {
    if (!existsSync(dir)) return true
    try {
      return readdirSync(dir).length === 0
    } catch {
      return true
    }
  }

  const installTargetsFor = (packageFolder: string) => [
    {
      label: 'workspace root',
      packagesDir: join(repoRoot, 'node_modules', '@opentui'),
      packageDir: join(repoRoot, 'node_modules', '@opentui', packageFolder),
    },
    {
      label: 'CLI workspace',
      packagesDir: join(cliRoot, 'node_modules', '@opentui'),
      packageDir: join(cliRoot, 'node_modules', '@opentui', packageFolder),
    },
  ]

  const corePackagePath = [
    join(repoRoot, 'node_modules', '@opentui', 'core', 'package.json'),
    join(cliRoot, 'node_modules', '@opentui', 'core', 'package.json'),
  ].find((candidate) => existsSync(candidate))

  if (!corePackagePath) {
    log('OpenTUI core package metadata missing; skipping native bundle fetch')
    return
  }
  const corePackageJson = JSON.parse(readFileSync(corePackagePath, 'utf8')) as {
    optionalDependencies?: Record<string, string>
  }

  const registryBase =
    process.env.SAVANT_CODE_NPM_REGISTRY ??
    process.env.NPM_REGISTRY_URL ??
    'https://registry.npmjs.org'

  for (const packageName of packageNames) {
    const packageFolder = packageName.slice('@opentui/'.length)
    const installTargets = installTargetsFor(packageFolder)

    const missingTargets = installTargets.filter(({ packageDir }) =>
      isMissingDirectory(packageDir),
    )
    if (missingTargets.length === 0) {
      log(`OpenTUI native bundle ${packageName} already installed`)
      continue
    }
    for (const { packageDir } of missingTargets) {
      rmSync(packageDir, { recursive: true, force: true })
    }

    const version = corePackageJson.optionalDependencies?.[packageName]
    if (!version) {
      log(
        `No optional dependency declared for ${packageName}; skipping native bundle fetch`,
      )
      continue
    }

    const metadataUrl = `${registryBase.replace(/\/$/, '')}/${encodeURIComponent(packageName)}`
    log(`Fetching OpenTUI native bundle metadata from ${metadataUrl}`)

    const metadataResponse = await fetch(metadataUrl)
    if (!metadataResponse.ok) {
      throw new Error(
        `Failed to fetch metadata for ${packageName}: ${metadataResponse.status} ${metadataResponse.statusText}`,
      )
    }

    const metadataResponseBody = await metadataResponse.json()
    const metadata = metadataResponseBody as {
      versions?: Record<
        string,
        {
          dist?: {
            tarball?: string
          }
        }
      >
    }
    const tarballUrl = metadata.versions?.[version]?.dist?.tarball
    if (!tarballUrl) {
      throw new Error(`Tarball URL missing for ${packageName}@${version}`)
    }

    log(`Downloading OpenTUI native bundle from ${tarballUrl}`)
    const tarballResponse = await fetch(tarballUrl)
    if (!tarballResponse.ok) {
      throw new Error(
        `Failed to download ${packageName}@${version}: ${tarballResponse.status} ${tarballResponse.statusText}`,
      )
    }

    const tempDir = mkdtempSync(join(tmpdir(), 'opentui-'))
    try {
      const tarballPath = join(
        tempDir,
        `${packageName.split('/').pop() ?? 'package'}-${version}.tgz`,
      )
      const tarballBuffer = await tarballResponse.arrayBuffer()
      await Bun.write(tarballPath, tarballBuffer)

      for (const target of missingTargets) {
        mkdirSync(target.packagesDir, { recursive: true })
        mkdirSync(target.packageDir, { recursive: true })

        if (!existsSync(target.packageDir)) {
          throw new Error(
            `Failed to create directory for ${packageName}: ${target.packageDir}`,
          )
        }

        const tarballForTar =
          process.platform === 'win32'
            ? tarballPath.replace(/\\/g, '/')
            : tarballPath
        const extractDirForTar =
          process.platform === 'win32'
            ? target.packageDir.replace(/\\/g, '/')
            : target.packageDir

        // --force-local: Git Bash on Windows ships GNU tar, which would
        // otherwise parse `C:/...` paths as remote host specifiers
        // ("Cannot connect to C: resolve failed"). --force-local treats them
        // as plain local filenames, accepted by both MinGW and MSYS tar.
        const tarArgs = [
          '-xzf',
          tarballForTar,
          '--force-local',
          '--strip-components=1',
          '-C',
          extractDirForTar,
        ]
        runCommand('tar', tarArgs)
        if (!existsSync(join(target.packageDir, 'package.json'))) {
          throw new Error(
            `OpenTUI native bundle extraction produced no package.json in ${target.packageDir}; refusing to continue with a stub install.`,
          )
        }
        log(`Installed OpenTUI native bundle ${packageName} in ${target.label}`)
      }
      logAlways(`Fetched OpenTUI native bundle ${packageName}`)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }
}
