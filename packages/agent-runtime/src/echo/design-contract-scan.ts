import path from 'node:path'

import type { DesignContract } from '@savant-code/common/types/design-system'

const VISUAL_EXTENSIONS = new Set([
  '.css',
  '.scss',
  '.less',
  '.html',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.vue',
  '.svelte',
])
/** FID-2026-0824-002: directory segments that are never visual surfaces. */
const NON_VISUAL_SEGMENTS = new Set(['scripts', '__tests__', 'handlers'])
const CSS_VALUE =
  /-?(?:\d+(?:\.\d+)?)(?:px|rem|em|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc|%)(?:\b|$)/gi
const OPENTUI_UNIT_VALUE = /(?<![\w.-])-?\d+(?:\.\d+)?(?![\w.-])/g
const OPEN_TUI_SPACING_DECLARATION =
  /(?:padding|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginTop|marginBottom|marginLeft|marginRight|gap|border-radius|borderRadius)\s*:\s*([^,;}\n]*)/gi
// FID-2026-0819-005 Loop 159: color/typography/dynamic-visual/token scanners
// moved verbatim to ./design-contract-visual and re-exported below — the
// public surface is unchanged.

export {
  dynamicVisualProperties,
  missingAccessibilityTokens,
  missingComponentTokens,
  unknownColors,
  unsupportedTypography,
  unsupportedTypographyValues,
} from './design-contract-visual'
export function isVisualPath(filePath: string): boolean {
  if (!VISUAL_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return false
  }
  // FID-2026-0824-002: extension alone over-matches — build tooling, tests,
  // handlers, and generated artifacts are never visual surfaces.
  const normalized = filePath.replaceAll('\\', '/')
  if (/\.generated\.[cm]?[jt]sx?$/i.test(normalized)) return false
  return !normalized
    .split('/')
    .slice(0, -1)
    .some((segment) => NON_VISUAL_SEGMENTS.has(segment.toLowerCase()))
}

/** Replace comments while preserving strings and line boundaries for scanning. */
export function maskComments(content: string): string {
  let result = ''
  let comment: 'line' | 'block' | undefined
  for (let index = 0; index < content.length; index += 1) {
    const current = content[index] ?? ''
    const next = content[index + 1] ?? ''
    if (comment === 'line') {
      result += current === '\n' ? '\n' : ' '
      if (current === '\n') comment = undefined
      continue
    }
    if (comment === 'block') {
      result += current === '\n' ? '\n' : ' '
      if (current === '*' && next === '/') {
        result += ' '
        index += 1
        comment = undefined
      }
      continue
    }
    if (current === '/' && next === '/') {
      result += '  '
      index += 1
      comment = 'line'
      continue
    }
    if (current === '/' && next === '*') {
      result += '  '
      index += 1
      comment = 'block'
      continue
    }
    result += current
  }
  return result
}

export function allowedColors(contract: DesignContract): Set<string> {
  return new Set(
    Object.values(contract.colors)
      .filter((value) => typeof value === 'string')
      .map((value) => value.toLowerCase().replace(/\s+/g, '')),
  )
}

export function allowedValues(
  contract: DesignContract,
  section: 'spacing' | 'radius',
): Set<string> {
  return new Set(
    Object.values(contract[section]).map((value) => value.toLowerCase()),
  )
}

export function unknownCssValues(
  content: string,
  allowed: Set<string>,
  propertyPattern: RegExp,
  unitless = false,
): string[] {
  const values: string[] = []
  for (const match of content.matchAll(propertyPattern)) {
    const propertyValue = match[1] ?? ''
    for (const value of propertyValue.matchAll(CSS_VALUE))
      values.push(value[0].toLowerCase())
    if (unitless) {
      for (const value of propertyValue.matchAll(OPENTUI_UNIT_VALUE))
        values.push(value[0].toLowerCase())
    }
  }
  return [...new Set(values)].filter((value) => !allowed.has(value))
}

export function computedCssProperties(content: string): string[] {
  const properties: string[] = []
  for (const match of content.matchAll(
    /((?:padding|margin|gap|border-radius))\s*:\s*([^;}\n]*)/gi,
  )) {
    if (/\bcalc\s*\(/i.test(match[2] ?? ''))
      properties.push(match[1]?.toLowerCase() ?? 'computed')
  }
  return [...new Set(properties)]
}

export function unknownOpenTuiValues(
  content: string,
  allowedSpacing: Set<string>,
  allowedRadius: Set<string>,
): { spacing: string[]; radius: string[] } {
  const looksLikeObjectStyle =
    /style\s*=\s*\{\{|(?:const|let|var)\s+\w+\s*=\s*\{/i.test(content)
  if (!looksLikeObjectStyle) return { spacing: [], radius: [] }
  const spacing: string[] = []
  const radius: string[] = []
  for (const match of content.matchAll(OPEN_TUI_SPACING_DECLARATION)) {
    const property = match[0].split(':', 1)[0]?.trim().toLowerCase() ?? ''
    const isRadius = property === 'borderradius' || property === 'border-radius'
    const allowed = isRadius ? allowedRadius : allowedSpacing
    for (const value of (match[1] ?? '').matchAll(OPENTUI_UNIT_VALUE)) {
      const normalized = value[0]!.toLowerCase()
      if (
        !allowed.has(normalized) &&
        (isRadius ? radius : spacing).indexOf(normalized) < 0
      ) {
        ;(isRadius ? radius : spacing).push(normalized)
      }
    }
  }
  return { spacing, radius }
}
