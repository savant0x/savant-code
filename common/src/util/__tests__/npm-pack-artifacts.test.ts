import { expect, test } from 'bun:test'

import { firstPackedArtifact } from '../npm-pack-artifacts'

import type { JSONValue } from '../../types/json'

const artifact = {
  filename: 'savant-code-0.0.36.tgz',
  files: [
    { path: 'index.js' },
    { path: 'savant-design-systems/manifest.json' },
  ],
  version: '0.0.36',
}

// FID-2026-1026-001: npm ≤ 11 prints an array of packed artifacts.
test('reads the npm <= 11 array envelope', () => {
  expect(firstPackedArtifact([artifact])).toEqual(artifact)
})

// npm 12 prints an object keyed by package name.
test('reads the npm 12 name-keyed envelope', () => {
  expect(firstPackedArtifact({ 'savant-code': artifact })).toEqual(artifact)
})

test('fails closed on shapes it cannot vouch for', () => {
  const shapes: JSONValue[] = [[], {}, [1], ['text'], 'text', 7, null, true]
  for (const shape of shapes) {
    expect(firstPackedArtifact(shape)).toBeUndefined()
  }
})

// A release packs one package per call; two keys mean the caller asked for
// something this reader cannot identify, so it refuses rather than guessing.
test('refuses a multi-key envelope', () => {
  expect(firstPackedArtifact({ one: artifact, two: artifact })).toBeUndefined()
  expect(
    firstPackedArtifact([
      artifact,
      { filename: 'other-0.0.36.tgz', files: [], version: '0.0.36' },
    ]),
  ).toEqual(artifact)
})
