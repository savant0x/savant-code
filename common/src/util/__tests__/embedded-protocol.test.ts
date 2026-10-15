import { describe, expect, it } from 'bun:test'

import {
  getEmbeddedGroundingFile,
  normalizeGroundingPath,
  partitionEmbeddedGroundingReads,
} from '../embedded-protocol'

describe('embedded-protocol (FID-2026-0810-002 Change 2)', () => {
  it('normalizes paths for bundle lookup (case + separators)', () => {
    expect(normalizeGroundingPath('ECHO.md')).toBe('echo.md')
    expect(normalizeGroundingPath('./ECHO.md')).toBe('echo.md')
    expect(normalizeGroundingPath('dev\\LEARNINGS.md')).toBe('dev/learnings.md')
    expect(normalizeGroundingPath('/protocol.config.yaml')).toBe(
      'protocol.config.yaml',
    )
  })

  it('serves the full harness grounding set from the bundle', () => {
    for (const groundPath of [
      'ECHO.md',
      'ARCHITECTURE.md',
      'protocol.config.yaml',
      'docs/embedded-learnings.md',
      'templates/FID-TEMPLATE.md',
    ]) {
      const served = getEmbeddedGroundingFile(groundPath)
      expect(served).toBeDefined()
      expect(served!.path).toBe(groundPath.toLowerCase())
      expect(served!.content.length).toBeGreaterThan(100)
    }
  })

  it('returns undefined for non-grounding paths (filesystem fallthrough)', () => {
    expect(getEmbeddedGroundingFile('src/main.ts')).toBeUndefined()
    expect(getEmbeddedGroundingFile('dev/fids/FID-2026-0810-002.md')).toBe(
      undefined,
    )
  })

  it('maps the legacy learning request to the curated embedded source', () => {
    const legacy = getEmbeddedGroundingFile('dev/LEARNINGS.md')
    const curated = getEmbeddedGroundingFile('docs/embedded-learnings.md')
    expect(legacy).toBeDefined()
    expect(curated).toBeDefined()
    expect(legacy?.content).toBe(curated?.content)
  })

  it('never serves the single-agent document (out of scope)', () => {
    expect(getEmbeddedGroundingFile('dev/echo-v0.1.2-single-agent.md')).toBe(
      undefined,
    )
    expect(getEmbeddedGroundingFile('ECHO-single-agent.md')).toBeUndefined()
  })

  it('partitions embedded reads only in embedded mode', () => {
    const requestedFiles = ['ECHO.md', 'src/main.ts']
    expect(
      partitionEmbeddedGroundingReads({
        protocolSource: 'embedded',
        requestedFiles,
      }),
    ).toEqual({
      embedded: [
        {
          path: 'echo.md',
          content: expect.stringContaining(
            'ECHO PROTOCOL',
          ) as unknown as string,
        },
      ],
      remaining: ['src/main.ts'],
    })
  })

  it('leaves local mode untouched (project files win)', () => {
    const requestedFiles = ['ECHO.md', 'ARCHITECTURE.md']
    expect(
      partitionEmbeddedGroundingReads({
        protocolSource: 'local',
        requestedFiles,
      }),
    ).toEqual({ embedded: [], remaining: requestedFiles })
    expect(
      partitionEmbeddedGroundingReads({
        protocolSource: undefined,
        requestedFiles,
      }),
    ).toEqual({ embedded: [], remaining: requestedFiles })
  })
})
