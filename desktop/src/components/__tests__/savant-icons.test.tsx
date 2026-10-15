// FID-2026-1009-004 Phase 3 drift guard — the desktop adoption must stay
// 1:1 with the generated family and the deck's closed cast. A codegen
// rename, a manifest change, or a roster change fails here before any
// desktop surface can render a broken or missing mark.

import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { DECK_ROLE_IDS } from '../../floor/roles'
import { SAVANT_ICON_SVG, savantIconSvg } from '../../icons.generated'
import { initialRoster } from '../../state/roster'
import { PhaseStepper } from '../chat/PhaseStepper'
import { RosterRail } from '../chat/RosterRail'
import {
  PHASE_ICON_MAP,
  ROSTER_ICON_MAP,
  phaseIcon,
  rosterIcon,
} from '../icon-names'
import { SavantIcon } from '../SavantIcon'

function html(node: React.ReactElement): string {
  return renderToStaticMarkup(node)
}

/** The FSM vocabulary PhaseStepper renders (mirrors its private PHASES). */
const FSM_PHASES = [
  'idle',
  'red',
  'green',
  'audit',
  'adversarial',
  'self_correct',
  'complete',
] as const

describe('desktop family identity (FID-2026-1009-004 Phase 3)', () => {
  test('the generated module carries the full 132-icon family', () => {
    expect(Object.keys(SAVANT_ICON_SVG).length).toBe(132)
    for (const svg of Object.values(SAVANT_ICON_SVG)) {
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg).toContain('viewBox="0 0 64 64"')
    }
  })

  test('savantIconSvg resolves every name and never throws (Law 14)', () => {
    for (const name of Object.keys(SAVANT_ICON_SVG) as Array<
      keyof typeof SAVANT_ICON_SVG
    >) {
      expect(savantIconSvg(name)).toBe(SAVANT_ICON_SVG[name])
    }
  })
})

describe('phase map drift guard (FID-2026-1009-004 Phase 3)', () => {
  test('every FSM phase resolves to a real family mark', () => {
    for (const phase of FSM_PHASES) {
      const name = PHASE_ICON_MAP[phase]
      expect(name).toBeDefined()
      expect(SAVANT_ICON_SVG[name]).toStartWith('<svg')
    }
  })

  test('phaseIcon degrades honestly — null phase rests at idle, unknown is null', () => {
    expect(phaseIcon(null)).toBe(PHASE_ICON_MAP.idle)
    expect(phaseIcon('not-a-phase')).toBeNull()
  })
})

describe('roster map drift guard (FID-2026-1009-004 Phase 3)', () => {
  test('the map is 1:1 with the closed deck cast', () => {
    expect(Object.keys(ROSTER_ICON_MAP).sort()).toEqual(
      [...DECK_ROLE_IDS].sort(),
    )
  })

  test('every roster role resolves to a real family mark', () => {
    for (const roleId of DECK_ROLE_IDS) {
      const name = ROSTER_ICON_MAP[roleId]
      expect(name).toBeDefined()
      expect(SAVANT_ICON_SVG[name]).toStartWith('<svg')
    }
  })

  test('rosterIcon returns null for an unknown role (Law 14)', () => {
    expect(rosterIcon('orchestrator')).toBeNull()
    expect(rosterIcon('')).toBeNull()
  })
})

describe('SavantIcon (FID-2026-1009-004 Phase 3)', () => {
  test('renders the inline SVG for a known name', () => {
    const out = html(<SavantIcon name="ICON_Logo" title="Savant" />)
    expect(out).toContain('savant-icon')
    expect(out).toContain('<svg')
    expect(out).toContain('role="img"')
    expect(out).toContain('aria-label="Savant"')
  })

  test('renders an empty decorative span for an unknown name — never throws', () => {
    const out = html(
      <SavantIcon name={'ICON_DoesNotExist' as keyof typeof SAVANT_ICON_SVG} />,
    )
    expect(out).toContain('savant-icon-missing')
    expect(out).not.toContain('<svg')
  })
})

describe('PhaseStepper carries the family phase marks (FID-2026-1009-004 Phase 3)', () => {
  test('every chip renders its mark beside the label', () => {
    const out = html(<PhaseStepper phase={null} />)
    const markCount = (out.match(/fsm-mark/g) ?? []).length
    expect(markCount).toBe(FSM_PHASES.length)
    expect(out).toContain('viewBox="0 0 64 64"')
  })
})

describe('RosterRail carries the family agent marks (FID-2026-1009-004 Phase 3)', () => {
  test('every roster row renders its mark; the presence dot is gone', () => {
    const out = html(<RosterRail roster={initialRoster()} />)
    const iconCount = (out.match(/roster-icon /g) ?? []).length
    expect(iconCount).toBe(DECK_ROLE_IDS.length)
    expect(out).not.toContain('roster-presence')
    expect(out).toContain('viewBox="0 0 64 64"')
  })
})
