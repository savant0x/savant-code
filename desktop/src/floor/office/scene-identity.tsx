// FID-2026-0905-005 — office-scene decomposition: brand identity.
//
// The Savant brand emblem: the logo texture loader (cached, failure-tolerant)
// and the central floor emblem decal. Verbatim moves from office-scene.tsx
// (ceiling split from scene-decor.tsx).

import { useEffect, useState } from 'react'
import * as THREE from 'three'

import { DECK_TOKENS } from '../deck-tokens.generated'
import { SAVANT_LOGO_URL } from './scene-constants'

import type { JSX } from 'react'

/** Load the Savant brand logo as a texture, cached so repeated reads share
 * it. Returns null until the PNG arrives (the emblem just shows empty). */
export function useSavantLogoTexture(): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let cancelled = false
    const loader = new THREE.TextureLoader()
    loader.load(
      SAVANT_LOGO_URL,
      (loaded) => {
        if (cancelled) return
        loaded.colorSpace = THREE.SRGBColorSpace
        loaded.anisotropy = 8
        setTexture(loaded)
      },
      undefined,
      () => {
        // Stream/fetch failure: leave the emblem empty, never throw.
        if (!cancelled) setTexture(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])
  return texture
}

/** The central floor emblem — the real Savant character logo. Blacked-out
 * bust with a cyan neon glow outline. A flat, additive-tinted plane decal. */
export function SavantLogo({
  texture,
}: {
  readonly texture: THREE.Texture | null
}): JSX.Element {
  return (
    <group>
      {/* Dark glossy command tile */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[6.2, 48]} />
        <meshStandardMaterial
          color="#10161f"
          roughness={0.25}
          metalness={0.75}
        />
      </mesh>
      {/* Outer neon ring — heavily dimmed so it reads as a subtle inlay edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[5.7, 5.95, 56]} />
        <meshBasicMaterial
          color={DECK_TOKENS.primary}
          transparent
          opacity={0.18}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* The brand character bust at a much lower opacity — a faint floor
       * inlay, not a glowing sign. */}
      {texture !== null ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <planeGeometry args={[7.0, 7.0]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.22}
            toneMapped={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
    </group>
  )
}
