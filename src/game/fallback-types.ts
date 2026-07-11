import type { EntryState, WaveSegment, WaveWitness } from "./waves"

export type FallbackPattern = Readonly<{
  id: string
  bounds: Readonly<{
    squad: readonly [number, number]
    x: readonly [number, "playfieldWidth"]
    velocity: readonly [number, number]
    playfieldWidth: readonly [number, number]
    collisionRadii: readonly [number, number]
    precedingSegments: readonly [number, number]
    upgrades: Readonly<
      Record<"troop" | "damage" | "fireRate" | "recovery", readonly [number, number]>
    >
    integerOnly: readonly string[]
  }>
  precondition: (entry: EntryState) => boolean
  segment: (entry: EntryState, waveIndex?: number) => WaveSegment
  witness: (entry: EntryState, waveIndex?: number) => WaveWitness
}>
