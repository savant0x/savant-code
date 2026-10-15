import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'

import { GRAPH_AUDIO_MANIFEST } from './audio/manifest'

import type { GraphAudioManifestEntry } from './audio/manifest'

export interface GraphAudioCue extends GraphAudioManifestEntry {
  dataUri: string
}

const MAX_REGISTRY_BYTES = 512 * 1024

function audioDirectoryCandidates(): string[] {
  const candidates = [join(import.meta.dir, 'audio')]
  if (process.env.SAVANT_CODE_IS_BINARY === 'true') {
    candidates.unshift(join(dirname(process.execPath), 'graph-export-audio'))
  }
  return candidates
}

function resolveAudioDirectory(): string {
  const directory = audioDirectoryCandidates().find((candidate) =>
    existsSync(join(candidate, GRAPH_AUDIO_MANIFEST[0].filename)),
  )
  if (!directory) {
    throw new Error(
      'Graph export audio assets are missing. Expected the verified Kenney CC0 files beside the graph-export module or binary.',
    )
  }
  return directory
}

function validatedAudioCue(
  directory: string,
  spec: GraphAudioManifestEntry,
): GraphAudioCue {
  const bytes = readFileSync(join(directory, spec.filename))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (bytes.byteLength !== spec.byteCount || sha256 !== spec.sha256) {
    throw new Error(
      `Graph export audio asset verification failed for ${spec.filename}: expected ${spec.byteCount} bytes/${spec.sha256}, got ${bytes.byteLength} bytes/${sha256}.`,
    )
  }
  return {
    ...spec,
    dataUri: `data:audio/ogg;base64,${Buffer.from(bytes).toString('base64')}`,
  }
}

export function getGraphAudioCues(): GraphAudioCue[] {
  const directory = resolveAudioDirectory()
  const cues = GRAPH_AUDIO_MANIFEST.map((spec) =>
    validatedAudioCue(directory, spec),
  )
  const registryBytes = Buffer.byteLength(JSON.stringify(cues), 'utf8')
  if (registryBytes > MAX_REGISTRY_BYTES) {
    throw new Error(
      `Graph export audio registry exceeds the 512 KiB budget: ${registryBytes} bytes.`,
    )
  }
  return cues
}

export function buildGraphAudioDataScript(): string {
  const cues = getGraphAudioCues().map(
    ({ cue, mime, byteCount, durationSeconds, sha256, dataUri }) => ({
      cue,
      mime,
      byteCount,
      durationSeconds,
      sha256,
      dataUri,
    }),
  )
  const payload = JSON.stringify({
    version: 1,
    cues,
  })
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  return `<script type="application/json" id="savant-audio-data">${payload}</script>`
}

export const GRAPH_AUDIO_CUE_COUNT = GRAPH_AUDIO_MANIFEST.length
export const GRAPH_AUDIO_MAX_REGISTRY_BYTES = MAX_REGISTRY_BYTES
