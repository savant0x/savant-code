export type GraphAudioCueName =
  'click' | 'open' | 'close' | 'confirm' | 'warning' | 'travel'

export interface GraphAudioManifestEntry {
  cue: GraphAudioCueName
  filename: string
  mime: 'audio/ogg'
  byteCount: number
  durationSeconds: number
  sha256: string
  sourceUrl: string
  license: 'CC0-1.0'
}

export const GRAPH_AUDIO_MANIFEST: readonly GraphAudioManifestEntry[] = [
  {
    cue: 'click',
    filename: 'click1.ogg',
    mime: 'audio/ogg',
    byteCount: 4983,
    durationSeconds: 0.093832,
    sha256: '59175ac17cd49a68dd736285738441287636112a84a6f7ce0d89921bda5a5360',
    sourceUrl: 'https://kenney.nl/assets/ui-audio',
    license: 'CC0-1.0',
  },
  {
    cue: 'open',
    filename: 'switch1.ogg',
    mime: 'audio/ogg',
    byteCount: 6104,
    durationSeconds: 0.314694,
    sha256: 'efdd1d1e2904fb2d81259cd96bb80101caceae94be02baa4b5310714a6708b19',
    sourceUrl: 'https://kenney.nl/assets/ui-audio',
    license: 'CC0-1.0',
  },
  {
    cue: 'close',
    filename: 'switch2.ogg',
    mime: 'audio/ogg',
    byteCount: 6042,
    durationSeconds: 0.297211,
    sha256: 'aa8ad6e4745e87c84c24a0335e0e0f8629ccbbc474ccfd544fe07d7f3a1b2280',
    sourceUrl: 'https://kenney.nl/assets/ui-audio',
    license: 'CC0-1.0',
  },
  {
    cue: 'confirm',
    filename: 'switch3.ogg',
    mime: 'audio/ogg',
    byteCount: 6270,
    durationSeconds: 0.367143,
    sha256: '75d87dc60b7d29df838530af8c9e28205102234e07b5f1e849aa3d95c3922bd0',
    sourceUrl: 'https://kenney.nl/assets/ui-audio',
    license: 'CC0-1.0',
  },
  {
    cue: 'warning',
    filename: 'switch4.ogg',
    mime: 'audio/ogg',
    byteCount: 6477,
    durationSeconds: 0.419592,
    sha256: '687a42c24e5d25be1a256f35a439fe858548fe76d43ccfb17db546618b0d36db',
    sourceUrl: 'https://kenney.nl/assets/ui-audio',
    license: 'CC0-1.0',
  },
  {
    cue: 'travel',
    filename: 'switch5.ogg',
    mime: 'audio/ogg',
    byteCount: 6181,
    durationSeconds: 0.314694,
    sha256: '8a5c85c0009cfd985634e8fdb4e0350690be5d85fd49f43a90b35c7de0bef7c0',
    sourceUrl: 'https://kenney.nl/assets/ui-audio',
    license: 'CC0-1.0',
  },
]
