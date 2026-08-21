import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { log, logAlways, runCommand } from './build-binary-runtime'

import type { TargetInfo } from './build-binary-target'

export function getOpenTuiNativePackageNames(targetInfo: TargetInfo): string[] {
  const { platform, arch } = targetInfo
  if (platform === 'linux') {
    const base = `@opentui/core-linux-${arch}`
    return [base, `${base}-musl`]
  }
  return [`@opentui/core-${platform}-${arch}`]
}

export async function ensureOpenTuiNativeBundle(
  targetInfo: TargetInfo,
  cliRoot: string,
  repoRoot: string,
): Promise<void> {
  const packageNames = getOpenTuiNativePackageNames(targetInfo)
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
      versions?: Record<string, { dist?: { tarball?: string } }>
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
      await Bun.write(tarballPath, await tarballResponse.arrayBuffer())

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
