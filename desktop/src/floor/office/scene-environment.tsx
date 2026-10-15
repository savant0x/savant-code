// FID-2026-0905-005 — office-scene decomposition: environment composition.
//
// The static environment assembly: floor, grid, bookshelves, emblem, walls,
// windows, baseboards, plants, desks, console, and the sci-fi prop layer.
// Composition JSX is a verbatim move from office-scene.tsx (Loop-2 promoted
// the OfficeEnvironment extraction from contingency to plan).

import { useMemo } from 'react'

import { DECK_TOKENS } from '../deck-tokens.generated'
import { TOOL_DESKS } from './office-plan'
import {
  CeilingStrips,
  CoffeeMachine,
  Couch,
  CargoStack,
  ChargingPad,
  Fridge,
  HoloColumn,
  ServerRack,
  WaterCooler,
  Whiteboard,
} from './office-props'
import {
  getDarkPanelTextures,
  getTechFloorTextures,
} from './procedural-textures'
import { OFFICE_DEPTH, OFFICE_WIDTH } from './scene-constants'
import {
  NeonLine,
  OfficePlant,
  Bookshelf,
  FloorGrid,
  PerimeterWall,
  WindowStrip,
} from './scene-decor'
import { CommandConsole, HomeDesk, ToolDesk } from './scene-desks'
import { SavantLogo, useSavantLogoTexture } from './scene-identity'

import type { FloorState } from '../adapter/floor-adapter'
import type { JSX } from 'react'

