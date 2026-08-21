import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import {
  cpDirectory,
  findElkWorkerBundle,
  findWebTreeSitterWasm,
  patchOpenTuiAssetPaths,
} from './build-binary-assets'
import {
  CANONICAL_NEXT_PUBLIC_DEFAULTS,
  evaluateBinaryEnvIntegrity,
  getReleaseRuntimeDefaults,
} from './build-binary-env'
import { ensureOpenTuiNativeBundle } from './build-binary-opentui'
import {
  OVERRIDE_COMPILE_EXECUTABLE_PATH,
  log,
  logAlways,
  runCommand,
} from './build-binary-runtime'
import { getCliTargetLabel, getTargetInfo } from './build-binary-target'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const cliRoot = join(__dirname, '..')
const repoRoot = dirname(cliRoot)

export async function main(): Promise<void> {
  const [, , binaryNameArg, version] = process.argv
  const binaryName = binaryNameArg ?? 'savant-code'
  if (!version) {
    throw new Error('Version argument is required when building a binary')
  }

  const buildEnv = process.env.SAVANT_CODE_BUILD_ENV
  process.env.NEXT_PUBLIC_CB_ENVIRONMENT = buildEnv ?? 'prod'
  log(
    `Building ${binaryName} @ ${version} (env=${process.env.NEXT_PUBLIC_CB_ENVIRONMENT})`,
  )

  const targetInfo = getTargetInfo()
  const binDir = join(cliRoot, 'bin')
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true })

  log('Generating bundled agents...')
  runCommand('bun', ['run', 'scripts/prebuild-agents.ts'], {
    cwd: cliRoot,
    env: process.env,
  })
  log('Building SDK dependencies...')
  runCommand('bun', ['run', '--cwd', '../sdk', 'build'], {
    cwd: cliRoot,
    env: process.env,
  })

  patchOpenTuiAssetPaths(cliRoot)
  await ensureOpenTuiNativeBundle(targetInfo, cliRoot, repoRoot)

  const outputFilename =
    targetInfo.platform === 'win32' ? `${binaryName}.exe` : binaryName
  const outputFile = join(binDir, outputFilename)
  const binaryEnv: Record<string, string> = {
    NODE_ENV: 'production',
    SAVANT_CODE_IS_BINARY: 'true',
    SAVANT_CODE_CLI_VERSION: version,
    SAVANT_CODE_CLI_TARGET: getCliTargetLabel(targetInfo),
    SAVANT_FREE_MODE: process.env.SAVANT_FREE_MODE ?? 'false',
    ...getReleaseRuntimeDefaults(binaryName),
    ...CANONICAL_NEXT_PUBLIC_DEFAULTS,
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('NEXT_PUBLIC_') && value !== undefined) {
      binaryEnv[key] = value
    }
  }

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
  if (integrity.warning) logAlways(integrity.warning)

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
    ['__PACKAGE_VERSION__', `"${version}"`],
  ]
  const buildArgs = [
    'build',
    'src/index.tsx',
    '--compile',
    '--production',
    '--no-compile-autoload-bunfig',
    `--target=${targetInfo.bunTarget}`,
    ...(OVERRIDE_COMPILE_EXECUTABLE_PATH
      ? [`--compile-executable-path=${OVERRIDE_COMPILE_EXECUTABLE_PATH}`]
      : []),
    `--outfile=${outputFile}`,
    '--sourcemap=none',
    ...defineFlags.flatMap(([key, value]) => ['--define', `${key}=${value}`]),
  ]

  log(
    `bun ${buildArgs
      .map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
      .join(' ')}`,
  )
  runCommand('bun', buildArgs, { cwd: cliRoot })

  const sourceWasm = findWebTreeSitterWasm(cliRoot)
  const siblingWasm = join(binDir, 'tree-sitter.wasm')
  writeFileSync(siblingWasm, readFileSync(sourceWasm))
  logAlways(`Copied tree-sitter.wasm sibling: ${sourceWasm} → ${siblingWasm}`)

  const sourceElkWorker = findElkWorkerBundle(cliRoot)
  const siblingElkWorker = join(binDir, 'elk-worker.min.js')
  writeFileSync(siblingElkWorker, readFileSync(sourceElkWorker))
  logAlways(
    `Copied elkjs worker sibling: ${sourceElkWorker} → ${siblingElkWorker}`,
  )

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

  const envJsonPath = join(binDir, 'env.json')
  writeFileSync(envJsonPath, JSON.stringify(binaryEnv, null, 2))
  logAlways(`Wrote env.json sibling: ${envJsonPath}`)
  rmSync(join(binDir, 'index.js.map'), { force: true })

  if (targetInfo.platform !== 'win32') chmodSync(outputFile, 0o755)
  logAlways(`✅ Built ${outputFilename} (${getCliTargetLabel(targetInfo)})`)
}
