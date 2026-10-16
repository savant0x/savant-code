import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  buildTimeline,
  listSessions,
  loadSession,
  sessionToJSON,
} from '../session-loader'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  )
})

async function fixture(): Promise<{ root: string; directory: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'savant-tmux-loader-'))
  roots.push(root)
  const directory = path.join(root, 'debug', 'tmux-sessions', '20261015-test')
  await mkdir(directory, { recursive: true })
  await writeFile(
    path.join(directory, 'session-info.yaml'),
    [
      'session: test',
      'started: "2026-10-15T12:00:00Z"',
      'started_local: noon',
      'dimensions: {width: 80, height: 24}',
      'status: completed',
    ].join('\n'),
  )
  return { root, directory }
}

describe('tmux viewer offline session loading', () => {
  test('missing session collection is empty; a named missing session rejects', async () => {
    const { root } = await fixture()
    expect(await listSessions(path.join(root, 'absent'))).toEqual([])
    await expect(loadSession('absent', root)).rejects.toThrow(
      'Session not found',
    )
  })

  test('lists directories newest first and ignores ordinary files', async () => {
    const { root, directory } = await fixture()
    await mkdir(path.join(directory, '..', '20261014-test'))
    await writeFile(path.join(directory, '..', 'ignore.txt'), 'ignore')
    expect(await listSessions(root)).toEqual(['20261015-test', '20261014-test'])
  })

  test('loads captures and commands into chronological JSON without tmux', async () => {
    const { root, directory } = await fixture()
    await writeFile(
      path.join(directory, 'commands.yaml'),
      [
        '- timestamp: "2026-10-15T12:00:01Z"',
        '  type: text',
        '  input: /help',
      ].join('\n'),
    )
    await mkdir(path.join(directory, 'captures'))
    await writeFile(
      path.join(directory, 'captures', '001-help.txt'),
      [
        '---',
        'sequence: 1',
        'label: help',
        'timestamp: "2026-10-15T12:00:02Z"',
        'after_command: /help',
        'dimensions: {width: 80, height: 24}',
        '---',
        'Shortcuts',
      ].join('\n'),
    )
    await writeFile(path.join(directory, 'captures', 'ignore.txt'), 'ignore')
    const loaded = await loadSession('20261015-test', root)
    const json = sessionToJSON(loaded)
    expect(json.commands[0].input).toBe('/help')
    expect(json.captures).toHaveLength(1)
    expect(json.captures[0].content).toBe('Shortcuts')
    expect(json.timeline.map((entry) => entry.type)).toEqual([
      'command',
      'capture',
    ])
    expect(buildTimeline([], [])).toEqual([])
  })

  test('supports legacy captures without frontmatter or commands', async () => {
    const { root, directory } = await fixture()
    await writeFile(path.join(directory, 'capture-old.txt'), 'legacy output')
    const loaded = await loadSession('20261015-test', root)
    expect(loaded.commands).toEqual([])
    expect(loaded.captures[0].content).toBe('legacy output')
    expect(loaded.captures[0].frontMatter.sequence).toBe(0)
  })
})
