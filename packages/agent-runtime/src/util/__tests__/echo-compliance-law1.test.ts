// ECHO compliance tracker — Law 1 (read-before-write) behavior: read-then-
// write passes, write-without-read flags, new files exempt, content-knowledge
// exempt, directory/pattern weak reads, bounded pattern window. Sibling of
// the Loop-344 decomposition (parent: echo-compliance.test.ts).
import { describe, expect, it } from 'bun:test'

import { EchoComplianceTracker } from '../echo-compliance'

describe('EchoComplianceTracker — Law 1 (read-before-write)', () => {
  it('passes a write after the file was read', () => {
    const t = new EchoComplianceTracker()
    t.recordRead(['/proj/src/a.ts'])
    const v = t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 5,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })

  it('flags a write without a prior read', () => {
    const t = new EchoComplianceTracker()
    const v = t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 5,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).not.toBeNull()
    expect(v?.law).toBe('law1')
    expect(v?.severity).toBe('warning')
  })

  it('exempts brand-new files (cannot read what does not exist)', () => {
    const t = new EchoComplianceTracker()
    const v = t.recordWrite({
      path: '/proj/src/new.ts',
      lineDelta: 20,
      contentKnowledge: false,
      isNewFile: true,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })

  it('exempts content-knowledge writes (str_replace with exact oldString)', () => {
    const t = new EchoComplianceTracker()
    const v = t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 2,
      contentKnowledge: true,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })

  it('treats a directory read as covering writes beneath it', () => {
    const t = new EchoComplianceTracker()
    t.recordDirectoryRead('/proj/src')
    const v = t.recordWrite({
      path: '/proj/src/deep/nested/a.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })

  it('treats a search pattern as a weak read (substring, case/sep normalized)', () => {
    const t = new EchoComplianceTracker()
    t.recordPatternRead('AUTH')
    const v = t.recordWrite({
      path: '/proj/src/auth/login.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })

  it('keeps recording after the pattern window is saturated (bounded, no throw)', () => {
    const t = new EchoComplianceTracker()
    for (let i = 0; i < 1000; i += 1) {
      t.recordPatternRead(`needle-${i}`)
    }
    // A still-retained weak signal matches; a fresh write never throws.
    const retained = t.recordWrite({
      path: '/proj/src/needle-999/keep.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(retained).toBeNull()
    const unflagged = t.recordWrite({
      path: '/proj/src/unrelated.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(unflagged?.law).toBe('law1')
  })

  it('downgrades to info when the user prompt mentions the file', () => {
    const t = new EchoComplianceTracker({ userPrompt: 'update a.ts please' })
    const v = t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v?.severity).toBe('info')
  })

  it('is a no-op in off mode', () => {
    const t = new EchoComplianceTracker({ mode: 'off' })
    const v = t.recordWrite({
      path: '/proj/src/a.ts',
      lineDelta: 3,
      contentKnowledge: false,
      isNewFile: false,
      securitySensitive: false,
    })
    expect(v).toBeNull()
  })
})
