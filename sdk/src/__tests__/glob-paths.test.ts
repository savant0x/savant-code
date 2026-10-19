import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { expect, test } from 'bun:test'

import { glob } from '../tools/glob'

test('scoped glob matches native paths and both cwd separators without sibling leakage', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'savant-glob-'))
  try {
    for (const directory of [
      'common/src/constants',
      'common/src/constants-other',
    ]) {
      await fs.mkdir(path.join(root, directory), { recursive: true })
      await fs.writeFile(
        path.join(root, directory, 'agents.ts'),
        'export const limit = 32\n',
      )
    }
    for (const cwd of [
      'common/src/constants',
      'common\\src\\constants',
      'common/src/constants/',
    ]) {
      const output = await glob({
        pattern: '**/*agents.ts*',
        projectPath: root,
        cwd,
        fs,
      })
      expect(output).toMatchObject([
        {
          type: 'json',
          value: {
            files: ['common/src/constants/agents.ts'],
            count: 1,
          },
        },
      ])
    }
    const all = await glob({ pattern: '**/agents.ts', projectPath: root, fs })
    expect(all).toMatchObject([{ type: 'json', value: { count: 2 } }])
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
