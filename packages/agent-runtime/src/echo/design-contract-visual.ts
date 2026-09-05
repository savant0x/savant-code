import type { DesignContract } from '@savant-code/common/types/design-system'

// FID-2026-0819-005 Loop 159: visual-value scanners (color, typography,
// dynamic-visual, required tokens), extracted verbatim from
// design-contract-scan.ts. Re-exported from design-contract-scan.ts — the
// public surface is unchanged.

const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi
const COLOR_DECLARATION =
  /(?:^|[;,{\s])(?:color|text-color|textColor|foreground|fg|background|background-color|backgroundColor|bg|border(?:-[a-z-]+)?|borderColor|outline(?:-color)?|outlineColor|fill|stroke|accentColor)\s*(?::|=)\s*([^;}\n]*)/gi
const FONT_DECLARATION =
  /(?:font-family|fontFamily)\s*(?::|=)\s*([^;}\n,]+(?:\s*,\s*[^;}\n,]+)*)/gi
const TYPOGRAPHY_VALUE_DECLARATION =
  /(?:font-size|fontSize|font-weight|fontWeight|line-height|lineHeight|letter-spacing|letterSpacing|text-transform|textTransform)\s*(?::|=)\s*([^;}\n,]+)/gi
const DYNAMIC_VISUAL_DECLARATION =
  /(?<![\w$])(?<!const\s)(?<!let\s)(?<!var\s)(?:color|text-color|textColor|foreground|fg|background|background-color|backgroundColor|bg|border(?:-[a-z-]+)?|borderColor|outline(?:-color)?|outlineColor|fill|stroke|accentColor|padding|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginTop|marginBottom|marginLeft|marginRight|gap|border-radius|borderRadius|font-family|fontFamily|font-size|fontSize|font-weight|fontWeight|line-height|lineHeight|letter-spacing|letterSpacing)\s*(?::|=)\s*([^;}\n]*)/gi
const CSS_COLOR_KEYWORDS = new Set(
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent currentcolor'.split(
    ' ',
  ),
)

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
