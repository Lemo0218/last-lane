import { createProductionWaveState, stepProductionWave } from "./production-wave"
import type { EntryState, WaveSegment, WaveWitness, WitnessFrame } from "./waves"
import { NORMAL_HORIZON_MS, SOLVER_STEP_MS } from "./waves"

export type FallbackPattern = Readonly<{
  id: string
  bounds: Readonly<{
    squad: readonly [number, number]
    x: readonly [number, "playfieldWidth"]
    velocity: readonly [number, number]
    playfieldWidth: readonly [number, number]
    collisionRadii: readonly [number, number]
    precedingSegments: readonly [number, number]
  }>
  precondition: (entry: EntryState) => boolean
  segment: (entry: EntryState) => WaveSegment
  witness: (entry: EntryState) => WaveWitness
}>

const openSegment = (): WaveSegment => ({
  id: "fallback-open-corridor",
  horizonMs: NORMAL_HORIZON_MS,
  blockers: [],
  gates: [],
})

const neutralWitness = (entry: EntryState): WaveWitness => {
  const segment = openSegment()
  const frames: WitnessFrame[] = []
  let state = createProductionWaveState(entry)
  const productionInputs = Array.from({ length: NORMAL_HORIZON_MS / 10 }, () => ({
    moveX: 0 as const,
    paused: false,
  }))
  for (const input of productionInputs) {
    state = stepProductionWave(entry, segment, state, input)
    if (state.atMs % SOLVER_STEP_MS === 0)
      frames.push({
        atMs: state.atMs,
        move: 0,
        x: state.simulation.playerX,
        velocity: 0,
        squad: state.simulation.squad,
      })
  }
  return {
    frames,
    productionInputs,
    finalSquad: state.simulation.squad,
    finalX: state.simulation.playerX,
    collectedGateIds: [],
  }
}

export const fallbackPatterns: readonly FallbackPattern[] = [
  {
    id: "open-corridor",
    bounds: {
      squad: [1, Number.MAX_SAFE_INTEGER],
      x: [0, "playfieldWidth"],
      velocity: [-40, 40],
      playfieldWidth: [1, 1_000],
      collisionRadii: [0, 500],
      precedingSegments: [0, 2],
    },
    precondition: (entry) =>
      Object.values(entry.upgrades).every(Number.isFinite) &&
      Object.values(entry.upgrades).every((level) => level >= 0) &&
      [
        entry.squad,
        entry.x,
        entry.velocity,
        entry.playfieldWidth,
        entry.playerRadius,
        entry.blockerRadius,
      ].every(Number.isFinite) &&
      entry.squad >= 1 &&
      entry.squad <= Number.MAX_SAFE_INTEGER &&
      entry.velocity >= -40 &&
      entry.velocity <= 40 &&
      entry.playerRadius >= 0 &&
      entry.playerRadius <= 500 &&
      entry.blockerRadius >= 0 &&
      entry.blockerRadius <= 500 &&
      entry.precedingSegments.length <= 2 &&
      entry.playfieldWidth >= 1 &&
      entry.playfieldWidth <= 1_000 &&
      entry.playfieldWidth > entry.playerRadius * 2 &&
      entry.x >= 0 &&
      entry.x <= entry.playfieldWidth,
    segment: openSegment,
    witness: neutralWitness,
  },
] as const

export const fallbackFor = (
  entry: EntryState,
): Readonly<{
  patternId: string
  segment: WaveSegment
  witness: WaveWitness
}> => {
  const pattern = fallbackPatterns.find((candidate) => candidate.precondition(entry))
  if (pattern === undefined) throw new RangeError("entry state has no safe fallback")
  return { patternId: pattern.id, segment: pattern.segment(entry), witness: pattern.witness(entry) }
}
