import { describe, expect, test } from 'bun:test'

import { UNIVERSE_CSS } from '../universe-css'

// FID-2026-0928-004. The Code Universe stylesheet shipped six text colours that
// fail WCAG 2.1 AA (1.4.3) at the 8-9px sizes they are actually used at, a type
// scale with 29 of 38 declarations below 11px, and no designed focus ring on
// most controls. Each leg below fails on the pre-fix stylesheet.
//
// The colour legs read the real declaration out of the shipped CSS rather than
// restating a literal, so reverting a value in universe-css.ts re-breaks them.

const VOID = [0x03, 0x06, 0x11] as const

type Rgb = readonly [number, number, number]

function parseHex(value: string): Rgb {
  const h = value.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ] as const
}

/** Alpha-composite `fg` at `alpha` over `bg` — the shipped panels are tinted. */
function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ] as const
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Rgb, b: Rgb): number {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** Declarations of the first rule whose selector list contains `selector`. */
function ruleFor(selector: string): string {
  let from = 0
  for (;;) {
    const open = UNIVERSE_CSS.indexOf('{', from)
    if (open === -1) break
    const close = UNIVERSE_CSS.indexOf('}', open)
    if (close === -1) break
    const head = UNIVERSE_CSS.slice(from, open)
    if (head.split(',').some((s) => s.trim() === selector)) {
      return UNIVERSE_CSS.slice(open + 1, close)
    }
    from = close + 1
  }
  throw new Error(`no rule found for selector ${selector}`)
}

/** The `:root` block, which is the palette's single declaration site. */
function rootBlock(): string {
  const open = UNIVERSE_CSS.indexOf(':root{')
  if (open === -1) throw new Error('no :root block')
  const close = UNIVERSE_CSS.indexOf('}', open)
  return UNIVERSE_CSS.slice(open + 1, close)
}

/** The hex a `:root` token declares, or undefined when it is not declared. */
function tokenValue(name: string): Rgb | undefined {
  const declared = rootBlock().match(new RegExp(`${name}:(#[0-9a-fA-F]{3,8})`))
  return declared ? parseHex(declared[1]) : undefined
}

/** The raw `color:` value for a selector — a hex literal or a `var(--x)`. */
function colorValueOf(selector: string): string {
  const declared = ruleFor(selector).match(
    /(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,8}|var\(--[a-z0-9-]+\))/,
  )
  if (!declared) throw new Error(`no color: in rule for ${selector}`)
  return declared[1]
}

/**
 * Resolve a selector's colour, following a `var(--token)` reference into
 * `:root`. A hex literal still resolves, so the contrast legs read the real
 * declaration either way — which is what lets them hold before AND after the
 * tokenisation, and fail only if the resolved colour is wrong.
 */
function colorOf(selector: string): Rgb {
  const value = colorValueOf(selector)
  if (value.startsWith('var(')) {
    const name = value.slice(4, -1)
    const resolved = tokenValue(name)
    if (!resolved)
      throw new Error(`${name} is referenced but not declared in :root`)
    return resolved
  }
  return parseHex(value)
}

// Backgrounds the text actually sits on, alpha-composited as shipped.
const SURFACE = over(
  parseHex('#020711'),
  0.8,
  over(parseHex('#06172b'), 0.9, VOID),
)
const PANEL = over(parseHex('#081224'), 0.91, VOID)
const HEADER = over(parseHex('#061022'), 0.95, VOID)

const AA_NORMAL = 4.5

const TEXT_PAIRS: { selector: string; background: Rgb; note: string }[] = [
  {
    selector: '.document-line-number',
    background: SURFACE,
    note: 'the code gutter — read on every line of every document',
  },
  {
    selector: '.document-breadcrumb-sep',
    background: SURFACE,
    note: 'path separator between breadcrumb segments',
  },
  {
    selector: '.region-file small',
    background: PANEL,
    note: 'file summary line under a region entry',
  },
  {
    selector: '.region-more',
    background: PANEL,
    note: '"+N more" affordance',
  },
  {
    selector: '.center-focus-hint',
    background: PANEL,
    note: 'hint line under the focus panel metrics',
  },
  {
    selector: '.universe-footer',
    background: HEADER,
    note: 'the persistent status bar',
  },
]

