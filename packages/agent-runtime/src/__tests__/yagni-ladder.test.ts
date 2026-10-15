/**
 * FID-2026-0806-003 Phase 5 (P5a/P5b/P5c) — YAGNI ladder + Forge gate tests.
 *
 * P5a: the 6-rung ladder is a typed evaluator with Law 6/14 exemptions.
 * P5b: assessWrite verdicts — speculative without a debt marker is rejected;
 *      exempted domains never trip the gate.
 * P5c: ponytail: marker harvesting.
 */
import { describe, expect, test } from 'bun:test'

import {
  assessWrite,
  createYagniAssessment,
  evaluateCodebaseReuse,
  evaluateNeedToExist,
  evaluateOneLiner,
  harvestPonytailMarkers,
  parseYagniCheckBlock,
  recordDebtMarker,
} from '../yagni-ladder'

describe('P5a YAGNI ladder', () => {
  test('need-to-exist rung marks speculative scope when not required', () => {
    const assessment = createYagniAssessment()
    const after = evaluateNeedToExist({
      assessment,
      requiredByScope: false,
    })
    expect(after.isSpeculative).toBe(true)
    expect(after.rungsTraversed).toContain(1)
  })

  test('FID-required code is not speculative', () => {
    const assessment = createYagniAssessment()
    const after = evaluateNeedToExist({
      assessment,
      requiredByScope: true,
    })
    expect(after.isSpeculative).toBe(false)
  })

  test('reuse rung records reused entities', () => {
    const assessment = createYagniAssessment()
    const after = evaluateCodebaseReuse({
      assessment,
      reusedEntities: ['getErrorObject', 'buildArray'],
    })
    expect(after.reusedEntities).toEqual(['getErrorObject', 'buildArray'])
    expect(after.rungsTraversed).toContain(2)
  })

  test('exemptions are preserved and never auto-minimized', () => {
    const assessment = createYagniAssessment([
      'trust_boundary',
      'error_path',
      'type_safety',
    ])
    expect(assessment.exemptions).toHaveLength(3)
    // Even a one-liner-able write with exemptions stays non-speculative when
    // the FID demands it.
    const needed = evaluateNeedToExist({
      assessment,
      requiredByScope: true,
    })
    const oneLiner = evaluateOneLiner({
      assessment: needed,
      canBeOneLiner: true,
    })
    expect(oneLiner.isSpeculative).toBe(false)
  })
})

describe('P5b assessWrite gate', () => {
  test('verified: non-speculative write passes', () => {
    const assessment = evaluateNeedToExist({
      assessment: createYagniAssessment(),
      requiredByScope: true,
    })
    expect(assessWrite({ assessment }).verdict).toBe('verified')
  })

  test('rejected: speculative write without a debt marker', () => {
    const assessment = evaluateNeedToExist({
      assessment: createYagniAssessment(),
      requiredByScope: false,
    })
    const verdict = assessWrite({ assessment })
    expect(verdict.verdict).toBe('rejected')
    expect(verdict.reason).toContain('ponytail')
  })

  test('debt-incurred: speculative write WITH a documented marker', () => {
    let assessment = evaluateNeedToExist({
      assessment: createYagniAssessment(),
      requiredByScope: false,
    })
    assessment = recordDebtMarker({
      assessment,
      ceiling: 'no indexing engine for small dataset',
      upgradePath: 'build when dataset exceeds 10k rows',
    })
    expect(assessWrite({ assessment }).verdict).toBe('debt_incurred')
    expect(assessment.debtMarkersInserted[0]).toContain('ponytail:')
  })
})

describe('P5c ponytail marker harvesting', () => {
  test('harvests ceiling/upgrade markers', () => {
    const text =
      '// ponytail: ceiling=simple array scan; upgrade=index when >10k rows\n' +
      'function find(x) { return arr.indexOf(x) }'
    const markers = harvestPonytailMarkers(text)
    expect(markers.length).toBe(1)
    expect(markers[0]).toContain('ceiling=simple array scan')
    expect(markers[0]).toContain('upgrade=index when >10k rows')
  })

  test('harvests bare inline markers', () => {
    const markers = harvestPonytailMarkers(
      '// ponytail: minimal viable, revisit later',
    )
    expect(markers.length).toBeGreaterThanOrEqual(1)
  })

  test('returns empty for clean text', () => {
    expect(harvestPonytailMarkers('const x = 1; // no debt here')).toEqual([])
  })
})

describe('P5b parseYagniCheckBlock', () => {
  test('parses a valid Forge yagni_check block', () => {
    const { assessment, reason } = parseYagniCheckBlock(
      JSON.stringify({
        isSpeculative: false,
        reusedEntities: ['buildArray'],
        stdlibAlternatives: [],
        dependenciesAvoided: ['no new deps'],
        debtMarkersInserted: [],
        rungsTraversed: [1, 2, 3, 4, 5, 6],
        exemptions: ['type_safety'],
      }),
    )
    expect(reason).toBeUndefined()
    expect(assessment.isSpeculative).toBe(false)
    expect(assessment.reusedEntities).toEqual(['buildArray'])
    expect(assessment.exemptions).toEqual(['type_safety'])
  })

  test('returns a reason on malformed JSON', () => {
    const { reason } = parseYagniCheckBlock('not json')
    expect(reason).toContain('not valid JSON')
  })
})
