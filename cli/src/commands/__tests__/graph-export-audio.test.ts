import fs from 'fs'
import path from 'path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import {
  afterEachHarness,
  beforeEachHarness,
  buildGraphFixture,
  makeParams,
  tempDir,
} from './graph-export-test-harness'
import { handleGraphExportCommand } from '../graph-export'
import {
  getGraphAudioCues,
  GRAPH_AUDIO_CUE_COUNT,
  GRAPH_AUDIO_MAX_REGISTRY_BYTES,
} from '../graph-export/audio'
import { GRAPH_AUDIO_MANIFEST } from '../graph-export/audio/manifest'
import { UniverseAudioManager } from '../graph-export/audio-manager'

describe('knowledge-graph commands: audio', () => {
  beforeEach(beforeEachHarness)
  afterEach(afterEachHarness)

  test('graph-export audio manager handles unlock, mute, decode failure, and voice cap', async () => {
    let resumeCalls = 0
    let decodeCalls = 0
    let sourceStarts = 0
    let sourceStops = 0
    const sources: Array<{ onended: (() => void) | null }> = []
    const context = {
      state: 'suspended' as const,
      currentTime: 0,
      destination: {},
      resume: async () => {
        resumeCalls += 1
      },
      decodeAudioData: async () => {
        decodeCalls += 1
        return {}
      },
      createGain: () => ({ gain: { value: 0 }, connect: () => {} }),
      createBufferSource: () => {
        const source = {
          buffer: null,
          onended: null as (() => void) | null,
          connect: () => {},
          disconnect: () => {},
          start: () => {
            sourceStarts += 1
          },
          stop: () => {
            sourceStops += 1
          },
        }
        sources.push(source)
        return source
      },
    }
    const manager = new UniverseAudioManager({
      createContext: () => context,
      decode: async () => new ArrayBuffer(4),
      maxVoices: 4,
    })
    expect(await manager.play('click')).toBe(false)
    expect(await manager.unlock()).toBe(true)
    expect(manager.getState()).toMatchObject({
      enabled: true,
      unlocked: true,
      volume: 0.4,
    })
    expect(await manager.play('click')).toBe(true)
    expect(resumeCalls).toBe(1)
    expect(decodeCalls).toBe(1)
    expect(sourceStarts).toBe(1)

    const cappedResults = await Promise.all([
      manager.play('voice-1'),
      manager.play('voice-2'),
      manager.play('voice-3'),
      manager.play('voice-4'),
      manager.play('voice-5'),
    ])
    expect(cappedResults.filter(Boolean)).toHaveLength(3)
    expect(sourceStarts).toBe(4)

    manager.setVolume(2)
    expect(manager.getState().volume).toBe(1)
    manager.setEnabled(false)
    expect(sourceStops).toBe(4)
    expect(await manager.play('click')).toBe(false)
    manager.setEnabled(true)
    context.decodeAudioData = async () => {
      throw new Error('decode failed')
    }
    expect(await manager.play('warning')).toBe(false)
    manager.dispose()
  })

  test('graph-export audio unlock failure remains silent and usable', async () => {
    const context = {
      state: 'suspended' as const,
      currentTime: 0,
      destination: {},
      resume: async () => {
        throw new Error('gesture rejected')
      },
      decodeAudioData: async () => ({}),
      createGain: () => ({ gain: { value: 0 }, connect: () => {} }),
      createBufferSource: () => ({
        buffer: null,
        onended: null,
        connect: () => {},
        disconnect: () => {},
        start: () => {},
        stop: () => {},
      }),
    }
    const manager = new UniverseAudioManager({
      createContext: () => context,
      decode: async () => new ArrayBuffer(0),
    })

    expect(await manager.unlock()).toBe(false)
    expect(manager.getState()).toMatchObject({
      enabled: false,
      unlocked: false,
    })
    expect(await manager.play('click')).toBe(false)
    manager.setVolume(Number.NaN)
    expect(manager.getState().volume).toBe(0)
    manager.dispose()
  })

  test('graph-export audio manifest is license-linked and budgeted', () => {
    const cues = getGraphAudioCues()
    expect(cues).toHaveLength(GRAPH_AUDIO_CUE_COUNT)
    expect(GRAPH_AUDIO_CUE_COUNT).toBe(6)
    expect(cues.map((cue) => cue.cue)).toEqual(
      GRAPH_AUDIO_MANIFEST.map((entry) => entry.cue),
    )
    expect(
      GRAPH_AUDIO_MANIFEST.every((entry) => entry.license === 'CC0-1.0'),
    ).toBe(true)
    expect(
      GRAPH_AUDIO_MANIFEST.every((entry) =>
        entry.sourceUrl.startsWith('https://kenney.nl/'),
      ),
    ).toBe(true)
    expect(cues.every((cue) => cue.mime === 'audio/ogg')).toBe(true)
    expect(
      cues.every((cue) => cue.dataUri.startsWith('data:audio/ogg;base64,')),
    ).toBe(true)
    expect(cues.every((cue) => cue.byteCount <= 100 * 1024)).toBe(true)
    expect(cues.every((cue) => cue.durationSeconds <= 2)).toBe(true)
    expect(Buffer.byteLength(JSON.stringify(cues), 'utf8')).toBeLessThanOrEqual(
      GRAPH_AUDIO_MAX_REGISTRY_BYTES,
    )
  })

  test('graph-export runtime audio registry excludes provenance metadata', async () => {
    await buildGraphFixture()
    const outputPath = path.join(tempDir, 'graph-report.html')
    await handleGraphExportCommand(makeParams('/graph-export'), outputPath)
    const html = fs.readFileSync(outputPath, 'utf8')
    const start = html.indexOf(
      '<script type="application/json" id="savant-audio-data">',
    )
    const openEnd = html.indexOf('>', start)
    const end = html.indexOf('</script>', openEnd)
    const payload = JSON.parse(html.slice(openEnd + 1, end)) as {
      cues: Array<Record<string, unknown>>
    }
    expect(payload.cues).toHaveLength(6)
    expect(payload.cues.every((cue) => !('sourceUrl' in cue))).toBe(true)
    expect(payload.cues.every((cue) => !('license' in cue))).toBe(true)
  })
})
