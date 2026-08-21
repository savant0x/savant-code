import {
  OVERRIDE_ARCH,
  OVERRIDE_PLATFORM,
  OVERRIDE_TARGET,
} from './build-binary-runtime'

export type TargetInfo = {
  bunTarget: string
  platform: NodeJS.Platform
  arch: string
}

export function getTargetInfo(): TargetInfo {
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
  if (!target) throw new Error(`Unsupported build target: ${key}`)
  return target
}

export function getCliTargetLabel(targetInfo: TargetInfo): string {
  const baseTarget = `${targetInfo.platform}-${targetInfo.arch}`
  return targetInfo.bunTarget.endsWith('-baseline')
    ? `${baseTarget}-baseline`
    : baseTarget
}
