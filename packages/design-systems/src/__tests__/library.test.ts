import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  loadDesignManifest,
  normalizeDesignSystemSource,
  resolveEmbeddedDesignSystem,
} from '../index'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function createSkillRoot(): {
  root: string
  resource: ReturnType<typeof normalizeDesignSystemSource>
  source: string
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'design-library-'))
  roots.push(root)
  const resources = path.join(root, 'resources')
  fs.mkdirSync(resources)
  const source = `---\nname: Demo\ndescription: A demo\ncolors:\n  primary: '#18faf9'\ntypography:\n  body:\n    fontFamily: Inter\nspacing:\n  sm: 8px\n  md: 16px\nradius:\n  sm: 4px\n---\n\n# Demo\n`
  const resource = normalizeDesignSystemSource({
    sourceContent: source,
    sourcePath: 'library/demo.design.md',
  })
  fs.writeFileSync(
    path.join(resources, `${resource.id}.json`),
    `${JSON.stringify(resource, null, 2)}\n\n---\n\n${source}`,
  )
  const { tokens: _tokens, ...entry } = resource
  fs.writeFileSync(
    path.join(root, 'manifest.json'),
    `${JSON.stringify(
      {
        manifestVersion: '1',
        generatedFrom: 'test',
        nativeDefaultId: 'savant-cyberpunk',
        rawCount: 1,
        admittedCount: 1,
        resources: [entry],
      },
      null,
      2,
    )}\n`,
  )
  return { root, resource, source }
}

describe('embedded design-system resource integrity', () => {
  test('resolves a resource whose source and normalized hashes match', () => {
    const fixture = createSkillRoot()
    const manifest = loadDesignManifest(
      path.join(fixture.root, 'manifest.json'),
    )
    const resolved = resolveEmbeddedDesignSystem({
      skillRoot: fixture.root,
      manifest,
      id: fixture.resource.id,
    })
    expect(resolved.sourceContentHash).toBe(fixture.resource.sourceContentHash)
    expect(resolved.normalizedContentHash).toBe(
      fixture.resource.normalizedContentHash,
    )
  })

  test('rejects a packaged source whose bytes no longer match the manifest', () => {
    const fixture = createSkillRoot()
    const resourcePath = path.join(
      fixture.root,
      'resources',
      `${fixture.resource.id}.json`,
    )
    const original = fs.readFileSync(resourcePath, 'utf8')
    fs.writeFileSync(resourcePath, original.replace('# Demo', '# Tampered'))
    const manifest = loadDesignManifest(
      path.join(fixture.root, 'manifest.json'),
    )
    expect(() =>
      resolveEmbeddedDesignSystem({
        skillRoot: fixture.root,
        manifest,
        id: fixture.resource.id,
      }),
    ).toThrow('does not match manifest')
  })
})
