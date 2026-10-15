/**
 * OS-level system theme detection (macOS defaults, Windows PowerShell,
 * Linux gsettings).
 */
import type { ThemeName } from '../../types/theme-system'

const textDecoder = new TextDecoder()

const readSpawnOutput = (
  output: Uint8Array | string | null | undefined,
): string => {
  if (!output) return ''
  if (typeof output === 'string') return output.trim()
  if (output instanceof Uint8Array) return textDecoder.decode(output).trim()
  return ''
}

const runSystemCommand = (command: string[]): string | null => {
  if (typeof Bun === 'undefined') return null
  if (command.length === 0) return null

  const [binary] = command
  if (!binary) return null

  const resolvedBinary =
    Bun.which(binary) ??
    (process.platform === 'win32' ? Bun.which(`${binary}.exe`) : null)
  if (!resolvedBinary) return null

  try {
    const result = Bun.spawnSync({
      cmd: [resolvedBinary, ...command.slice(1)],
      stdout: 'pipe',
      stderr: 'pipe',
    })
    if (result.exitCode !== 0) return null
    return readSpawnOutput(result.stdout)
  } catch {
    return null
  }
}

/**
 * Detect Windows PowerShell background color theme
 * Uses PowerShell's (Get-Host).UI.RawUI.BackgroundColor command
 */
function detectWindowsPowerShellTheme(): ThemeName | null {
  if (process.platform !== 'win32') return null

  const bgColor = runSystemCommand([
    'powershell',
    '-NoProfile',
    '-Command',
    '(Get-Host).UI.RawUI.BackgroundColor',
  ])

  if (!bgColor) return null

  const colorLower = bgColor.toLowerCase()

  // Dark background colors in PowerShell
  const darkColors = [
    'black',
    'darkblue',
    'darkgreen',
    'darkcyan',
    'darkred',
    'darkmagenta',
    'darkyellow',
    'darkgray',
  ]
  // Light background colors in PowerShell
  const lightColors = [
    'gray',
    'blue',
    'green',
    'cyan',
    'red',
    'magenta',
    'yellow',
    'white',
  ]

  if (darkColors.includes(colorLower)) return 'dark'
  if (lightColors.includes(colorLower)) return 'light'

  return null
}

export const detectTerminalOverrides = (): ThemeName | null => {
  return null
}

export function detectPlatformTheme(): ThemeName {
  if (typeof Bun !== 'undefined') {
    if (process.platform === 'darwin') {
      const value = runSystemCommand([
        'defaults',
        'read',
        '-g',
        'AppleInterfaceStyle',
      ])
      if (value?.toLowerCase() === 'dark') return 'dark'
      return 'light'
    }

    if (process.platform === 'win32') {
      // Try PowerShell background color detection first
      const powershellTheme = detectWindowsPowerShellTheme()
      if (powershellTheme) return powershellTheme

      // Fallback to Windows system theme
      const value = runSystemCommand([
        'powershell',
        '-NoProfile',
        '-Command',
        '(Get-ItemProperty -Path HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize).AppsUseLightTheme',
      ])
      if (value === '0') return 'dark'
      if (value === '1') return 'light'
    }

    if (process.platform === 'linux') {
      const value = runSystemCommand([
        'gsettings',
        'get',
        'org.gnome.desktop.interface',
        'color-scheme',
      ])
      if (value?.toLowerCase().includes('dark')) return 'dark'
      if (value?.toLowerCase().includes('light')) return 'light'
    }
  }

  return 'dark'
}
