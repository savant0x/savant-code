/**
 * FID-2026-0822-012 P6 — performance instrumentation against the frame budget.
 *
 * FrameStats is a pure injectable-clock ring buffer (fps + nearest-rank p95
 * frame time). PerfHud is an OPT-IN DOM overlay enabled by localStorage
 * `savant.deck.hud === 'on'`; budget breaches warn ONCE per mount
 * (log-once-then-silence, missed-question 9) — never per frame.
 *
 * Styles ship inside this module as an idempotent <style> injection rather
 * than in src/styles.css: the HUD is a self-contained debug surface created
 * and destroyed at runtime, and local CSS guarantees it renders identically
 * wherever the deck mounts. The single literal color is the design-contract
 * 'muted' token (#8f8f99) — not an invented hex.
 */

export const FRAME_BUDGET_MS = 33.34

const SAMPLE_WINDOW = 120
const HUD_STYLE_ID = 'deck-perf-hud-style'
const HUD_CLASS = 'deck-perf-hud'
const HUD_STORAGE_KEY = 'savant.deck.hud'
const BREACH_STREAK_LIMIT = 5

const HUD_CSS = `.${HUD_CLASS}{position:absolute;top:8px;right:10px;z-index:20;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.04em;color:#8f8f99;pointer-events:none;user-select:none;white-space:pre}`

export interface FrameSnapshot {
  readonly fps: number
  readonly p95FrameMs: number
}

/** Minimal storage surface (real Storage satisfies it; tests pass fakes). */
export interface StorageLike {
  getItem(key: string): string | null
}

// Note: the DOM-facing surface stays typed as the REAL `Document` — lib.dom
// generics (`<T extends Node>(node: T) => T`) are structurally incompatible
// with any minimal element interface, so tests stub-cast instead (the same
// narrowing-cast pattern the neighboring suites already use).

export class FrameStats {
  private readonly deltas: number[] = []
  private lastNowMs: number | null = null

  record(nowMs: number): void {
    if (this.lastNowMs !== null) {
      this.deltas.push(Math.max(0, nowMs - this.lastNowMs))
      if (this.deltas.length > SAMPLE_WINDOW) this.deltas.shift()
    }
    this.lastNowMs = nowMs
  }

  /** Null until at least two deltas have widened the window. */
  snapshot(): FrameSnapshot | null {
    if (this.deltas.length < 1) return null
    const sorted = [...this.deltas].sort((a, b) => a - b)
    const total = sorted.reduce((sum, delta) => sum + delta, 0)
    const mean = total / sorted.length
    // Nearest-rank p95 over the sample window.
    const rank = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
    const p95 = sorted[rank] ?? sorted[sorted.length - 1] ?? 0
    return { fps: 1000 / mean, p95FrameMs: p95 }
  }
}

/** Opt-in only: anything but the exact 'on' sentinel keeps the HUD off. */
export function hudEnabled(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(HUD_STORAGE_KEY) === 'on'
  } catch {
    // Privacy modes can throw on storage access; absence means "off".
    return false
  }
}

export interface PerfHud {
  update(snapshot: FrameSnapshot | null): void
  dispose(): void
}

let activeInstances = 0

function ensureStyles(doc: Document): void {
  if (doc.getElementById(HUD_STYLE_ID) !== null) return
  const style = doc.createElement('style')
  style.id = HUD_STYLE_ID
  style.textContent = HUD_CSS
  doc.head?.appendChild(style)
}

function releaseStyles(doc: Document): void {
  if (activeInstances > 0) return
  doc.getElementById(HUD_STYLE_ID)?.remove()
}

class DomPerfHud implements PerfHud {
  private breachStreak = 0
  private warnedThisMount = false
  private disposed = false

  constructor(
    private readonly doc: Document,
    private readonly el: HTMLDivElement,
  ) {}

  update = (snapshot: FrameSnapshot | null): void => {
    if (this.disposed || snapshot === null) return
    const fps = snapshot.fps.toFixed(0)
    const p95 = snapshot.p95FrameMs.toFixed(1)
    this.el.textContent = `${fps}fps · ${p95}ms`
    if (snapshot.p95FrameMs > FRAME_BUDGET_MS) {
      this.breachStreak += 1
      if (this.breachStreak >= BREACH_STREAK_LIMIT && !this.warnedThisMount) {
        this.warnedThisMount = true
        // Deliberate single diagnostic per mount (log-once rule, MQ-9) —
        // the only sanctioned console surface in the deck stage.
        // eslint-disable-next-line no-console
        console.warn(
          `[deck] frame budget breached: p95 ${p95}ms exceeds ` +
            `${FRAME_BUDGET_MS}ms budget`,
        )
      }
    } else {
      this.breachStreak = 0
    }
  }

  dispose = (): void => {
    if (this.disposed) return
    this.disposed = true
    this.el.remove()
    activeInstances -= 1
    releaseStyles(this.doc)
  }
}

export function createPerfHud(doc: Document): PerfHud {
  activeInstances += 1
  ensureStyles(doc)
  const el = doc.createElement('div')
  el.className = HUD_CLASS
  doc.body?.appendChild(el)
  return new DomPerfHud(doc, el)
}
