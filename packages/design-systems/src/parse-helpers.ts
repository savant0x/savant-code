import { createHash } from 'node:crypto'
import path from 'node:path'

import {
  canonicalDesignTokensSchema,
  designSystemIdSchema,
  type CanonicalDesignTokens,
  type DesignTarget,
  type FontReference,
} from './types'

export const HEX_COLOR = /^#[0-9a-f]{3,8}$/i
export const UNSAFE_CONTENT = /<script\b|javascript:|data:text\/html|<iframe\b/i
export const ABSOLUTE_PATH = /^(?:[a-zA-Z]:[\\/]|[\\/]{2,}|\/)/

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function asStringRecord(value: unknown): Record<string, string> {
  const record: Record<string, string> = {}
  for (const [key, item] of Object.entries(asRecord(value))) {
    if (typeof item === 'string' || typeof item === 'number') {
      record[key] = String(item)
    }
  }
  return record
}

export function normalizeNestedRecord(
  value: unknown,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  for (const [key, item] of Object.entries(asRecord(value))) {
    const record = asRecord(item)
    if (Object.keys(record).length > 0) result[key] = sortRecord(record)
  }
  return result
}

export function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  ) as Record<string, T>
}

export function normalizeTokens(
  data: Record<string, unknown>,
  source: string,
): CanonicalDesignTokens {
  const known = new Set([
    'colors',
    'typography',
    'spacing',
    'rounded',
    'radius',
    'components',
  ])
  const extensions = Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => !known.has(key))
      .sort(([left], [right]) => left.localeCompare(right)),
  )
  const extractedColors = [...source.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(
    (match) => match[0]!,
  )
  const colors = sortRecord(asStringRecord(data.colors))
  if (Object.keys(colors).length === 0 && extractedColors.length > 0) {
    colors.primary = extractedColors[0]!
    colors.foreground = extractedColors[1] ?? '#e4e4e8'
    colors.background = extractedColors[2] ?? '#050508'
  }
  const typography = normalizeNestedRecord(data.typography)
  if (Object.keys(typography).length === 0) {
    typography.body = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      lineHeight: '1.5',
    }
  }
  const spacing = sortRecord(asStringRecord(data.spacing))
  if (Object.keys(spacing).length === 0) spacing.md = '16px'
  const radius = sortRecord(asStringRecord(data.radius ?? data.rounded))
  if (Object.keys(radius).length === 0) radius.md = '8px'
  return canonicalDesignTokensSchema.parse({
    colors,
    typography,
    spacing,
    radius,
    components: normalizeNestedRecord(data.components),
    extensions,
  })
}

export function collectFonts(tokens: CanonicalDesignTokens): FontReference[] {
  const families = new Set<string>()
  for (const typography of Object.values(tokens.typography)) {
    const family = typography.fontFamily
    if (typeof family === 'string') {
      for (const item of family.split(',')) {
        const cleaned = item.trim().replace(/^['"]|['"]$/g, '')
        if (
          cleaned &&
          !/^(system-ui|-apple-system|sans-serif|serif|monospace|ui-sans-serif)$/i.test(
            cleaned,
          )
        ) {
          families.add(cleaned)
        }
      }
    }
  }
  return [...families]
    .sort((left, right) => left.localeCompare(right))
    .map((family) => ({
      family,
      fallback: ['system-ui', 'sans-serif'],
      redistributable: false,
    }))
}

export function inferTargets(tokens: CanonicalDesignTokens): DesignTarget[] {
  const serialized = JSON.stringify(tokens).toLowerCase()
  const targets: DesignTarget[] = ['terminal', 'react']
  if (serialized.includes('css') || serialized.includes('web'))
    targets.push('web')
  return targets
}

export function inferId(
  filePath: string,
  frontmatter: Record<string, unknown>,
): string {
  const value = typeof frontmatter.id === 'string' ? frontmatter.id : undefined
  const name =
    typeof frontmatter.name === 'string' ? frontmatter.name : undefined
  const candidate = value ?? name ?? path.basename(filePath, '.design.md')
  const normalized = candidate
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return designSystemIdSchema.parse(normalized || 'design-system')
}

export function inferDisplayName(
  id: string,
  frontmatter: Record<string, unknown>,
): string {
  if (
    typeof frontmatter.displayName === 'string' &&
    frontmatter.displayName.trim()
  ) {
    return frontmatter.displayName.trim()
  }
  if (typeof frontmatter.name === 'string' && frontmatter.name.trim()) {
    return frontmatter.name.trim()
  }
  return id
    .split('-')
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}