describe('UNIVERSE_CSS text contrast (WCAG 1.4.3)', () => {
  for (const { selector, background, note } of TEXT_PAIRS) {
    test(`${selector} meets AA against its real background — ${note}`, () => {
      const ratio = contrast(colorOf(selector), background)
      expect({ selector, ratio: Number(ratio.toFixed(2)) }).toEqual({
        selector,
        ratio: expect.any(Number),
      })
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }

  test('the muted token itself still passes on the void', () => {
    // Guard against a "fix" that lifts one pair by breaking the shared token.
    const muted = parseHex('#7183a8')
    expect(contrast(muted, VOID)).toBeGreaterThanOrEqual(AA_NORMAL)
  })
})

// R3 (2026-09-28). The six colours FID-2026-0928-004 lifted for WCAG AA were
// left as literals, so the palette fix and the token discipline were two
// different things. These legs pin them to `:root`. They are the RED half: each
// fails while the selector still carries a hex.
const D1_TOKENS: { token: string; hex: string; selectors: string[] }[] = [
  {
    token: '--gutter',
    hex: '#4f80a1',
    selectors: ['.document-line-number', '.document-breadcrumb-sep'],
  },
  {
    token: '--file-meta',
    hex: '#5e81a3',
    selectors: ['.region-file small'],
  },
  { token: '--status', hex: '#667fa2', selectors: ['.universe-footer'] },
  {
    token: '--hint',
    hex: '#6780a4',
    selectors: ['.center-focus-hint', '.region-more'],
  },
]

describe('UNIVERSE_CSS D1 colours are declared tokens, not literals', () => {
  for (const { token, hex, selectors } of D1_TOKENS) {
    test(`${token} is declared in :root as ${hex}`, () => {
      const declared = tokenValue(token)
      expect(declared).toBeDefined()
      // Asserted as a string, not a tuple, so a mismatch prints the colour.
      expect(
        `#${declared!.map((c) => c.toString(16).padStart(2, '0')).join('')}`,
      ).toBe(hex)
    })

    for (const selector of selectors) {
      test(`${selector} reads ${token} rather than a hex literal`, () => {
        expect(colorValueOf(selector)).toBe(`var(${token})`)
      })
    }
  }

  test('no D1 colour survives as a bare hex anywhere in the stylesheet', () => {
    const body = UNIVERSE_CSS.slice(UNIVERSE_CSS.indexOf('}') + 1)
    const stray = D1_TOKENS.filter(({ hex }) => body.includes(hex)).map(
      ({ hex }) => hex,
    )
    expect(stray).toEqual([])
  })
})

describe('UNIVERSE_CSS type scale', () => {
  test('no font-size declaration falls below 10px', () => {
    const sizes = [...UNIVERSE_CSS.matchAll(/font-size:(\d+)px/g)].map((m) =>
      Number(m[1]),
    )
    expect(sizes.length).toBeGreaterThan(20)
    const tooSmall = sizes.filter((s) => s < 10)
    expect(tooSmall).toEqual([])
  })
})

describe('UNIVERSE_CSS focus visibility', () => {
  const FOCUS_TARGETS = [
    '.universe-actions button',
    '.copy-path',
    '.window-btn',
    '.document-copy',
    '.browser-back',
    '.search-row',
  ]

  for (const selector of FOCUS_TARGETS) {
    test(`${selector} has a designed focus indicator`, () => {
      const hasFocusVisible = new RegExp(
        `${selector.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')}:focus-visible`,
      ).test(UNIVERSE_CSS)
      const hasFocusClass = new RegExp(
        `${selector.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')}\\.nav-key-focus`,
      ).test(UNIVERSE_CSS)
      expect(hasFocusVisible || hasFocusClass).toBe(true)
    })
  }
})
