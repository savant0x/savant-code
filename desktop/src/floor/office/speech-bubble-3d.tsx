/**
 * FID-2026-0831-002 P4 — in-scene speech bubble renderer (R3F scene layer).
 * P20 redesign (operator: "only a small 2 line snippet and are transparent —
 * needs a better design"): a wide, near-opaque rounded panel with an accent
 * border, a speaker tag, and properly wrapped foreground text — a real
 * caption card, not a faint accent-colored strip.
 *
 * Rendered as a CHILD of the speaking character's group, so the bubble rides
 * the per-frame position mutation performed by the office scene's frame loop
 * (no duplicate position tracking, no second render-state seam).
 *
 * Text content arrives pre-flattened and pre-clamped from the tested reducer
 * in `speech-bubbles.ts` (honesty filter + cap + FIFO). This component is
 * presentation only — it never mutates bubble state.
 */

import { Billboard, RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'

import { BUBBLE_TTL_MS } from './speech-bubbles'
import { DECK_TOKENS } from '../deck-tokens.generated'

import type { SpeechBubble } from './speech-bubbles'
import type { JSX } from 'react'
import type { MeshBasicMaterial } from 'three'

/** Bubble height above the character origin (nameplate sits at 2.45). */
export const BUBBLE_Y = 3.15
/** Backing panel size — a wide caption card, not a two-line strip. */
const PANEL_WIDTH = 5.2
const FONT_SIZE = 0.2
const LINE_HEIGHT = 0.29
const PANEL_PADDING = 0.42
/** Estimated chars per wrapped line at FONT_SIZE / text maxWidth — layout
 * heuristic for the panel height, not a text mutation. */
const CHARS_PER_LINE = 40
const MAX_PANEL_HEIGHT = 3.2
/** Name tag sits at the top edge of the panel. */
const TAG_Y_OFFSET = 0.34

export interface AgentSpeechBubbleProps {
  readonly bubble: SpeechBubble
  /** Role accent of the hosting character (single truth: roleAccent). */
  readonly accent: string
}

export function AgentSpeechBubble({
  bubble,
  accent,
}: AgentSpeechBubbleProps): JSX.Element {
  const lines = Math.min(
    Math.max(1, Math.ceil(bubble.text.length / CHARS_PER_LINE)),
    Math.floor((MAX_PANEL_HEIGHT - PANEL_PADDING) / LINE_HEIGHT),
  )
  const panelHeight = lines * LINE_HEIGHT + PANEL_PADDING
  const textWidth = PANEL_WIDTH - 0.7

  // P21 (operator: "it never fades after so many seconds"): the panel eases
  // out over the last FADE_MS of its TTL instead of vanishing the instant
  // the prune tick removes it. Materials update in useFrame (no per-frame
  // re-render); the glow backing and panel share one opacity.
  const panelMat = useRef<MeshBasicMaterial>(null)
  const glowMat = useRef<MeshBasicMaterial>(null)
  const frameMat = useRef<MeshBasicMaterial>(null)
  const fadeStart = useMemo(
    () => bubble.lastMs + BUBBLE_TTL_MS - FADE_MS,
    [bubble.lastMs],
  )
  useFrame(() => {
    const elapsed = performance.now() - fadeStart
    const opacity = clamp01(1 - elapsed / FADE_MS)
    // Peak opacity is capped so the panel never reads as a hard block.
    const panelOpacity = 0.97 * opacity
    if (panelMat.current !== null) panelMat.current.opacity = panelOpacity
    if (glowMat.current !== null) {
      glowMat.current.opacity = 0.35 * opacity
    }
    if (frameMat.current !== null) frameMat.current.opacity = 0.6 * opacity
  })

  return (
    <Billboard position={[0, BUBBLE_Y, 0]}>
      {/* Accent glow backing — a thin, larger plane behind the panel. */}
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[PANEL_WIDTH + 0.06, panelHeight + 0.06]} />
        <meshBasicMaterial
          ref={glowMat}
          color={accent}
          transparent
          opacity={0.35}
        />
      </mesh>
      {/* Near-opaque rounded panel (P20: no more transparency wash-out). */}
      <RoundedBox
        args={[PANEL_WIDTH, panelHeight, 0.05]}
        radius={0.09}
        smoothness={4}
      >
        <meshBasicMaterial
          ref={panelMat}
          color={DECK_TOKENS.surface}
          opacity={0.97}
          transparent
        />
      </RoundedBox>
      {/* Thin accent frame (left band) — the designed-card border. */}
      <mesh position={[-(PANEL_WIDTH / 2) + 0.03, 0, 0.026]}>
        <planeGeometry args={[0.06, panelHeight - 0.1]} />
        <meshBasicMaterial
          ref={frameMat}
          color={accent}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Speaker tag — top-center chip in the role accent. */}
      <Text
        position={[0, panelHeight / 2 - TAG_Y_OFFSET, 0.04]}
        fontSize={0.17}
        color={accent}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.14}
        outlineWidth={0.008}
        outlineColor={DECK_TOKENS.surface}
      >
        {bubble.displayName.toUpperCase()}
      </Text>
      {/* Body text — foreground color for readability; accent stays on the
          tag and border. Text starts below the tag. */}
      <Text
        position={[0, -TAG_Y_OFFSET * 0.55, 0.04]}
        fontSize={FONT_SIZE}
        lineHeight={LINE_HEIGHT / FONT_SIZE}
        color={DECK_TOKENS.foreground}
        anchorX="center"
        anchorY="middle"
        maxWidth={textWidth}
        textAlign="center"
      >
        {bubble.text}
      </Text>
    </Billboard>
  )
}

/** Ease the exit over the last FADE_MS of the bubble's TTL. */
const FADE_MS = 2400
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
