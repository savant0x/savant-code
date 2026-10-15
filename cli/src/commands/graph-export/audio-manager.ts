export interface AudioBufferSourceLike {
  buffer: unknown
  onended: (() => void) | null
  connect: (destination: unknown) => void
  disconnect: () => void
  start: () => void
  stop: () => void
}

export interface AudioContextLike {
  state: 'running' | 'suspended' | 'closed'
  currentTime: number
  destination: unknown
  resume: () => Promise<void>
  decodeAudioData: (buffer: ArrayBuffer) => Promise<unknown>
  createGain: () => {
    gain: { value: number }
    connect: (destination: unknown) => void
  }
  createBufferSource: () => AudioBufferSourceLike
  close?: () => void
}

export interface UniverseAudioOptions {
  createContext: () => AudioContextLike | null
  decode: (cue: string) => Promise<ArrayBuffer>
  maxVoices?: number
  defaultVolume?: number
}

export class UniverseAudioManager {
  private readonly createContext: UniverseAudioOptions['createContext']
  private readonly decode: UniverseAudioOptions['decode']
  private readonly maxVoices: number
  private readonly context: AudioContextLike | null
  private readonly master: ReturnType<AudioContextLike['createGain']> | null
  private enabled = false
  private unlocked = false
  private volume: number
  private readonly active: AudioBufferSourceLike[] = []

  constructor(options: UniverseAudioOptions) {
    this.createContext = options.createContext
    this.decode = options.decode
    this.maxVoices = options.maxVoices ?? 4
    this.volume = options.defaultVolume ?? 0.4
    this.context = this.createContext()
    this.master = this.context?.createGain() ?? null
    if (this.master && this.context) {
      this.master.gain.value = this.volume
      this.master.connect(this.context.destination)
    }
  }

  async unlock(): Promise<boolean> {
    if (!this.context || !this.master || this.context.state === 'closed') {
      return false
    }
    try {
      if (this.context.state !== 'running') await this.context.resume()
      this.unlocked = true
      this.enabled = true
      return true
    } catch {
      return false
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.stopAll()
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0))
    if (this.master) this.master.gain.value = this.volume
  }

  async play(cue: string): Promise<boolean> {
    if (!this.unlocked || !this.enabled || !this.context || !this.master) {
      return false
    }
    if (this.active.length >= this.maxVoices) return false
    try {
      const encoded = await this.decode(cue)
      const buffer = await this.context.decodeAudioData(encoded)
      if (!this.enabled || this.active.length >= this.maxVoices) return false
      const source = this.context.createBufferSource()
      source.buffer = buffer
      source.connect(this.master)
      source.onended = () => {
        this.remove(source)
        source.disconnect()
      }
      this.active.push(source)
      source.start()
      return true
    } catch {
      return false
    }
  }

  dispose(): void {
    this.stopAll()
    this.context?.close?.()
  }

  getState(): { enabled: boolean; unlocked: boolean; volume: number } {
    return {
      enabled: this.enabled,
      unlocked: this.unlocked,
      volume: this.volume,
    }
  }

  private stopAll(): void {
    for (const source of this.active.splice(0)) {
      try {
        source.stop()
      } catch {
        // A source can already be ended; cleanup is still best-effort.
      }
      source.disconnect()
    }
  }

  private remove(source: AudioBufferSourceLike): void {
    const index = this.active.indexOf(source)
    if (index >= 0) this.active.splice(index, 1)
  }
}
