import { tokenharborModels } from '@savant-code/common/constants/model-config'
import { describe, expect, test } from 'bun:test'

import { TOKENHARBOR_NAMES, getTokenHarborModels } from '../static-catalogs'

describe('TokenHarbor static catalog (FID-2026-1010-001)', () => {
  test('returns one entry per catalog id, in the vendor roster order', () => {
    const models = getTokenHarborModels()
    expect(models.length).toBe(68)
    expect(models.map((m) => m.id)).toEqual(Object.values(tokenharborModels))
    expect(models.every((m) => m.provider === 'tokenharbor')).toBe(true)
  })

  test('names map covers every catalog id and carries no stale key', () => {
    // The names map is cli-side and NOT derived from the common catalog, so
    // nothing else pins it: an id added without a name silently falls back to
    // the raw sliced id, which is the exact drift FID-2026-1010-001 exists to
    // prevent. BOTH directions are asserted — a derived pairing check must
    // check its reach, not only its types (FID-2026-1007-005).
    // Widened to `string[]`: the catalog map's value union is too narrow for
    // `includes(string)`, and a cast would hide a real mismatch.
    const catalogIds: readonly string[] = Object.values(tokenharborModels)
    const missing = catalogIds.filter((id) => !(id in TOKENHARBOR_NAMES))
    expect(missing).toEqual([])
    const stale = Object.keys(TOKENHARBOR_NAMES).filter(
      (id) => !catalogIds.includes(id),
    )
    expect(stale).toEqual([])
  })

  test('serves the haiku rows and the vendor-published windows', () => {
    const byId = new Map(getTokenHarborModels().map((m) => [m.id, m] as const))
    // The operator's ask: claude-haiku-5.5 plus its campaign sibling.
    expect(byId.get('tokenharbor/claude-haiku-5.5')?.name).toBe(
      'Claude Haiku 5.5',
    )
    expect(byId.get('tokenharbor/claude-haiku-5.5')?.contextLength).toBe(
      1_000_000,
    )
    expect(byId.get('tokenharbor/claude-haiku-5.5:free')?.name).toBe(
      'Claude Haiku 5.5 (Limited Free)',
    )
    expect(byId.get('tokenharbor/claude-haiku-5.5:free')?.contextLength).toBe(
      1_000_000,
    )
    // The 6 retained rows re-sourced DOWN to the vendor's own advertisement.
    expect(byId.get('tokenharbor/deepseek-v4-flash')?.contextLength).toBe(
      1_000_000,
    )
    expect(byId.get('tokenharbor/glm-5.2')?.contextLength).toBe(1_000_000)
    expect(byId.get('tokenharbor/mimo-v2.5')?.contextLength).toBe(1_048_576)
    // The dead id left with the roster; the vendor's own hyphenated spelling
    // is preserved (`muse-spark-1.3` is NOT a live id — probed 2026-10-10).
    expect(byId.has('tokenharbor/th-orchestra')).toBe(false)
    expect(byId.has('tokenharbor/muse-spark-1-3')).toBe(true)
    expect(byId.has('tokenharbor/muse-spark-1.3')).toBe(false)
  })

  test('the 3 uncorroborated ids keep their conservative pins', () => {
    const byId = new Map(getTokenHarborModels().map((m) => [m.id, m] as const))
    for (const id of [
      'tokenharbor/qwen3.6-27b',
      'tokenharbor/qwen3.6-flash',
      'tokenharbor/qwen3.5-27b',
    ]) {
      expect(byId.get(id)?.contextLength).toBe(200_000)
    }
  })
})