export function OfficeEnvironment({
  floor,
}: {
  readonly floor: FloorState
}): JSX.Element {
  const activeStations = useMemo(
    () => new Set([...floor.pendingTools.values()].map((tool) => tool.station)),
    [floor.pendingTools],
  )
  const tech = useMemo(() => getTechFloorTextures(), [])
  const panels = useMemo(() => getDarkPanelTextures(), [])
  const savantLogo = useSavantLogoTexture()
  useMemo(() => {
    if (tech.map) tech.map.repeat.set(12, 10)
    if (panels.map) panels.map.repeat.set(8, 2)
  }, [tech, panels])
  return (
    <group>
      {/* Dark metal tech floor with cyan seam lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[OFFICE_WIDTH, OFFICE_DEPTH]} />
        <meshStandardMaterial
          map={tech.map ?? undefined}
          roughnessMap={tech.roughnessMap ?? undefined}
          color="#ffffff"
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>
      {/* Neon floor grid — the cyberpunk ground design */}
      <FloorGrid />
      {/* Bookshelves along the walls (operator: "we need bookshelfs") */}
      <Bookshelf position={[-17, 0, -OFFICE_DEPTH / 2 + 0.4]} seed={3} />
      <Bookshelf position={[17, 0, -OFFICE_DEPTH / 2 + 0.4]} seed={11} />
      <Bookshelf
        position={[-OFFICE_WIDTH / 2 + 0.4, 0, 8]}
        rotation={Math.PI / 2}
        seed={19}
      />
      <Bookshelf
        position={[-OFFICE_WIDTH / 2 + 0.4, 0, -6]}
        rotation={Math.PI / 2}
        seed={27}
      />
      {/* Center: the real Savant brand character on the command tile (P7) */}
      <SavantLogo texture={savantLogo} />
      {/* Perimeter walls */}
      <PerimeterWall
        center={[0, -OFFICE_DEPTH / 2]}
        length={OFFICE_WIDTH}
        axis="x"
        panels={panels}
      />
      <PerimeterWall
        center={[0, OFFICE_DEPTH / 2]}
        length={OFFICE_WIDTH}
        axis="x"
        panels={panels}
      />
      <PerimeterWall
        center={[-OFFICE_WIDTH / 2, 0]}
        length={OFFICE_DEPTH}
        axis="z"
        panels={panels}
      />
      <PerimeterWall
        center={[OFFICE_WIDTH / 2, 0]}
        length={OFFICE_DEPTH}
        axis="z"
        panels={panels}
      />
      <WindowStrip
        color={DECK_TOKENS.inlineCodeFg}
        center={[0, 1.9, -OFFICE_DEPTH / 2 + 0.14]}
      />
      <WindowStrip
        color={DECK_TOKENS.error}
        rotation={-Math.PI / 2}
        center={[OFFICE_WIDTH / 2 - 0.14, 1.9, 0]}
      />
      {/* Thin neon baseboard lines along the windowed walls. */}
      <NeonLine
        position={[0, 0.12, -OFFICE_DEPTH / 2 + 0.16]}
        length={OFFICE_WIDTH - 6}
        color={DECK_TOKENS.primary}
      />
      <NeonLine
        position={[OFFICE_WIDTH / 2 - 0.16, 0.12, 0]}
        length={OFFICE_DEPTH - 6}
        color={DECK_TOKENS.error}
        rotation={[0, Math.PI / 2, 0]}
      />
      {/* Corner plants */}
      <OfficePlant
        position={[-OFFICE_WIDTH / 2 + 1.6, 0, -OFFICE_DEPTH / 2 + 1.6]}
        scale={1.5}
      />
      <OfficePlant
        position={[OFFICE_WIDTH / 2 - 1.6, 0, -OFFICE_DEPTH / 2 + 1.6]}
        scale={1.2}
      />
      <OfficePlant
        position={[-OFFICE_WIDTH / 2 + 1.6, 0, OFFICE_DEPTH / 2 - 1.6]}
        scale={1.2}
      />
      <OfficePlant
        position={[OFFICE_WIDTH / 2 - 1.6, 0, OFFICE_DEPTH / 2 - 1.6]}
        scale={1.5}
      />
      {TOOL_DESKS.map((desk) => (
        <ToolDesk
          key={desk.id}
          label={desk.label}
          accent={desk.accent}
          position={desk.position}
          busy={activeStations.has(desk.id)}
        />
      ))}
      {Array.from({ length: 9 }, (_, index) => (
        <HomeDesk key={`home-${index}`} index={index} />
      ))}
      <CommandConsole
        active={floor.savantPresent || floor.pendingTools.size > 0}
      />
      {/* Sci-fi prop layer (P7 — operator: "more models... get creative") */}
      <CeilingStrips width={OFFICE_WIDTH} depth={OFFICE_DEPTH} />
      <ServerRack position={[-OFFICE_WIDTH / 2 + 1.1, 0, -10]} seed={5} />
      <ServerRack position={[-OFFICE_WIDTH / 2 + 1.1, 0, -8.6]} seed={9} />
      <ServerRack
        position={[OFFICE_WIDTH / 2 - 1.1, 0, 12]}
        rotation={Math.PI}
        seed={13}
      />
      <HoloColumn position={[7.5, 0, -12.5]} seed={2} />
      <HoloColumn position={[-7.5, 0, -12.5]} seed={3} />
      <CargoStack position={[13.5, 0, -13]} rotation={0.4} seed={7} />
      <CargoStack position={[-13.5, 0, 13]} rotation={2.1} seed={15} />
      <ChargingPad position={[16, 0, 2]} />
      <ChargingPad position={[-16, 0, -2]} color={DECK_TOKENS.error} />
      {/* Break area (+X/+Z corner) — where idle agents take purposeful breaks */}
      <CoffeeMachine position={[14.5, 0, 14.5]} rotation={Math.PI * 1.25} />
      <WaterCooler position={[16.2, 0, 11.5]} rotation={Math.PI * 1.25} />
      <Fridge position={[16.6, 0, 15.8]} rotation={Math.PI * 1.15} />
      <Couch position={[11, 0, 15.5]} rotation={3.76} />
      <Whiteboard position={[15.5, 0, 6]} rotation={-1.94} seed={4} />
    </group>
  )
}
