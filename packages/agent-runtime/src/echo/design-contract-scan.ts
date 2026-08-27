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
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi
const CSS_VALUE =
  /-?(?:\d+(?:\.\d+)?)(?:px|rem|em|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc|%)(?:\b|$)/gi
const OPENTUI_UNIT_VALUE = /(?<![\w.-])-?\d+(?:\.\d+)?(?![\w.-])/g
const COLOR_DECLARATION =
  /(?:^|[;,{\s])(?:color|text-color|textColor|foreground|fg|background|background-color|backgroundColor|bg|border(?:-[a-z-]+)?|borderColor|outline(?:-color)?|outlineColor|fill|stroke|accentColor)\s*(?::|=)\s*([^;}\n]*)/gi
const FONT_DECLARATION =
  /(?:font-family|fontFamily)\s*(?::|=)\s*([^;}\n,]+(?:\s*,\s*[^;}\n,]+)*)/gi
const TYPOGRAPHY_VALUE_DECLARATION =
  /(?:font-size|fontSize|font-weight|fontWeight|line-height|lineHeight|letter-spacing|letterSpacing|text-transform|textTransform)\s*(?::|=)\s*([^;}\n,]+)/gi
const DYNAMIC_VISUAL_DECLARATION =
  /(?<![\w$])(?<!const\s)(?<!let\s)(?<!var\s)(?:color|text-color|textColor|foreground|fg|background|background-color|backgroundColor|bg|border(?:-[a-z-]+)?|borderColor|outline(?:-color)?|outlineColor|fill|stroke|accentColor|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginTop|marginBottom|marginLeft|marginRight|gap|border-radius|borderRadius|font-family|fontFamily|font-size|fontSize|font-weight|fontWeight|line-height|lineHeight|letter-spacing|letterSpacing)\s*(?::|=)\s*([^;}\n]*)/gi
const OPEN_TUI_SPACING_DECLARATION =
  /(?:padding|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginTop|marginBottom|marginLeft|marginRight|gap|border-radius|borderRadius)\s*:\s*([^,;}\n]*)/gi
const CSS_COLOR_KEYWORDS = new Set(
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor'.split(
    ' ',
  ),
)

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

export function unsupportedTypography(
  content: string,
  contract: DesignContract,
): string[] {
  const allowedFamilies = new Set(
    Object.values(contract.typography)
      .map((value) => value.fontFamily)
      .filter((value): value is string => typeof value === 'string')
      .flatMap((value) =>
        value.split(',').map((item) =>
          item
            .trim()
            .replace(/^['"]|['"]$/g, '')
            .toLowerCase(),
        ),
      )
      .filter(Boolean),
  )
  const foundFamilies: string[] = []
  for (const match of content.matchAll(FONT_DECLARATION)) {
    for (const family of (match[1] ?? '').split(',')) {
      const normalized = family
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .toLowerCase()
      if (normalized && !allowedFamilies.has(normalized))
        foundFamilies.push(normalized)
    }
  }
  return [...new Set(foundFamilies)]
}

function requiredTokens(values: Record<string, unknown> | undefined): string[] {
  const required = values?.requiredTokens
  return Array.isArray(required)
    ? required.filter((item): item is string => typeof item === 'string')
    : []
}

function containsRequiredToken(content: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^A-Za-z0-9_-])${escaped}(?:$|[^A-Za-z0-9_-])`).test(
    content,
  )
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

export function dynamicVisualProperties(content: string): string[] {
  const properties: string[] = []
  for (const match of content.matchAll(DYNAMIC_VISUAL_DECLARATION)) {
    const value = (match[1] ?? '').trim()
    // CSS variables are token indirections and are intentionally allowed. A
    // non-literal expression cannot be mapped deterministically without
    // evaluating application code, so it requires explicit review.
    // A leading custom-property reference (`--token-name`) — quoted or not,
    // including as the HEAD of a captured shorthand — is token indirection,
    // not a dynamic expression (FID-2026-0824-002 lookup-table false
    // positive). The declaration capture runs past closing quotes when no
    // semicolon follows, so an anchored capture takes only the leading
    // optional quote + custom property, never trailing punctuation.
    const isVariable =
      /var\(\s*--/i.test(value) || /^['"]?(--[\w-]+)/.test(value.trim())
    // FID-2026-0824-002 post-closure amendment: prettier collapses
    // single-attribute JSX tags onto one line, so the declaration capture
    // swallows trailing layout noise after the quoted value ("#hex"> or
    // "#hex" attributes={X}>). When the capture HEAD is a quoted string,
    // evaluate exactly that quoted literal — trailing JSX punctuation is
    // formatting, not part of the visual value. Quoting never launders a
    // dynamic expression ("theme.x" still fails the literal test).
    const quotedHead = /^(['"]).*?\1/.exec(value)
    const literalCandidate = quotedHead
      ? value.slice(1, quotedHead[0].length - 1)
      : value.replace(/^['"]|['"]$/g, '')
    const isLiteral =
      /^(?:var\(\s*--[^)]+\s*\)|#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+|\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)?)(?:\s+(?:var\(\s*--[^)]+\s*\)|#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+|\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)?))*$/i.test(
        literalCandidate,
      )
    if (!isVariable && !isLiteral) {
      properties.push(match[0].split(/\s*(?::|=)/, 1)[0]?.trim() ?? 'visual')
    }
  }
  return [...new Set(properties)]
}

export function unknownColors(content: string, allowed: Set<string>): string[] {
  const found: string[] = []
  for (const declaration of content.matchAll(COLOR_DECLARATION)) {
    const value = declaration[1] ?? ''
    for (const color of value.matchAll(COLOR_LITERAL))
      found.push(color[0].toLowerCase().replace(/\s+/g, ''))
    for (const word of value.matchAll(/\b[a-z]+\b/gi)) {
      const normalized = word[0]?.toLowerCase() ?? ''
      if (CSS_COLOR_KEYWORDS.has(normalized)) found.push(normalized)
    }
  }
  return [...new Set(found)].filter((value) => !allowed.has(value))
}

export function unsupportedTypographyValues(
  content: string,
  contract: DesignContract,
): string[] {
  const allowed = new Set(
    Object.values(contract.typography).flatMap((value) =>
      Object.values(value)
        .filter(
          (item): item is string | number =>
            typeof item === 'string' || typeof item === 'number',
        )
        .map((item) => String(item).toLowerCase()),
    ),
  )
  const found: string[] = []
  for (const match of content.matchAll(TYPOGRAPHY_VALUE_DECLARATION)) {
    const value = (match[1] ?? '').trim().toLowerCase()
    if (
      value &&
      !allowed.has(value) &&
      value !== 'inherit' &&
      value !== 'normal'
    )
      found.push(value)
  }
  return [...new Set(found)]
}

export function missingComponentTokens(
  content: string,
  contract: DesignContract,
): string[] {
  return Object.entries(contract.components).flatMap(([name, values]) => {
    const missing = requiredTokens(values).filter(
      (token) => !containsRequiredToken(content, token),
    )
    return missing.map((token) => `${name}.${token}`)
  })
}

export function missingAccessibilityTokens(
  contract: DesignContract,
  content: string,
): string[] {
  return requiredTokens(contract.accessibility).filter(
    (token) => !containsRequiredToken(content, token),
  )
}
